import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { classifyRepoFile } from "../../core/repoFileClassifier";
import { scoreAffectedTests } from "../shared/affectedTests";
import { buildWorkBriefForTask } from "../work/buildWorkBrief";
import { uniquePaths } from "../work/taskFileRecommendations";
import type { WorkBrief, WorkRecommendation } from "../work/workTypes";
import type { ImpactAffectedTest, ImpactAnalysis, ImpactCommand, ImpactConfidenceExplanation, ImpactFile } from "./impactTypes";
import { recommendationReason } from "./impactTypes";

const execFileAsync = promisify(execFile);
const runnableNodeTestPattern = /\.(test|spec)\.[cm]?[jt]sx?$/i;

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

function isRelativeInsideRepo(relativePath: string): boolean {
  return relativePath.length > 0 && relativePath !== "." && !relativePath.startsWith("../") && relativePath !== "..";
}

export function normalizeImpactPath(filePath: string, repoRoot: string): string {
  const normalizedPath = normalizeRepoPath(filePath);
  const absoluteRepoRoot = path.resolve(repoRoot);

  if (path.isAbsolute(normalizedPath)) {
    const relativePath = normalizeRepoPath(path.relative(absoluteRepoRoot, normalizedPath));

    return isRelativeInsideRepo(relativePath) ? relativePath : normalizedPath;
  }

  const repoBasename = path.basename(absoluteRepoRoot);
  const repoBasenamePrefix = `${repoBasename}/`;

  if (repoBasename.length > 0 && normalizedPath.toLowerCase().startsWith(repoBasenamePrefix.toLowerCase())) {
    const exactCasePrefix = normalizedPath.startsWith(repoBasenamePrefix);
    const strippedPath = normalizedPath.slice(repoBasenamePrefix.length);
    const prefixedExists = existsSync(path.join(absoluteRepoRoot, normalizedPath));
    const strippedExists = existsSync(path.join(absoluteRepoRoot, strippedPath));

    if (!exactCasePrefix || !prefixedExists || strippedExists) {
      return strippedPath;
    }
  }

  return normalizedPath;
}

function statusPath(rawEntry: string): string | null {
  if (!rawEntry.trim()) {
    return null;
  }

  const pathText = rawEntry.slice(3).trim();
  const renamePath = pathText.includes(" -> ") ? pathText.split(" -> ").at(-1) : pathText;

  return renamePath ? normalizeRepoPath(renamePath) : null;
}

async function changedRepoPaths(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });

    return uniquePaths(stdout.split(/\r?\n/).map(statusPath).filter((file): file is string => Boolean(file)));
  } catch {
    return [];
  }
}

function impactFile(pathValue: string, reason: string): ImpactFile {
  return { path: pathValue, reason };
}

function impactFilesFromRecommendations(items: WorkRecommendation[], fallback: string): ImpactFile[] {
  return items.map((item) => impactFile(item.path, recommendationReason(item, fallback)));
}

function normalizeImpactFiles(files: ImpactFile[], repoRoot: string): ImpactFile[] {
  return files.map((file) => ({
    ...file,
    path: normalizeImpactPath(file.path, repoRoot)
  }));
}

function mergeImpactFiles(groups: ImpactFile[][], maxFiles: number): ImpactFile[] {
  const seen = new Set<string>();
  const merged: ImpactFile[] = [];

  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.path)) {
        continue;
      }
      seen.add(item.path);
      merged.push(item);
      if (merged.length >= maxFiles) {
        return merged;
      }
    }
  }

  return merged;
}

function changedImpactFiles(changedFiles: string[]): ImpactFile[] {
  return changedFiles
    .filter((file) => !classifyRepoFile(file).isNoise)
    .map((file) => impactFile(file, "changed in working tree"));
}

function changedSourceFiles(changedFiles: string[]): string[] {
  return changedFiles.filter((file) => {
    const info = classifyRepoFile(file);
    return !isContextScaffoldingPath(file) && ["source", "config", "workflow", "package"].includes(info.role);
  });
}

