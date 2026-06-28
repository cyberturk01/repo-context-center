import type { StartupContext } from "../../core/suggester";
import type { LearnedRoutingSignals } from "../../core/repositoryLearningRouting";
import type { TaskIntentAnalysis } from "../../core/taskIntent";
import { buildTaskAnalysis, type CandidateFile, type CandidateTest, type TaskAnalysisResult } from "../../core/task-analysis";
import {
  nextCommand
} from "./workConstants";
import {
  readFirstCompatibilityPaths
} from "./readFirstGuidance";
import { toAgentRoute } from "./renderAgent";
import { toCompactWorkBrief } from "./renderJson";
import { renderWorkBriefLines } from "./renderText";
import { classifyTaskSize } from "./taskSize";
import type {
  CompactWorkBrief,
  ContextBudget,
  PublicAgentRoute,
  ReadFirstGuidance,
  TargetedLookupHint,
  WorkFileCategorization,
  WorkRecommendation,
  WorkBrief,
  WorkMapFreshness
} from "./workTypes";

export type WorkBriefTokenEstimator = (brief: WorkBrief) => number;

function recommendationFromCandidate(candidate: CandidateFile | CandidateTest): WorkRecommendation {
  return {
    path: candidate.path,
    reasons: candidate.reasons.length > 0 ? candidate.reasons : [candidate.reason].filter(Boolean)
  };
}

function recommendationsFromCandidates(candidates: Array<CandidateFile | CandidateTest>): WorkRecommendation[] {
  return candidates.map(recommendationFromCandidate);
}

function nextCheapestLookupCommand(taskIntent: TaskIntentAnalysis): string {
  return taskIntent.nextLookupKeyword ? `rcc find "${taskIntent.nextLookupKeyword}"` : 'rcc find "<keyword>"';
}

function riskLines(startup: StartupContext): string[] {
  const lines = [`- ${startup.riskLevel}`];
  const riskReasons = startup.reasons.filter((reason) => (
    reason.includes("risk")
    || reason.includes("hotspot")
    || reason.includes("dependency")
    || reason.includes("insufficient")
  ));

  for (const reason of riskReasons.slice(0, 2)) {
    lines.push(`- ${reason}`);
  }

  if (startup.readFirstDocs.includes("docs/ai-context/RISK_REGISTER.md")) {
    lines.push("- Check docs/ai-context/RISK_REGISTER.md before editing.");
  }

  return lines;
}

function riskValues(startup: StartupContext): string[] {
  return riskLines(startup).map((line) => line.replace(/^- /, ""));
}

function fallbackTokenEstimate(brief: WorkBrief): number {
  return Math.ceil(renderWorkBriefLines(brief).join("\n").length / 4);
}

function limitRecommendations(
  items: WorkRecommendation[],
  maxItems: number,
  preserve?: (item: WorkRecommendation) => boolean
): WorkRecommendation[] {
  if (items.length <= maxItems) {
    return items;
  }

  const selected = items.slice(0, maxItems);
  const preserved = preserve ? items.find((item) => preserve(item)) : undefined;

  if (preserved && !selected.some((item) => item.path === preserved.path)) {
    return [...selected.slice(0, Math.max(0, maxItems - 1)), preserved];
  }

  return selected;
}

function isHighlyRelevantLearnedTest(item: WorkRecommendation): boolean {
  return item.reasons.includes("learned repository test pattern");
}

function isBoundarySupportingPath(filePath: string): boolean {
  const basename = filePath.split("/").pop() ?? filePath;

  return /^src\/cli\/commands\/[^/]+\.[^.]+$/i.test(filePath)
    || /options?\.[^.]+$/i.test(basename)
    || /^write[A-Z]/.test(basename);
}

function taskMentionsBoundaryWork(task: string): boolean {
  return /\b(cli|command|commands|arg|args|option|options|flag|flags|write|writer|persist|persistence|output|stdout|stderr|json)\b/i.test(task);
}

