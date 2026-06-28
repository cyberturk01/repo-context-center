import { classifyRepoFile } from "../repoFileClassifier";
import { analyzeAffectedTests, type ClassifiedAffectedTest, type ScoredAffectedTest } from "../../cli/shared/affectedTests";
import { uniquePaths } from "../../cli/work/taskFileRecommendations";
import type { LearnedRoutingSignals } from "../repositoryLearningRouting";
import type { CandidateFile, CandidateTest, ConfidenceInfo, TestEvidence, VerificationCommand, VerificationPlan } from "./types";
import { isContextScaffoldingPath, isDocsOnlyPath } from "./classifyRelationships";

const runnableNodeTestPattern = /\.(test|spec)\.[cm]?[jt]sx?$/i;

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

function changedSourceFiles(changedFiles: string[]): string[] {
  return changedFiles.filter((file) => {
    const info = classifyRepoFile(file);
    return !isContextScaffoldingPath(file) && ["source", "config", "workflow", "package"].includes(info.role);
  });
}

function commandPathArgs(filePaths: string[]): string {
  return filePaths
    .flatMap(splitConcatenatedCommandPaths)
    .filter(Boolean)
    .join(" ");
}

function splitConcatenatedCommandPaths(filePath: string): string[] {
  return normalizeRepoPath(filePath)
    .replace(
      /(\.(?:test|spec)\.(?:tsx|jsx|mjs|cjs|ts|js)|\.(?:tsx|jsx|mjs|cjs|ts|js))(?=(?:[A-Za-z0-9_.-]+\/|[A-Za-z0-9_.-]+\.(?:test|spec)\.|[A-Za-z0-9_.-]+\.(?:tsx|jsx|mjs|cjs|ts|js)))/g,
      "$1 "
    )
    .split(/\s+/)
    .map((item) => item.trim());
}

function commandForTests(tests: CandidateTest[]): VerificationCommand[] {
  const runnable = tests
    .map((test) => test.path)
    .filter((file) => runnableNodeTestPattern.test(file))
    .slice(0, 8);

  if (runnable.length === 0) {
    return [];
  }

  return [{
    command: `node --test ${commandPathArgs(runnable)}`,
    type: "test",
    scope: "focused",
    confidence: "high",
    reason: "run affected tests directly"
  }];
}

function hasPackageScript(primaryFiles: CandidateFile[], changedFiles: string[]): boolean {
  return changedFiles.some((file) => classifyRepoFile(file).role === "package")
    || primaryFiles.some((file) => classifyRepoFile(file.path).role === "package");
}

function hasBuildRelevantChange(affectedFiles: CandidateFile[], changedFiles: string[]): boolean {
  const files = uniquePaths([
    ...changedFiles,
    ...affectedFiles.map((file) => file.path)
  ]);

  return files.some((file) => {
    const info = classifyRepoFile(file);
    return info.language === "typescript" || ["config", "package"].includes(info.role);
  });
}

function hasChangedNonDocsImpact(changedFiles: string[]): boolean {
  return changedFiles.some((file) => {
    const role = classifyRepoFile(file).role;
    return ["source", "config", "workflow", "package"].includes(role);
  });
}

function isDocsOnlyImpact(affectedFiles: CandidateFile[], tests: CandidateTest[], changedFiles: string[]): boolean {
  return affectedFiles.length > 0
    && tests.length === 0
    && affectedFiles.every((file) => isDocsOnlyPath(file.path))
    && !hasChangedNonDocsImpact(changedFiles);
}

function mergeCommands(commands: VerificationCommand[]): VerificationCommand[] {
  const seen = new Set<string>();
  return commands.filter((item) => {
    if (seen.has(item.command)) {
      return false;
    }
    seen.add(item.command);
    return true;
  });
}

function suggestedCommands(
  primaryFiles: CandidateFile[],
  changedFiles: string[],
  affectedFiles: CandidateFile[],
  tests: CandidateTest[]
): VerificationCommand[] {
  const commands: VerificationCommand[] = [
    ...commandForTests(tests)
  ];
  const docsOnlyImpact = isDocsOnlyImpact(affectedFiles, tests, changedFiles);

  if (hasBuildRelevantChange(affectedFiles, changedFiles)) {
    commands.push({
      command: "npm run build",
      type: "build",
      scope: "project",
      confidence: "medium",
      reason: "verify TypeScript and generated CLI output"
    });
  }

  if (!docsOnlyImpact && (commands.length === 0 || hasPackageScript(primaryFiles, changedFiles))) {
    commands.push({
      command: "npm test",
      type: "test",
      scope: "project",
      confidence: "medium",
      reason: "fallback full verification for broad or package-level impact"
    });
  }

  return mergeCommands(commands);
}

