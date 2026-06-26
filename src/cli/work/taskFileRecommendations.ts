import path from "node:path";
import type { LearnedRoutingSignals } from "../../core/repositoryLearningRouting";
import { classifyRepoFile } from "../../core/repoFileClassifier";
import type { StartupContext } from "../../core/suggester";
import type { TaskIntentAnalysis } from "../../core/taskIntent";
import { workOutputAssemblyRoutes } from "./workConstants";
import {
  escapeRegExp,
  extractRepoPaths,
  isAgentRulePath,
  isWeakSemanticSourceHint,
  isWorkflowConfigOrPackageHint,
  isWorkOutputAssemblyTask,
  promotedLookupHints,
  shouldSuppressWeakSemanticTaskFiles
} from "./targetedLookup";
import type {
  ReadFirstGuidance,
  TargetedLookupHint,
  TargetedLookupSignal,
  WorkFileCategorization,
  WorkRecommendation
} from "./workTypes";

export interface TaskFileRecommendations {
  taskFiles: WorkRecommendation[];
  supportingTests: WorkRecommendation[];
  workflowDocs: WorkRecommendation[];
  contextDocs: WorkRecommendation[];
  recommendedFiles: WorkRecommendation[];
  relevantTests: WorkRecommendation[];
  promoted: TargetedLookupHint[];
}

export function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

function recommendedInspectionFiles(startup: StartupContext): string[] {
  if (startup.likelySourceFiles.length === 0) {
    return [...new Set(startup.readFirstDocs)];
  }

  return [...new Set([
    ...startup.likelySourceFiles,
    ...startup.readFirstDocs.slice(0, 2)
  ])];
}

function recommendationFromPath(filePath: string, startup: StartupContext, hints: TargetedLookupHint[]): WorkRecommendation {
  const hint = hints.find((candidate) => candidate.path === filePath);
  const reasons = [
    ...(hint ? [hint.reason] : []),
    ...(startup.recommendationReasons[filePath] ?? [])
  ].filter(Boolean);

  return {
    path: filePath,
    reasons: uniquePaths(reasons)
  };
}

function recommendationItemsWithHints(
  paths: string[],
  startup: StartupContext,
  hints: TargetedLookupHint[]
): WorkRecommendation[] {
  return uniquePaths(paths).map((file) => recommendationFromPath(file, startup, hints));
}

function learnedReason(filePath: string, learnedSignals: LearnedRoutingSignals): string | null {
  if (learnedSignals.learnedTests.includes(filePath)) {
    return "learned repository test pattern";
  }
  if (learnedSignals.learnedRelatedFiles.includes(filePath)) {
    return "learned repository relationship";
  }
  return null;
}

function recommendationItemsWithLearning(
  paths: string[],
  startup: StartupContext,
  hints: TargetedLookupHint[],
  learnedSignals: LearnedRoutingSignals
): WorkRecommendation[] {
  return recommendationItemsWithHints(paths, startup, hints).map((item) => {
    const reason = learnedReason(item.path, learnedSignals);
    return reason ? { ...item, reasons: uniquePaths([...item.reasons, reason]) } : item;
  });
}

function contextDocPaths(startup: StartupContext, guidance: ReadFirstGuidance): string[] {
  return uniquePaths([
    ...guidance.taskSpecific.map((item) => item.path),
    ...guidance.optional.map((item) => item.path),
    ...startup.readFirstDocs
  ]).filter((file) => file.startsWith("docs/ai-context/"));
}

function isOutputContractTask(taskIntent: TaskIntentAnalysis): boolean {
  return taskIntent.lookupTerms.some((term) => [
    "contract",
    "contracts",
    "evidence",
    "markdown",
    "qa",
    "report",
    "reports",
    "sarif",
    "severity"
  ].includes(term));
}

function isOutputContractPath(filePath: string): boolean {
  return /(^|[\/._-])(qa|evidence|json|markdown|sarif|report|reports|severity|decision|decisions|contract|contracts|analyzer|analyzers)([A-Z\/._-]|$)/.test(filePath);
}