function supportingFileRank(item: WorkRecommendation, taskIntent: TaskIntentAnalysis): number {
  if (item.reasons.includes("learned repository relationship")) {
    return 0;
  }
  if (item.reasons.some((reason) => reason.includes("task routing guidance"))) {
    return 1;
  }
  if (taskIntent.lookupTerms.some((term) => term.length > 3 && item.path.toLowerCase().includes(term))) {
    return 2;
  }
  return 3;
}

function compactMediumSupportingFiles(
  task: string,
  supportingFiles: WorkRecommendation[],
  optionalSupportingFiles: WorkRecommendation[],
  taskIntent: TaskIntentAnalysis
): { supportingFiles: WorkRecommendation[]; optionalSupportingFiles: WorkRecommendation[] } {
  const maxSupportingFiles = 5;
  const canDemoteBoundaryFiles = !taskMentionsBoundaryWork(task);
  const boundaryFiles = canDemoteBoundaryFiles
    ? supportingFiles.filter((file) => isBoundarySupportingPath(file.path))
    : [];
  const retainedCandidates = supportingFiles.filter((file) => !boundaryFiles.some((boundary) => boundary.path === file.path));
  const shouldDemoteBoundaryFiles = boundaryFiles.length > 0 && retainedCandidates.length >= 3;
  const ranked = (shouldDemoteBoundaryFiles ? retainedCandidates : supportingFiles)
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const rankDelta = supportingFileRank(left.item, taskIntent) - supportingFileRank(right.item, taskIntent);
      return rankDelta !== 0 ? rankDelta : left.index - right.index;
    })
    .map((entry) => entry.item);
  const visibleSupportingFiles = ranked.slice(0, maxSupportingFiles);
  const visiblePaths = new Set(visibleSupportingFiles.map((file) => file.path));
  const overflowFiles = ranked.filter((file) => !visiblePaths.has(file.path));

  return {
    supportingFiles: visibleSupportingFiles,
    optionalSupportingFiles: [
      ...optionalSupportingFiles,
      ...(shouldDemoteBoundaryFiles ? boundaryFiles : []),
      ...overflowFiles
    ]
  };
}

export function pruneWorkBriefForTaskSize(brief: WorkBrief): WorkBrief {
  if (brief.taskSize === "large" || brief.taskSize === "medium") {
    return brief;
  }

  const limits = brief.taskSize === "tiny"
    ? { primaryFiles: 1, supportingFiles: 0, tests: 0, learnedMemory: 0, recentLogs: 0 }
    : { primaryFiles: 2, supportingFiles: 2, tests: 2, learnedMemory: 1, recentLogs: 3 };
  const primaryFiles = limitRecommendations(brief.primaryFiles, limits.primaryFiles);
  const supportingFiles = limitRecommendations(brief.supportingFiles, limits.supportingFiles);
  const tests = limitRecommendations(brief.tests, limits.tests, isHighlyRelevantLearnedTest);
  const primaryPaths = new Set(primaryFiles.map((file) => file.path));
  const supportingPaths = new Set(supportingFiles.map((file) => file.path));
  const testPaths = new Set(tests.map((file) => file.path));
  const routePaths = new Set([...primaryPaths, ...supportingPaths, ...testPaths]);

  return {
    ...brief,
    primaryFiles,
    supportingFiles,
    optionalSupportingFiles: brief.optionalSupportingFiles ?? [],
    tests,
    taskFiles: limitRecommendations(
      brief.taskFiles.filter((file) => primaryPaths.has(file.path) || routePaths.has(file.path)),
      limits.primaryFiles
    ),
    supportingTests: limitRecommendations(
      brief.supportingTests.filter((file) => testPaths.has(file.path) || routePaths.has(file.path)),
      limits.tests,
      isHighlyRelevantLearnedTest
    ),
    recommendedFiles: limitRecommendations(
      brief.recommendedFiles.filter((file) => routePaths.has(file.path) || primaryPaths.has(file.path)),
      limits.primaryFiles + limits.supportingFiles + limits.tests
    ),
    relevantTests: limitRecommendations(
      brief.relevantTests.filter((file) => testPaths.has(file.path) || routePaths.has(file.path)),
      limits.tests,
      isHighlyRelevantLearnedTest
    ),
    learnedRelatedFiles: brief.learnedRelatedFiles.filter((file) => supportingPaths.has(file)).slice(0, limits.learnedMemory),
    learnedTests: brief.learnedTests.filter((file) => testPaths.has(file)).slice(0, limits.tests),
    learnedVerification: brief.learnedVerification.slice(0, limits.learnedMemory),
    learnedHabits: brief.learnedHabits.slice(0, limits.learnedMemory),
    recentLogs: brief.recentLogs.slice(0, limits.recentLogs),
    relevantDecisions: brief.relevantDecisions.slice(0, limits.learnedMemory === 0 ? 1 : limits.learnedMemory)
  };
}