function hasFilenameStemMatch(files: CandidateFile[]): boolean {
  return files.some((file) => {
    const signals = "signals" in file && Array.isArray(file.signals) ? file.signals : [];

    return signals.some((signal) => signal === "filename similarity" || signal === "specific routed test name")
      || /\b(filename similarity|specific routed test name)\b/i.test(file.reason);
  });
}

function testRelationship(tests: CandidateFile[]): ConfidenceInfo["evidence"]["testRelationship"] {
  if (tests.length === 0) {
    return "none";
  }

  return tests.some((file) => {
    const signals = "signals" in file && Array.isArray(file.signals) ? file.signals : [];

    return signals.some((signal) => [
      "changed test file",
      "imports affected source",
      "repository learning",
      "co-change history",
      "filename similarity",
      "same directory",
      "same package/module",
      "same package/module with task token",
      "specific routed test name"
    ].includes(signal)) || /\b(changed test file|imports affected source|repository learning|co-change history|filename similarity|same directory|same package\/module|specific routed test name)\b/i.test(file.reason);
  })
    ? "strong"
    : "weak";
}

function confidenceExplanation(
  changedFiles: string[],
  contextChanges: CandidateFile[],
  routeFiles: CandidateFile[],
  routeTests: CandidateFile[],
  affectedFiles: CandidateFile[],
  affectedTests: CandidateFile[]
): ConfidenceInfo {
  const nonContextChangedFiles = changedFiles.filter((file) => !isContextScaffoldingPath(file));
  const taskRoutingMatched = routeFiles.length > 0 || routeTests.length > 0;
  const filenameStemMatched = hasFilenameStemMatch([...affectedFiles, ...affectedTests]);
  const contextOnlyChanges = changedFiles.length > 0
    && nonContextChangedFiles.length === 0
    && contextChanges.length > 0;
  const relationship = testRelationship(affectedTests);
  const reasons: string[] = [];
  let level: ConfidenceInfo["level"] = "low";

  if (nonContextChangedFiles.length > 0 && affectedTests.length > 0 && relationship === "strong") {
    level = "high";
  } else if (affectedFiles.length > 0 || affectedTests.length > 0 || contextChanges.length > 0 || taskRoutingMatched) {
    level = "medium";
  }

  if (nonContextChangedFiles.length > 0) {
    reasons.push("changed files detected");
  }
  if (contextOnlyChanges) {
    reasons.push("context-only changes detected");
  } else if (contextChanges.length > 0) {
    reasons.push("context changes detected");
  }
  if (taskRoutingMatched) {
    reasons.push("task routing matched");
  }
  if (filenameStemMatched) {
    reasons.push("filename stem matched");
  }
  if (relationship === "strong") {
    reasons.push("strong test relationship");
  } else if (relationship === "weak") {
    reasons.push("weak test relationship");
  } else {
    reasons.push("no test relationship");
  }
  if (level !== "high" && contextOnlyChanges) {
    reasons.push("context changes do not raise confidence to high");
  }

  return {
    level,
    reasons,
    evidence: {
      changedFiles: changedFiles.length,
      nonContextChangedFiles: nonContextChangedFiles.length,
      contextChanges: contextChanges.length,
      affectedFiles: affectedFiles.length,
      affectedTests: affectedTests.length,
      taskRoutingMatched,
      filenameStemMatched,
      contextOnlyChanges,
      testRelationship: relationship
    }
  };
}