export function buildTaskFileRecommendations(
  startup: StartupContext,
  lookupHints: TargetedLookupHint[],
  readFirstGuidance: ReadFirstGuidance,
  taskIntent: TaskIntentAnalysis
): TaskFileRecommendations {
  const promoted = promotedLookupHints(lookupHints, taskIntent);
  const codeInvestigationTask = taskIntent.isCodeInvestigation;
  const outputAssemblyTask = isWorkOutputAssemblyTask(taskIntent);
  const outputContractTask = isOutputContractTask(taskIntent);
  const promotedByRole = (roles: string[]): string[] => promoted
    .filter((hint) => roles.includes(classifyRepoFile(hint.path).role))
    .map((hint) => hint.path);
  const promotedSourcePaths = promotedByRole(["source"]);
  const startupTaskFiles = startup.likelySourceFiles
    .filter((file) => classifyRepoFile(file).role === "source")
    .filter((file) => !outputAssemblyTask || workOutputAssemblyRoutes.includes(file))
    .filter((file) => !outputContractTask || promotedSourcePaths.length === 0 || promotedSourcePaths.includes(file) || isOutputContractPath(file));
  const workflowTaskPaths = taskIntent.hasRoutingImplementationIntent || (taskIntent.hasDocumentationIntent && !taskIntent.hasReleaseIntent)
    ? []
    : promotedByRole(["config", "workflow", "package"]);
  const hasStrongWorkflowTaskCandidates = taskIntent.hasCiWorkflowIntent
    && promoted.some((hint) => isWorkflowConfigOrPackageHint(hint));
  const suppressWeakSemanticTaskFiles = shouldSuppressWeakSemanticTaskFiles(taskIntent);
  const docsTaskPaths = taskIntent.hasDocumentationIntent ? promotedByRole(["docs"]) : [];
  const releaseDocPaths = taskIntent.hasReleaseIntent ? promotedByRole(["docs"]) : [];
  const promotedTaskPaths = outputAssemblyTask
    ? promoted
      .filter((hint) => workOutputAssemblyRoutes.includes(hint.path))
      .filter((hint) => classifyRepoFile(hint.path).role === "source")
      .map((hint) => hint.path)
    : taskIntent.hasCiWorkflowIntent
    ? promoted
      .filter((hint) => ["source", "config", "workflow", "package"].includes(classifyRepoFile(hint.path).role))
      .filter((hint) => !hasStrongWorkflowTaskCandidates || !isWeakSemanticSourceHint(hint))
      .map((hint) => hint.path)
    : [
      ...docsTaskPaths,
      ...promotedSourcePaths.filter((filePath) => {
        if (!suppressWeakSemanticTaskFiles) {
          return true;
        }

        const hint = promoted.find((candidate) => candidate.path === filePath);
        return !hint || !isWeakSemanticSourceHint(hint);
      }),
      ...workflowTaskPaths,
      ...releaseDocPaths
    ];
  const taskFilePaths = uniquePaths([
    ...promotedTaskPaths,
    ...startupTaskFiles
  ]);
  const testHintPaths = promotedByRole(["test"]);
  const directTestSignals = new Set<TargetedLookupSignal>([
    "exact-filename-match",
    "command-name-match",
    "filename-match",
    "paired-test",
    "task-routing"
  ]);
  const directTestHintPaths = promoted
    .filter((hint) => classifyRepoFile(hint.path).role === "test" && directTestSignals.has(hint.signal))
    .map((hint) => hint.path);
  const filteredTestHintPaths = directTestHintPaths.length > 0
    ? directTestHintPaths
    : testHintPaths;
  const supportingTestPaths = taskIntent.hasDocumentationIntent && !taskIntent.isCodeInvestigation
    ? uniquePaths([...filteredTestHintPaths, ...startup.likelyTests])
      .filter((file) => classifyRepoFile(file).role === "test" && /docs?|readme|markdown/i.test(file))
    : uniquePaths([...filteredTestHintPaths, ...startup.likelyTests]);
  const agentRulePaths = uniquePaths(readFirstGuidance.required
    .map((item) => item.path)
    .filter(isAgentRulePath));
  const contextDocs = contextDocPaths(startup, readFirstGuidance);
  const fallbackRecommended = recommendedInspectionFiles(startup);
  const taskCandidatePaths = uniquePaths([
    ...taskFilePaths,
    ...supportingTestPaths,
    ...workflowTaskPaths
  ]);
  const taskFilesAndTestsAreCheapestPath = codeInvestigationTask || outputAssemblyTask;
  const recommendedPaths = taskFilesAndTestsAreCheapestPath && taskCandidatePaths.length > 0
    ? taskCandidatePaths
    : uniquePaths([
      ...taskFilePaths,
      ...agentRulePaths,
      ...contextDocs,
      ...fallbackRecommended
    ]);

  return {
    taskFiles: recommendationItemsWithHints(taskFilePaths, startup, lookupHints),
    supportingTests: recommendationItemsWithHints(supportingTestPaths, startup, lookupHints),
    workflowDocs: recommendationItemsWithHints(agentRulePaths, startup, lookupHints),
    contextDocs: recommendationItemsWithHints(contextDocs, startup, lookupHints),
    recommendedFiles: recommendationItemsWithHints(recommendedPaths, startup, lookupHints),
    relevantTests: recommendationItemsWithHints(supportingTestPaths, startup, lookupHints),
    promoted
  };
}

function normalizeRepoPathText(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "").toLowerCase();
}

function taskMentionsExplicitPath(task: string, filePath: string): boolean {
  const normalizedFile = normalizeRepoPathText(filePath);
  return extractRepoPaths(task).some((candidate) => normalizeRepoPathText(candidate) === normalizedFile);
}

function taskMentionsExactFilename(task: string, filePath: string): boolean {
  const basename = path.posix.basename(filePath).toLowerCase();
  const pattern = new RegExp(`(^|[^a-z0-9._-])${escapeRegExp(basename)}([^a-z0-9._-]|$)`, "i");

  return pattern.test(task);
}

function taskExplicitlyTargetsContextDocs(taskIntent: TaskIntentAnalysis): boolean {
  return taskIntent.lookupTerms.some((term) => [
    "context",
    "docs",
    "documentation",
    "task",
    "routing",
    "token",
    "budget"
  ].includes(term));
}

