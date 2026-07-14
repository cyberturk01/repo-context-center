import path from "node:path";
import type { LearnedRoutingSignals } from "../../core/repositoryLearningRouting";
import { classifyRepoFile } from "../../core/repoFileClassifier";
import type { StartupContext } from "../../core/suggester";
import type { ApplicationSurface, TaskIntentAnalysis } from "../../core/taskIntent";
import { workOutputAssemblyRoutes } from "./workConstants";
import {
  escapeRegExp,
  extractRepoPaths,
  isAgentRulePath,
  applicationLayerAffinity,
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

function isAuthMiddlewareTask(taskIntent: TaskIntentAnalysis): boolean {
  const terms = new Set(taskIntent.lookupTerms);

  return terms.has("auth") && terms.has("middleware");
}

function isStrongAuthMiddlewarePrimaryPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();

  return (
    /(^|\/)packages\/backend-core\/src\/auth\//i.test(normalized)
    || /(^|\/)packages\/backend-core\/src\/middleware\//i.test(normalized)
    || /(^|\/)packages\/server\/src\/api\/routes\/.+\/middleware\//i.test(normalized)
    || /(^|\/)src\/auth\/middleware\.[cm]?[jt]sx?$/i.test(normalized)
    || /(^|\/)src\/middleware\//i.test(normalized)
  );
}