export function buildBriefWithTokenEstimate(
  brief: WorkBrief,
  estimateTokens: WorkBriefTokenEstimator = fallbackTokenEstimate
): WorkBrief {
  const preliminary = {
    ...brief,
    tokenEstimate: {
      roughTokens: null,
      text: "calculating."
    }
  };
  const roughTokens = estimateTokens(preliminary);

  return {
    ...brief,
    tokenEstimate: {
      roughTokens,
      text: `roughly ${roughTokens} tokens for this brief.`
    }
  };
}

export function buildWorkBrief(
  startup: StartupContext,
  mapFreshness: WorkMapFreshness,
  decisions: string[],
  logs: string[],
  lookupHints: TargetedLookupHint[],
  readFirstGuidance: ReadFirstGuidance,
  contextBudget: ContextBudget,
  taskIntent: TaskIntentAnalysis,
  learnedSignals: LearnedRoutingSignals,
  precomputed: {
    categorized: TaskAnalysisResult["work"]["categorized"];
    fileCategories: WorkFileCategorization;
  },
  estimateTokens?: WorkBriefTokenEstimator
): WorkBrief {
  const categorized = precomputed.categorized;
  const fileCategories = precomputed.fileCategories;
  const nextCheapest = nextCheapestLookupCommand(taskIntent);
  const taskSize = classifyTaskSize(startup.task);
  const supportingTier = taskSize.size === "medium"
    ? compactMediumSupportingFiles(
      startup.task,
      fileCategories.supportingFiles,
      fileCategories.optionalSupportingFiles,
      taskIntent
    )
    : {
      supportingFiles: fileCategories.supportingFiles,
      optionalSupportingFiles: fileCategories.optionalSupportingFiles
    };
  const brief: WorkBrief = {
    command: "work",
    task: startup.task,
    taskSize: taskSize.size,
    taskMode: taskSize.mode,
    taskSizeConfidence: taskSize.confidence,
    taskSizeReasons: taskSize.reasons,
    contextBudget,
    mapFreshness,
    routingGuidance: startup.startupInstructions,
    startupContext: startup,
    primaryFiles: fileCategories.primaryFiles,
    supportingFiles: supportingTier.supportingFiles,
    optionalSupportingFiles: supportingTier.optionalSupportingFiles,
    tests: fileCategories.tests,
    agentRules: fileCategories.agentRules,
    contextIfUnclear: fileCategories.contextIfUnclear,
    taskFiles: categorized.taskFiles,
    supportingTests: categorized.supportingTests,
    workflowDocs: categorized.workflowDocs,
    contextDocs: categorized.contextDocs,
    recommendedFiles: categorized.recommendedFiles,
    relevantTests: categorized.relevantTests,
    targetedLookupHints: lookupHints.map((hint) => ({
      path: hint.path,
      term: hint.term,
      reason: hint.reason,
      signal: hint.signal,
      confidence: hint.confidence,
      score: hint.score
    })),
    promotedFromTargetedLookup: categorized.promoted.map((hint) => ({
      path: hint.path,
      term: hint.term,
      reason: hint.reason,
      signal: hint.signal,
      confidence: hint.confidence,
      score: hint.score
    })),
    learnedRelatedFiles: learnedSignals.learnedRelatedFiles,
    learnedTests: learnedSignals.learnedTests,
    learnedVerification: learnedSignals.learnedVerification,
    learnedHabits: learnedSignals.learnedHabits,
    relevantDecisions: decisions,
    recentLogs: logs,
    tokenEstimate: {
      roughTokens: null,
      text: "unknown"
    },
    risks: riskValues(startup),
    cheapestPath: [
      "Inspect the primary files listed below.",
      "Check supporting tests.",
      `If more search is needed, run: ${nextCheapest}`,
      "Avoid broad rg/find until targeted lookup is exhausted."
    ],
    avoid: [
      "broad rg/find before checking primary files",
      "reading all docs/ai-context before primary files",
      "generated/assets/fixtures unless explicitly relevant",
      "full repository scans for narrow bug investigation tasks"
    ],
    readFirst: readFirstCompatibilityPaths(readFirstGuidance),
    readFirstGuidance,
    nextCheapestCommand: nextCheapest,
    nextCommand
  };

  return buildBriefWithTokenEstimate(pruneWorkBriefForTaskSize(brief), estimateTokens);
}