function testStem(filePath: string): string {
  return path.posix.basename(filePath)
    .replace(/\.(test|spec)\.[cm]?[jt]sx?$/i, "")
    .replace(/[-_.]test$/i, "")
    .toLowerCase();
}

function sourcePathTerms(filePath: string): Set<string> {
  return new Set(filePath
    .toLowerCase()
    .split(/[\/._-]+/)
    .filter((part) => part.length > 1 && !["src", "test", "tests"].includes(part)));
}

function testRelevanceToPrimary(testPath: string, primaryPaths: string[]): number {
  const stem = testStem(testPath);
  let score = 0;

  for (const primaryPath of primaryPaths) {
    const terms = sourcePathTerms(primaryPath);
    if (terms.has(stem)) {
      score += 3;
    }
    if (terms.has("work") && /^tests\/work\.test\./.test(testPath)) {
      score += 2;
    }
    if (terms.has("handoff") && /^tests\/handoff\.test\./.test(testPath)) {
      score += 2;
    }
  }

  return score;
}

function sortTestsByPrimaryRelevance(testPaths: string[], primaryPaths: string[]): string[] {
  return [...testPaths].sort((left, right) => {
    const scoreDelta = testRelevanceToPrimary(right, primaryPaths) - testRelevanceToPrimary(left, primaryPaths);
    return scoreDelta !== 0 ? scoreDelta : 0;
  });
}

function isDirectTaskTargetHint(hint: TargetedLookupHint | Omit<TargetedLookupHint, "index">, task: string, taskIntent: TaskIntentAnalysis): boolean {
  const role = classifyRepoFile(hint.path).role;
  const explicitPath = taskMentionsExplicitPath(task, hint.path);
  const exactFilename = taskMentionsExactFilename(task, hint.path);

  if (explicitPath) {
    return true;
  }

  if (isWorkOutputAssemblyTask(taskIntent) && hint.path === "src/cli/commands/work.ts") {
    return true;
  }

  if (hint.path.startsWith("docs/ai-context/") && !taskExplicitlyTargetsContextDocs(taskIntent)) {
    return false;
  }

  if (exactFilename) {
    return true;
  }

  if (hint.signal === "command-name-match") {
    return true;
  }

  if (taskIntent.hasDocumentationIntent && !taskIntent.hasReleaseIntent) {
    return false;
  }

  if (["workflow", "config", "package"].includes(role) && hint.signal !== "semantic-match") {
    return true;
  }

  return false;
}

export function buildWorkFileCategorization(
  categorized: {
    taskFiles: WorkRecommendation[];
    supportingTests: WorkRecommendation[];
    workflowDocs: WorkRecommendation[];
    contextDocs: WorkRecommendation[];
    recommendedFiles: WorkRecommendation[];
  },
  startup: StartupContext,
  lookupHints: TargetedLookupHint[],
  taskIntent: TaskIntentAnalysis,
  learnedSignals: LearnedRoutingSignals = {
    learnedRelatedFiles: [],
    learnedTests: [],
    learnedVerification: [],
    learnedHabits: []
  },
  affectedTestPaths: string[] = []
): WorkFileCategorization {
  const directPrimaryPaths = lookupHints
    .filter((hint) => classifyRepoFile(hint.path).role !== "test")
    .filter((hint) => isDirectTaskTargetHint(hint, startup.task, taskIntent))
    .map((hint) => hint.path);
  const legacyTaskPaths = categorized.taskFiles.map((file) => file.path);
  const primaryPaths = directPrimaryPaths.length > 0
    ? directPrimaryPaths
    : legacyTaskPaths;
  const primarySet = new Set(primaryPaths);
  const testPaths = sortTestsByPrimaryRelevance(uniquePaths([
    ...categorized.supportingTests.map((file) => file.path),
    ...affectedTestPaths
  ]), primaryPaths);
  const testSet = new Set(testPaths);
  const supportingPaths = uniquePaths([
    ...(directPrimaryPaths.length > 0
      ? [
      ...legacyTaskPaths,
      ...categorized.recommendedFiles
        .map((file) => file.path)
        .filter((file) => {
          const role = classifyRepoFile(file).role;
          return ["source", "workflow", "config", "package"].includes(role)
            || (taskIntent.hasReleaseIntent && role === "docs");
        })
      ]
      : []),
    ...learnedSignals.learnedRelatedFiles
  ]).filter((file) => !primarySet.has(file) && !testSet.has(file));

  return {
    primaryFiles: recommendationItemsWithHints(primaryPaths, startup, lookupHints),
    supportingFiles: recommendationItemsWithLearning(supportingPaths, startup, lookupHints, learnedSignals),
    optionalSupportingFiles: [],
    tests: recommendationItemsWithLearning(testPaths, startup, lookupHints, learnedSignals),
    agentRules: categorized.workflowDocs.filter((file) => !primarySet.has(file.path)),
    contextIfUnclear: categorized.contextDocs.filter((file) => !primarySet.has(file.path))
  };
}