function calibrateAuthMiddlewarePrimaryPaths(
  primaryPaths: string[],
  taskIntent: TaskIntentAnalysis
): string[] {
  if (!isAuthMiddlewareTask(taskIntent)) {
    return primaryPaths;
  }

  const focused = primaryPaths.filter(isStrongAuthMiddlewarePrimaryPath);

  return focused.length > 0 ? focused : primaryPaths;
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

export function isExplicitlyExcludedLayerPath(
  task: string,
  filePath: string,
  taskIntent: TaskIntentAnalysis
): boolean {
  const layer = applicationLayerAffinity(filePath);

  if (layer === "neutral" || !taskIntent.excludedApplicationLayers.includes(layer)) {
    return false;
  }

  return !taskMentionsExplicitPath(task, filePath) && !taskMentionsExactFilename(task, filePath);
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

function workspacePackageRoot(filePath: string): string | null {
  const parts = normalizeRepoPathText(filePath).split("/").filter(Boolean);
  return ["apps", "packages", "services", "libs", "modules"].includes(parts[0] ?? "") && parts.length >= 2
    ? `${parts[0]}/${parts[1]}`
    : null;
}

function testHasDirectLookupSignal(testPath: string, lookupHints: TargetedLookupHint[]): boolean {
  const hint = lookupHints.find((candidate) => candidate.path === testPath);
  return hint?.signal === "exact-filename-match" || hint?.signal === "paired-test";
}

function testLayerMatchesPrimary(testPath: string, primaryPaths: string[]): boolean {
  const testLayer = applicationLayerAffinity(testPath);
  if (testLayer === "neutral") {
    return true;
  }

  const primaryLayers = new Set(primaryPaths.map(applicationLayerAffinity).filter((layer) => layer !== "neutral"));
  return primaryLayers.size === 0 || primaryLayers.has(testLayer);
}

function testWorkspaceAffinity(testPath: string, primaryPaths: string[]): number {
  const testRoot = workspacePackageRoot(testPath);
  if (!testRoot) {
    return 0;
  }

  return primaryPaths.some((primaryPath) => workspacePackageRoot(primaryPath) === testRoot) ? 8 : 0;
}

function testLayerAffinityScore(testPath: string, primaryPaths: string[]): number {
  const testLayer = applicationLayerAffinity(testPath);
  return testLayer !== "neutral" && primaryPaths.some((primaryPath) => applicationLayerAffinity(primaryPath) === testLayer)
    ? 6
    : 0;
}

function calibrateTestsToPrimary(
  testPaths: string[],
  primaryPaths: string[],
  lookupHints: TargetedLookupHint[]
): string[] {
  return testPaths.filter((testPath) => (
    testHasDirectLookupSignal(testPath, lookupHints)
    || testLayerMatchesPrimary(testPath, primaryPaths)
  ));
}

function sortTestsByPrimaryRelevance(
  testPaths: string[],
  primaryPaths: string[],
  lookupHints: TargetedLookupHint[]
): string[] {
  return [...testPaths].sort((left, right) => {
    const directSignalScore = (testPath: string): number => testHasDirectLookupSignal(testPath, lookupHints) ? 20 : 0;
    const score = (testPath: string): number => (
      directSignalScore(testPath)
      + testRelevanceToPrimary(testPath, primaryPaths)
      + testWorkspaceAffinity(testPath, primaryPaths)
      + testLayerAffinityScore(testPath, primaryPaths)
    );
    const scoreDelta = score(right) - score(left);
    return scoreDelta !== 0 ? scoreDelta : 0;
  });
}

function testAffinityReasons(testPath: string, primaryPaths: string[]): string[] {
  const reasons: string[] = [];
  if (testWorkspaceAffinity(testPath, primaryPaths) > 0) {
    reasons.push("same workspace package as a primary file");
  }
  if (testLayerAffinityScore(testPath, primaryPaths) > 0) {
    reasons.push("same application layer as a primary file");
  }
  return reasons;
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

function normalizeSurfacePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").toLowerCase();
}

export function surfaceForPath(filePath: string): ApplicationSurface | null {
  const normalized = normalizeSurfacePath(filePath);
  const segments = normalized.split(/[\/.\-_]+/).filter(Boolean);
  const basename = path.posix.basename(normalized);
  const role = classifyRepoFile(filePath).role;

  if (role === "test") {
    return "tests";
  }
  if (segments.some((segment) => ["migration", "migrations", "schema", "schemas", "database", "db"].includes(segment))) {
    return "database";
  }
  if (segments.includes("public") || segments.includes("widget") || /public[.-]/i.test(basename)) {
    return "public-api";
  }
  if (
    /^client\.[cm]?[jt]sx?$/i.test(basename)
    || /^api-client\.[cm]?[jt]sx?$/i.test(basename)
    || segments.includes("sdk")
    || (segments.includes("client") && segments.includes("api"))
  ) {
    return "api-client";
  }
  if (
    normalized.startsWith("apps/dashboard/")
    || segments.some((segment) => ["dashboard", "frontend", "settings", "ui", "component", "components", "page", "pages"].includes(segment))
    || /\.[cm]?tsx$/i.test(basename)
  ) {
    return "dashboard-ui";
  }
  if (
    normalized.startsWith("apps/api/")
    || segments.some((segment) => ["api", "backend", "controller", "controllers", "route", "routes", "service", "services", "server"].includes(segment))
  ) {
    return "backend-api";
  }

  return null;
}

function routeCoversSurface(surface: ApplicationSurface, paths: string[], testPaths: string[]): boolean {
  if (surface === "tests") {
    return testPaths.length > 0;
  }

  return paths.some((file) => surfaceForPath(file) === surface);
}

function surfaceCandidateScore(
  filePath: string,
  lookupHints: TargetedLookupHint[],
  categoryRank: number
): number {
  const hint = lookupHints.find((candidate) => candidate.path === filePath);
  const role = classifyRepoFile(filePath).role;
  const roleBonus = role === "source" ? 8 : role === "config" || role === "package" ? 2 : 0;

  return (hint?.score ?? 35) + roleBonus - categoryRank;
}

function surfaceCandidateReason(surface: ApplicationSurface): string {
  if (surface === "public-api") {
    return "public API contract boundary for this multi-surface task";
  }
  return `covers ${surface.replace("-", " ")} surface for this multi-surface task`;
}

function addSurfaceCoverage(
  options: {
    primaryPaths: string[];
    supportingPaths: string[];
    testPaths: string[];
    categorized: {
      taskFiles: WorkRecommendation[];
      supportingTests: WorkRecommendation[];
      recommendedFiles: WorkRecommendation[];
    };
    lookupHints: TargetedLookupHint[];
    taskIntent: TaskIntentAnalysis;
    startup: StartupContext;
  }
): string[] {
  const detected = options.taskIntent.detectedSurfaces.filter((surface) => surface !== "tests");
  if (detected.length <= 1) {
    return options.supportingPaths;
  }

  const routedPaths = uniquePaths([...options.primaryPaths, ...options.supportingPaths]);
  let supportingPaths = [...options.supportingPaths];
  const candidateSources = [
    { rank: 0, paths: options.categorized.taskFiles.map((file) => file.path) },
    { rank: 4, paths: options.categorized.recommendedFiles.map((file) => file.path) },
    { rank: 8, paths: options.lookupHints.map((hint) => hint.path) }
  ];

  for (const surface of detected) {
    if (routeCoversSurface(surface, [...routedPaths, ...supportingPaths], options.testPaths)) {
      continue;
    }

    const candidates = candidateSources
      .flatMap((source) => source.paths.map((file) => ({ file, rank: source.rank })))
      .filter((candidate) => surfaceForPath(candidate.file) === surface)
      .filter((candidate) => classifyRepoFile(candidate.file).role !== "test")
      .filter((candidate) => !options.primaryPaths.includes(candidate.file))
      .filter((candidate) => !supportingPaths.includes(candidate.file))
      .filter((candidate) => !isExplicitlyExcludedLayerPath(options.startup.task, candidate.file, options.taskIntent))
      .map((candidate) => ({
        ...candidate,
        score: surfaceCandidateScore(candidate.file, options.lookupHints, candidate.rank)
      }))
      .filter((candidate) => candidate.score >= 45)
      .sort((left, right) => {
        const scoreDelta = right.score - left.score;
        return scoreDelta !== 0 ? scoreDelta : left.file.localeCompare(right.file);
      });

    const selected = candidates[0];
    if (selected) {
      supportingPaths = uniquePaths([...supportingPaths, selected.file]);
    }
  }

  return supportingPaths;
}

function demotePublicApiBoundaryPrimaryPaths(
  primaryPaths: string[],
  task: string,
  taskIntent: TaskIntentAnalysis
): string[] {
  const isMultiSurfacePublicBoundary = taskIntent.detectedSurfaces.includes("public-api")
    && taskIntent.detectedSurfaces.some((surface) => surface !== "public-api" && surface !== "tests");
  if (!isMultiSurfacePublicBoundary) {
    return primaryPaths;
  }

  const retained = primaryPaths.filter((file) => (
    surfaceForPath(file) !== "public-api"
    || taskMentionsExplicitPath(task, file)
    || taskMentionsExactFilename(task, file)
  ));

  return retained.length > 0 ? retained : primaryPaths;
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
  const rawPrimaryPaths = directPrimaryPaths.length > 0
    ? directPrimaryPaths
    : legacyTaskPaths;
  const primaryCandidatePaths = isAuthMiddlewareTask(taskIntent)
    ? uniquePaths([
      ...rawPrimaryPaths,
      ...categorized.recommendedFiles.map((file) => file.path)
    ])
    : rawPrimaryPaths;
  const scopedPrimaryCandidatePaths = primaryCandidatePaths.filter((file) => (
    !isExplicitlyExcludedLayerPath(startup.task, file, taskIntent)
  ));
  const primaryPaths = demotePublicApiBoundaryPrimaryPaths(
    calibrateAuthMiddlewarePrimaryPaths(scopedPrimaryCandidatePaths, taskIntent),
    startup.task,
    taskIntent
  );
  const primarySet = new Set(primaryPaths);
  const testCandidates = uniquePaths([
    ...categorized.supportingTests.map((file) => file.path),
    ...affectedTestPaths
  ]).filter((file) => !isExplicitlyExcludedLayerPath(startup.task, file, taskIntent));
  const testPaths = sortTestsByPrimaryRelevance(
    calibrateTestsToPrimary(testCandidates, primaryPaths, lookupHints),
    primaryPaths,
    lookupHints
  );
  const testSet = new Set(testPaths);
  const supportingPaths = uniquePaths([
    ...(directPrimaryPaths.length > 0
      ? [
      ...rawPrimaryPaths,
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
  const surfaceBalancedSupportingPaths = addSurfaceCoverage({
    primaryPaths,
    supportingPaths,
    testPaths,
    categorized,
    lookupHints,
    taskIntent,
    startup
  });

  return {
    primaryFiles: recommendationItemsWithHints(primaryPaths, startup, lookupHints),
    supportingFiles: recommendationItemsWithLearning(surfaceBalancedSupportingPaths, startup, lookupHints, learnedSignals).map((item) => {
      const surface = surfaceForPath(item.path);
      return surface && !item.reasons.some((reason) => reason.includes("multi-surface task"))
        ? { ...item, reasons: uniquePaths([...item.reasons, surfaceCandidateReason(surface)]) }
        : item;
    }),
    optionalSupportingFiles: [],
    tests: recommendationItemsWithLearning(testPaths, startup, lookupHints, learnedSignals).map((item) => ({
      ...item,
      reasons: uniquePaths([...item.reasons, ...testAffinityReasons(item.path, primaryPaths)])
    })),
    agentRules: categorized.workflowDocs.filter((file) => !primarySet.has(file.path)),
    contextIfUnclear: categorized.contextDocs.filter((file) => !primarySet.has(file.path))
  };
}