export function verificationReferencesFilteredTest(command: string, affectedTestSet: Set<string>): boolean {
  const testPaths = command.match(/\b(?:tests?|__tests__|e2e|cypress)\/[^\s'"`]+\.(?:test|spec)\.[cm]?[jt]sx?\b/g) ?? [];

  return testPaths.length > 0 && !testPaths.some((file) => affectedTestSet.has(file));
}

const domainStopWords = new Set([
  "__tests__",
  "app",
  "apps",
  "backend",
  "common",
  "core",
  "e2e",
  "frontend",
  "helper",
  "helpers",
  "index",
  "integration",
  "lib",
  "libs",
  "package",
  "packages",
  "shared",
  "spec",
  "src",
  "test",
  "tests",
  "unit",
  "util",
  "utils"
]);

function domainTokens(value: string): string[] {
  return value
    .replace(/\\/g, "/")
    .replace(/\.(test|spec)\.[cm]?[jt]sx?$/i, "")
    .replace(/\.[cm]?[jt]sx?$/i, "")
    .replace(/\.[^.]+$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[\/._\-\s]+/)
    .filter((token) => token.length > 1 && !domainStopWords.has(token));
}

function domainsFromPath(filePath: string): string[] {
  const parts = normalizeRepoPath(filePath).split("/").filter(Boolean);
  const scopedParts = (parts[0] === "packages" || parts[0] === "libs") && parts.length > 2
    ? parts.slice(2)
    : parts;

  return uniquePaths(domainTokens(scopedParts.join("/")));
}

function domainsFromTask(task: string): string[] {
  const genericTaskWords = new Set([
    "add",
    "change",
    "fix",
    "improve",
    "refactor",
    "test",
    "tests",
    "update",
    "work"
  ]);

  return uniquePaths(domainTokens(task).filter((token) => !genericTaskWords.has(token)));
}

function sharedDomains(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);

  return left.filter((domain) => rightSet.has(domain));
}

function evidenceRelationship(classification: ClassifiedAffectedTest, hasTaskDomainMatch: boolean, hasSourceDomainMatch: boolean): TestEvidence["relationship"] {
  const signals = new Set(classification.signals);

  if (
    signals.has("changed test file")
    || signals.has("imports affected source")
    || signals.has("same directory")
  ) {
    return "exact";
  }
  if (signals.has("co-change history") || signals.has("repository learning")) {
    return "historical";
  }
  if ((signals.has("filename similarity") || signals.has("specific routed test name")) && (hasTaskDomainMatch || hasSourceDomainMatch)) {
    return "exact";
  }
  if (hasTaskDomainMatch || hasSourceDomainMatch) {
    return "domain";
  }
  if (
    signals.has("filename similarity")
    || signals.has("specific routed test name")
    || signals.has("task/test name match")
    || signals.has("same package/module")
    || signals.has("same package/module with task token")
    || signals.has("task routing evidence")
  ) {
    return "nearby";
  }

  return "unknown";
}

function testEvidenceForClassification(input: {
  classification: ClassifiedAffectedTest;
  taskDomains: string[];
  sourceDomains: string[];
}): TestEvidence {
  const testDomains = domainsFromPath(input.classification.path);
  const taskMatches = sharedDomains(testDomains, input.taskDomains);
  const sourceMatches = sharedDomains(testDomains, input.sourceDomains);
  const positiveSignals = input.classification.signals.filter((signal) => signal !== "weak generic route penalty");
  const negativeSignals = input.classification.signals.includes("weak generic route penalty")
    ? ["weak generic route penalty"]
    : [];
  const relationship = evidenceRelationship(input.classification, taskMatches.length > 0, sourceMatches.length > 0);

  if (taskMatches.length === 0) {
    negativeSignals.push("no shared task/test domain");
  }
  if (sourceMatches.length === 0) {
    negativeSignals.push("no shared source/test domain");
  }
  if (input.classification.relationshipType === "fallback-test") {
    negativeSignals.push("route-only test candidate");
  } else if (input.classification.relationshipType === "unrelated") {
    negativeSignals.push("no affected-test relationship");
  } else if (relationship === "nearby") {
    negativeSignals.push("nearby package/module signal without domain evidence");
  }

  let decision: TestEvidence["decision"] = "excluded";
  let decisionReason = "excluded: no eligible test relationship to the task domain";

  if (relationship === "exact") {
    decision = "recommended";
    decisionReason = "recommended: exact relationship to affected source or routed test name";
  } else if (relationship === "domain") {
    decision = "recommended";
    decisionReason = "recommended: test domain overlaps the task or affected source domain";
  } else if (relationship === "historical" && (taskMatches.length > 0 || sourceMatches.length > 0)) {
    decision = "recommended";
    decisionReason = "recommended: historical signal is backed by domain overlap";
  } else if (relationship === "historical" || relationship === "nearby") {
    decision = "debug-only";
    decisionReason = "debug-only: positive signal lacks task/source domain evidence";
  }

  return {
    path: input.classification.path,
    taskDomains: input.taskDomains,
    testDomains,
    sourceDomains: input.sourceDomains,
    positiveSignals,
    negativeSignals: uniquePaths(negativeSignals),
    relationship,
    decision,
    decisionReason
  };
}

function testEvidenceForAnalysis(task: string, sourcePaths: string[], classifications: ClassifiedAffectedTest[]): TestEvidence[] {
  const taskDomains = domainsFromTask(task);
  const sourceDomains = uniquePaths(sourcePaths.flatMap(domainsFromPath));

  return classifications.map((classification) => testEvidenceForClassification({
    classification,
    taskDomains,
    sourceDomains
  }));
}

function recommendedScoredTests(scoredTests: ScoredAffectedTest[], evidence: TestEvidence[]): ScoredAffectedTest[] {
  const recommended = new Set(evidence
    .filter((item) => item.decision === "recommended")
    .map((item) => item.path));

  return scoredTests.filter((item) => recommended.has(item.path));
}

function candidateTest(item: ScoredAffectedTest, evidence: TestEvidence): CandidateTest {
  const signalSummary = evidence.positiveSignals.length > 0 ? `; evidence=${evidence.positiveSignals.join("; ")}` : "";
  const reason = `${evidence.decisionReason}; relationship=${evidence.relationship}${signalSummary}`;

  return {
    path: item.path,
    reason,
    reasons: [reason, item.reason],
    score: item.score,
    confidence: item.confidence,
    signals: item.signals,
    relationshipType: item.relationshipType,
    evidence
  };
}

export async function scoreRelationships(input: {
  cwd: string;
  task: string;
  changedFiles: string[];
  primaryFiles: CandidateFile[];
  affectedFiles: CandidateFile[];
  contextChanges: CandidateFile[];
  routeFiles: CandidateFile[];
  routeTests: CandidateFile[];
  workSourcePaths: string[];
  learnedSignals: LearnedRoutingSignals;
  docsOnlyReadmeTask: boolean;
  maxFiles: number;
}): Promise<{
  workAffectedTests: ScoredAffectedTest[];
  testCandidates: CandidateTest[];
  testEvidence: TestEvidence[];
  testClassifications: ClassifiedAffectedTest[];
  filteredLearnedSignals: LearnedRoutingSignals;
  confidence: ConfidenceInfo;
  verification: VerificationPlan;
  docsOnlyImpact: boolean;
}> {
  const workTestAnalysis = await analyzeAffectedTests({
    cwd: input.cwd,
    task: input.task,
    sourcePaths: input.workSourcePaths,
    routeTests: input.routeTests,
    learnedTests: input.learnedSignals.learnedTests,
    includeRepoTestDiscovery: false,
    maxTests: Math.min(input.maxFiles, 6)
  });
  const workTestEvidence = testEvidenceForAnalysis(input.task, input.workSourcePaths, workTestAnalysis.classifications);
  const workAffectedTests = recommendedScoredTests(workTestAnalysis.scoredTests, workTestEvidence);
  const affectedTestPaths = workAffectedTests.map((file) => file.path);
  const affectedTestSet = new Set(affectedTestPaths);
  const filteredLearnedTests = input.learnedSignals.learnedTests.filter((file) => affectedTestSet.has(file));
  const filteredLearnedVerification = input.learnedSignals.learnedVerification.filter((command) => (
    !verificationReferencesFilteredTest(command, affectedTestSet)
  ));
  const hasLearnedContext = input.learnedSignals.learnedRelatedFiles.length > 0
    || filteredLearnedTests.length > 0
    || filteredLearnedVerification.length > 0;
  const filteredLearnedSignals = {
    ...input.learnedSignals,
    learnedTests: filteredLearnedTests,
    learnedVerification: filteredLearnedVerification,
    learnedHabits: hasLearnedContext ? input.learnedSignals.learnedHabits : []
  };
  const impactSourcePaths = uniquePaths([
    ...changedSourceFiles(input.changedFiles),
    ...input.affectedFiles
      .map((file) => file.path)
      .filter((file) => !isDocsOnlyPath(file) && classifyRepoFile(file).role !== "test")
  ]);
  const impactTestAnalysis = input.docsOnlyReadmeTask ? { classifications: [], scoredTests: [] } : await analyzeAffectedTests({
    cwd: input.cwd,
    task: input.task,
    changedFiles: input.changedFiles,
    sourcePaths: impactSourcePaths,
    routeTests: input.routeTests,
    learnedTests: filteredLearnedSignals.learnedTests,
    maxTests: input.maxFiles
  });
  const impactTestEvidence = testEvidenceForAnalysis(input.task, impactSourcePaths, impactTestAnalysis.classifications);
  const impactEvidenceByPath = new Map(impactTestEvidence.map((item) => [item.path, item]));
  const testCandidates = recommendedScoredTests(impactTestAnalysis.scoredTests, impactTestEvidence)
    .map((item) => candidateTest(item, impactEvidenceByPath.get(item.path) ?? testEvidenceForClassification({
      classification: item,
      taskDomains: domainsFromTask(input.task),
      sourceDomains: uniquePaths(impactSourcePaths.flatMap(domainsFromPath))
    })));
  const confidence = confidenceExplanation(
    input.changedFiles,
    input.contextChanges,
    input.routeFiles,
    input.routeTests,
    input.affectedFiles,
    testCandidates
  );
  const verification: VerificationPlan = {
    commands: suggestedCommands(input.primaryFiles, input.changedFiles, input.affectedFiles, testCandidates),
    hints: []
  };

  return {
    workAffectedTests,
    testCandidates,
    testEvidence: impactTestEvidence,
    testClassifications: impactTestAnalysis.classifications,
    filteredLearnedSignals,
    confidence,
    verification,
    docsOnlyImpact: isDocsOnlyImpact(input.affectedFiles, testCandidates, input.changedFiles)
  };
}