function routeImpactFiles(brief: WorkBrief): ImpactFile[] {
  return impactFilesFromRecommendations([
    ...brief.primaryFiles,
    ...brief.supportingFiles,
    ...brief.taskFiles
  ], "task route candidate");
}

function routeImpactTests(brief: WorkBrief): ImpactFile[] {
  return impactFilesFromRecommendations([
    ...brief.tests,
    ...brief.supportingTests,
    ...brief.relevantTests
  ], "task route test candidate");
}

function isContextScaffoldingPath(filePath: string): boolean {
  const normalizedPath = normalizeRepoPath(filePath);
  const lowerPath = normalizedPath.toLowerCase();

  return lowerPath === "agents.md"
    || lowerPath === "claude.md"
    || lowerPath === "gemini.md"
    || lowerPath === ".github/copilot-instructions.md"
    || lowerPath === "docs/ai-context"
    || lowerPath === ".repo-context-center"
    || lowerPath === ".cursor"
    || lowerPath.startsWith("docs/ai-context/")
    || lowerPath.startsWith(".repo-context-center/")
    || lowerPath.startsWith(".cursor/");
}

async function scoredAffectedTests(
  cwd: string,
  brief: WorkBrief,
  changedFiles: string[],
  affectedFiles: ImpactFile[],
  routeTests: ImpactFile[],
  maxFiles: number
): Promise<ImpactAffectedTest[]> {
  const sourcePaths = uniquePaths([
    ...changedSourceFiles(changedFiles),
    ...affectedFiles
      .map((file) => file.path)
      .filter((file) => !isDocsOnlyPath(file) && classifyRepoFile(file).role !== "test")
  ]);
  const scored = await scoreAffectedTests({
    cwd,
    task: brief.task,
    changedFiles,
    sourcePaths,
    routeTests,
    learnedTests: brief.learnedTests,
    maxTests: maxFiles
  });

  return scored.map((item) => ({
    path: item.path,
    reason: item.reason,
    score: item.score,
    confidence: item.confidence,
    signals: item.signals
  }));
}

function isWeakSemanticImpact(file: ImpactFile): boolean {
  return /\bweak semantic match\b/i.test(file.reason);
}

function isHighConfidenceRoutedFile(file: ImpactFile): boolean {
  if (isContextScaffoldingPath(file.path)) {
    return false;
  }

  return !isWeakSemanticImpact(file);
}

