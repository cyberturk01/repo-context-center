import { classifyRepoFile } from "../repoFileClassifier";
import { scoreAffectedTests, type ScoredAffectedTest } from "../../cli/shared/affectedTests";
import { uniquePaths } from "../../cli/work/taskFileRecommendations";
import type { LearnedRoutingSignals } from "../repositoryLearningRouting";
import type { CandidateFile, CandidateTest, ConfidenceInfo, VerificationCommand, VerificationPlan } from "./types";
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
  return files.some((file) => /\b(filename similarity|specific routed test name)\b/i.test(file.reason));
}

function testRelationship(tests: CandidateFile[]): ConfidenceInfo["evidence"]["testRelationship"] {
  if (tests.length === 0) {
    return "none";
  }

  return tests.some((file) => /\b(changed test file|imports affected source|repository learning|co-change history|filename similarity|same directory|same package\/module|specific routed test name)\b/i.test(file.reason))
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

function candidateTest(item: ScoredAffectedTest): CandidateTest {
  return {
    path: item.path,
    reason: item.reason,
    reasons: [item.reason],
    score: item.score,
    confidence: item.confidence,
    signals: item.signals
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
  filteredLearnedSignals: LearnedRoutingSignals;
  confidence: ConfidenceInfo;
  verification: VerificationPlan;
  docsOnlyImpact: boolean;
}> {
  const workAffectedTests = await scoreAffectedTests({
    cwd: input.cwd,
    task: input.task,
    sourcePaths: input.workSourcePaths,
    routeTests: input.routeTests,
    learnedTests: input.learnedSignals.learnedTests,
    includeRepoTestDiscovery: false,
    maxTests: Math.min(input.maxFiles, 6)
  });
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
  const scoredImpactTests = input.docsOnlyReadmeTask ? [] : await scoreAffectedTests({
    cwd: input.cwd,
    task: input.task,
    changedFiles: input.changedFiles,
    sourcePaths: impactSourcePaths,
    routeTests: input.routeTests,
    learnedTests: filteredLearnedSignals.learnedTests,
    maxTests: input.maxFiles
  });
  const testCandidates = scoredImpactTests.map(candidateTest);
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
    filteredLearnedSignals,
    confidence,
    verification,
    docsOnlyImpact: isDocsOnlyImpact(input.affectedFiles, testCandidates, input.changedFiles)
  };
}
