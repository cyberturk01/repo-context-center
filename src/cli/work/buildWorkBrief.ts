import { buildStartupContext, focusStartupContextForStart, type StartupContext } from "../../core/suggester";
import { learnedRoutingSignalsForTask, type LearnedRoutingSignals } from "../../core/repositoryLearningRouting";
import { analyzeTaskIntent, type TaskIntentAnalysis } from "../../core/taskIntent";
import {
  nextCommand
} from "./workConstants";
import { assessMapFreshness } from "./mapFreshness";
import { readRecentLogs, readRelevantDecisions } from "./memorySignals";
import {
  buildReadFirstGuidance,
  existingReadFirstContextFiles,
  readFirstCompatibilityPaths
} from "./readFirstGuidance";
import { toAgentRoute } from "./renderAgent";
import { toCompactWorkBrief } from "./renderJson";
import { renderWorkBriefLines } from "./renderText";
import {
  buildTaskFileRecommendations,
  buildWorkFileCategorization
} from "./taskFileRecommendations";
import { targetedLookupHints } from "./targetedLookup";
import type {
  CompactWorkBrief,
  ContextBudget,
  PublicAgentRoute,
  ReadFirstGuidance,
  TargetedLookupHint,
  WorkBrief,
  WorkMapFreshness
} from "./workTypes";

export type WorkBriefTokenEstimator = (brief: WorkBrief) => number;

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
  estimateTokens?: WorkBriefTokenEstimator
): WorkBrief {
  const categorized = buildTaskFileRecommendations(startup, lookupHints, readFirstGuidance, taskIntent);
  const fileCategories = buildWorkFileCategorization(categorized, startup, lookupHints, taskIntent, learnedSignals);
  const nextCheapest = nextCheapestLookupCommand(taskIntent);
  const brief: WorkBrief = {
    command: "work",
    task: startup.task,
    contextBudget,
    mapFreshness,
    routingGuidance: startup.startupInstructions,
    startupContext: startup,
    primaryFiles: fileCategories.primaryFiles,
    supportingFiles: fileCategories.supportingFiles,
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

  return buildBriefWithTokenEstimate(brief, estimateTokens);
}

export async function buildWorkBriefForTask(
  cwd: string,
  task: string,
  options: { contextBudget?: ContextBudget; maxFiles?: number; estimateTokens?: WorkBriefTokenEstimator } = {}
): Promise<WorkBrief> {
  const contextBudget = options.contextBudget ?? "balanced";
  const maxFiles = options.maxFiles ?? 50;
  const taskIntent = analyzeTaskIntent(task);
  const startupContext = await buildStartupContext(cwd, task, {
    maxFiles,
    genericFallbackMaxTests: 5
  });
  const focusedStartupContext = focusStartupContextForStart(startupContext, {
    maxSourceFiles: Math.min(maxFiles, 8),
    maxTestFiles: Math.min(maxFiles, 6)
  });
  const [mapFreshness, decisions, logs, lookupHints, learnedSignals] = await Promise.all([
    assessMapFreshness(cwd),
    readRelevantDecisions(cwd, focusedStartupContext, taskIntent),
    readRecentLogs(cwd),
    targetedLookupHints(cwd, taskIntent, focusedStartupContext),
    learnedRoutingSignalsForTask(cwd, task)
  ]);
  const existingContextFiles = await existingReadFirstContextFiles(cwd);
  const readFirstGuidance = buildReadFirstGuidance(
    focusedStartupContext,
    lookupHints,
    contextBudget,
    existingContextFiles,
    taskIntent
  );
  return buildWorkBrief(
    focusedStartupContext,
    mapFreshness,
    decisions,
    logs,
    lookupHints,
    readFirstGuidance,
    contextBudget,
    taskIntent,
    learnedSignals,
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