function commandForTests(tests: ImpactFile[]): ImpactCommand[] {
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

function isExplicitReadmeDocsTask(task: string): boolean {
  return /\breadme(?:\.md)?\b/i.test(task)
    && !/\bpackage\.json\b/i.test(task)
    && !/\brelease\s+analy[sz]er\b/i.test(task)
    && !/\breleaseAnalyzer\b/.test(task)
    && !/\bpublish(?:ing)?\b/i.test(task)
    && !/\bnpm\s+package\b/i.test(task)
    && !/\bworkflow\b/i.test(task);
}

function hasPackageScript(brief: WorkBrief, changedFiles: string[]): boolean {
  return changedFiles.some((file) => classifyRepoFile(file).role === "package")
    || brief.primaryFiles.some((file) => classifyRepoFile(file.path).role === "package");
}

function hasBuildRelevantChange(affectedFiles: ImpactFile[], changedFiles: string[]): boolean {
  const files = uniquePaths([
    ...changedFiles,
    ...affectedFiles.map((file) => file.path)
  ]);

  return files.some((file) => {
    const info = classifyRepoFile(file);
    return info.language === "typescript" || ["config", "package"].includes(info.role);
  });
}

function isDocsOnlyPath(filePath: string): boolean {
  const normalizedPath = normalizeRepoPath(filePath);
  const basename = path.posix.basename(normalizedPath).toLowerCase();

  return basename === "readme.md"
    || normalizedPath.startsWith("docs/")
    || basename.endsWith(".md");
}

function hasChangedNonDocsImpact(changedFiles: string[]): boolean {
  return changedFiles.some((file) => {
    const role = classifyRepoFile(file).role;
    return ["source", "config", "workflow", "package"].includes(role);
  });
}

function isDocsOnlyImpact(affectedFiles: ImpactFile[], tests: ImpactAffectedTest[], changedFiles: string[]): boolean {
  return affectedFiles.length > 0
    && tests.length === 0
    && affectedFiles.every((file) => isDocsOnlyPath(file.path))
    && !hasChangedNonDocsImpact(changedFiles);
}

function contextChangeFiles(changedFiles: ImpactFile[], routeFiles: ImpactFile[], maxFiles: number): ImpactFile[] {
  return mergeImpactFiles([
    changedFiles.filter((file) => isContextScaffoldingPath(file.path)),
    routeFiles
      .filter((file) => isContextScaffoldingPath(file.path))
      .map((file) => impactFile(file.path, file.reason === "changed in working tree" ? file.reason : `context candidate: ${file.reason}`))
  ], maxFiles);
}

function preferReadmeDocsImpact(task: string, affectedFiles: ImpactFile[], changedFiles: string[]): ImpactFile[] {
  if (!isExplicitReadmeDocsTask(task) || hasChangedNonDocsImpact(changedFiles)) {
    return affectedFiles;
  }

  const docsFiles = affectedFiles.filter((file) => isDocsOnlyPath(file.path));
  const readmeFiles = docsFiles
    .filter((file) => path.posix.basename(file.path).toLowerCase() === "readme.md")
    .sort((left, right) => {
      if (left.path === "README.md") {
        return -1;
      }
      if (right.path === "README.md") {
        return 1;
      }
      return 0;
    });

  return readmeFiles.length > 0 ? readmeFiles : docsFiles;
}

function suggestedCommands(
  brief: WorkBrief,
  changedFiles: string[],
  affectedFiles: ImpactFile[],
  tests: ImpactAffectedTest[]
): ImpactCommand[] {
  const commands: ImpactCommand[] = [
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

  if (!docsOnlyImpact && (commands.length === 0 || hasPackageScript(brief, changedFiles))) {
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

function mergeCommands(commands: ImpactCommand[]): ImpactCommand[] {
  const seen = new Set<string>();
  return commands.filter((item) => {
    if (seen.has(item.command)) {
      return false;
    }
    seen.add(item.command);
    return true;
  });
}

function basis(changedFiles: string[], routeFiles: ImpactFile[]): ImpactAnalysis["basis"] {
  if (changedFiles.length > 0 && routeFiles.length > 0) {
    return "changed-files-and-task";
  }
  if (changedFiles.length > 0) {
    return "changed-files";
  }
  return "task";
}

function hasFilenameStemMatch(files: ImpactFile[]): boolean {
  return files.some((file) => /\b(filename similarity|specific routed test name)\b/i.test(file.reason));
}

function testRelationship(tests: ImpactFile[]): ImpactConfidenceExplanation["evidence"]["testRelationship"] {
  if (tests.length === 0) {
    return "none";
  }

  return tests.some((file) => /\b(changed test file|imports affected source|repository learning|co-change history|filename similarity|same directory|same package\/module|specific routed test name)\b/i.test(file.reason))
    ? "strong"
    : "weak";
}

function confidenceExplanation(
  changedFiles: string[],
  contextChanges: ImpactFile[],
  routeFiles: ImpactFile[],
  routeTests: ImpactFile[],
  affectedFiles: ImpactFile[],
  affectedTests: ImpactFile[]
): ImpactConfidenceExplanation {
  const nonContextChangedFiles = changedFiles.filter((file) => !isContextScaffoldingPath(file));
  const taskRoutingMatched = routeFiles.length > 0 || routeTests.length > 0;
  const filenameStemMatched = hasFilenameStemMatch([...affectedFiles, ...affectedTests]);
  const contextOnlyChanges = changedFiles.length > 0
    && nonContextChangedFiles.length === 0
    && contextChanges.length > 0;
  const relationship = testRelationship(affectedTests);
  const reasons: string[] = [];
  let level: ImpactConfidenceExplanation["level"] = "low";

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

export async function buildImpactAnalysis(
  cwd: string,
  task: string,
  options: { maxFiles?: number } = {}
): Promise<ImpactAnalysis> {
  const maxFiles = options.maxFiles ?? 50;
  const repoRoot = path.resolve(cwd);
  const [brief, rawChangedFiles] = await Promise.all([
    buildWorkBriefForTask(repoRoot, task, { maxFiles }),
    changedRepoPaths(repoRoot)
  ]);
  const changedFiles = uniquePaths(rawChangedFiles.map((file) => normalizeImpactPath(file, repoRoot)));
  const changedFilesWithReasons = normalizeImpactFiles(changedImpactFiles(changedFiles), repoRoot);
  const routeFiles = normalizeImpactFiles(routeImpactFiles(brief), repoRoot);
  const routeTests = normalizeImpactFiles(routeImpactTests(brief), repoRoot);
  const highConfidenceRouteFiles = routeFiles.filter(isHighConfidenceRoutedFile);
  const contextChanges = contextChangeFiles(changedFilesWithReasons, routeFiles, maxFiles);
  const affectedFiles = mergeImpactFiles([
    changedFilesWithReasons.filter((file) => classifyRepoFile(file.path).role !== "test" && !isContextScaffoldingPath(file.path)),
    highConfidenceRouteFiles
  ], maxFiles);
  const readmeDocsImpact = preferReadmeDocsImpact(task, affectedFiles, changedFiles);
  const docsOnlyReadmeTask = readmeDocsImpact !== affectedFiles
    && readmeDocsImpact.length > 0
    && readmeDocsImpact.every((file) => isDocsOnlyPath(file.path));
  const affectedTests = docsOnlyReadmeTask ? [] : await scoredAffectedTests(
    repoRoot,
    brief,
    changedFiles,
    readmeDocsImpact,
    routeTests,
    maxFiles
  );
  const filteredWeakCount = routeFiles.filter((file) => isWeakSemanticImpact(file) && !readmeDocsImpact.some((affected) => affected.path === file.path)).length;
  const confidenceDetails = confidenceExplanation(
    changedFiles,
    contextChanges,
    routeFiles,
    routeTests,
    readmeDocsImpact,
    affectedTests
  );
  const returnedChangedFiles = changedFilesWithReasons.slice(0, maxFiles);
  const commands = suggestedCommands(brief, changedFiles, readmeDocsImpact, affectedTests);

  return {
    schemaVersion: 1,
    command: "impact",
    task,
    basis: basis(changedFiles, routeFiles),
    summary: {
      changedFiles: returnedChangedFiles.length,
      contextChanges: contextChanges.length,
      affectedFiles: readmeDocsImpact.length,
      affectedTests: affectedTests.length,
      suggestedCommands: commands.length
    },
    changedFiles: returnedChangedFiles,
    contextChanges,
    affectedFiles: readmeDocsImpact,
    affectedTests,
    suggestedCommands: commands,
    confidence: confidenceDetails.level,
    confidenceExplanation: confidenceDetails,
    verificationHints: [],
    notes: [
      "Heuristic MVP: combines git working-tree changes, RCC task routing, learned test signals, and scored affected test candidates.",
      "This is not a full static dependency analysis.",
      ...(isDocsOnlyImpact(readmeDocsImpact, affectedTests, changedFiles) ? ["Docs-only impact detected; no focused test command suggested."] : []),
      ...(filteredWeakCount > 0 ? ["Filtered weak semantic source candidates from affectedFiles."] : []),
      ...(readmeDocsImpact.length === 0 && affectedTests.length > 0 ? ["No high-confidence affected source files found."] : [])
    ]
  };
}