export async function buildWorkBriefForTask(
  cwd: string,
  task: string,
  options: { contextBudget?: ContextBudget; maxFiles?: number; estimateTokens?: WorkBriefTokenEstimator } = {}
): Promise<WorkBrief> {
  const contextBudget = options.contextBudget ?? "balanced";
  const analysis = await buildTaskAnalysis(cwd, task, {
    contextBudget,
    maxFiles: options.maxFiles ?? 50,
    taskOnly: true
  });
  const taskAnalysisTests = recommendationsFromCandidates(analysis.testCandidates);
  const taskAnalysisTestPaths = new Set(taskAnalysisTests.map((file) => file.path));
  const categorizedFromAnalysis = {
    ...analysis.work.categorized,
    supportingTests: taskAnalysisTests,
    recommendedFiles: analysis.work.categorized.recommendedFiles.filter((file) => (
      !file.path.match(/\.(test|spec)\.[cm]?[jt]sx?$/i) || taskAnalysisTestPaths.has(file.path)
    )),
    relevantTests: taskAnalysisTests
  };
  const fileCategoriesFromAnalysis = {
    ...analysis.work.fileCategories,
    primaryFiles: recommendationsFromCandidates(analysis.primaryFiles),
    tests: taskAnalysisTests
  };

  return buildWorkBrief(
    analysis.work.focusedStartupContext,
    analysis.work.mapFreshness,
    analysis.work.decisions,
    analysis.work.logs,
    analysis.work.lookupHints,
    analysis.work.readFirstGuidance,
    contextBudget,
    analysis.work.taskIntent,
    analysis.work.filteredLearnedSignals,
    {
      categorized: categorizedFromAnalysis,
      fileCategories: fileCategoriesFromAnalysis
    },
    options.estimateTokens
  );
}

export async function buildCompactWorkBrief(
  cwd: string,
  task: string,
  options: { contextBudget?: ContextBudget; maxFiles?: number } = {}
): Promise<CompactWorkBrief> {
  return toCompactWorkBrief(await buildWorkBriefForTask(cwd, task, options));
}

export async function buildAgentWorkRoute(
  cwd: string,
  task: string,
  options: { contextBudget?: ContextBudget; maxFiles?: number; verbose?: boolean } = {}
): Promise<PublicAgentRoute> {
  return toAgentRoute(
    await buildWorkBriefForTask(cwd, task, options),
    options.verbose ?? false
  );
}
