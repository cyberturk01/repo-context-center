import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { classifyRepoFile } from "../../core/repoFileClassifier";
import { buildRepositoryLearningModelForRepo } from "../../core/repositoryLearning";
import { buildWorkBriefForTask } from "../work/buildWorkBrief";
import { uniquePaths } from "../work/taskFileRecommendations";
import type { WorkBrief, WorkRecommendation } from "../work/workTypes";
import type { ImpactAnalysis, ImpactCommand, ImpactConfidenceExplanation, ImpactFile } from "./impactTypes";
import { recommendationReason } from "./impactTypes";

const execFileAsync = promisify(execFile);
const directTestPattern = /\.(test|spec)\.[cm]?[jt]sx?$/i;
const runnableNodeTestPattern = /\.(test|spec)\.[cm]?[jt]sx?$/i;
const affectedTestScoreThreshold = 75;
const maximumAffectedTests = 5;
const maximumWalkFiles = 2000;

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

async function pathExists(cwd: string, repoPath: string): Promise<boolean> {
  try {
    await access(path.join(cwd, repoPath));
    return true;
  } catch {
    return false;
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

function changedTestFiles(changedFiles: string[]): ImpactFile[] {
  return changedFiles
    .filter((file) => classifyRepoFile(file).role === "test" || directTestPattern.test(file))
    .map((file) => impactFile(file, "changed test file"));
}

async function gitRepoFiles(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
      cwd,
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });

    return stdout.split(/\r?\n/).map(normalizeRepoPath).filter(Boolean);
  } catch {
    return [];
  }
}

async function walkedRepoFiles(cwd: string): Promise<string[]> {
  const files: string[] = [];
  const ignoredDirs = new Set([".git", "node_modules", "dist", "coverage", "build", ".cache", ".turbo"]);

  async function walk(relativeDir: string): Promise<void> {
    if (files.length >= maximumWalkFiles) {
      return;
    }

    let entries;
    try {
      entries = await readdir(path.join(cwd, relativeDir), { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const repoPath = normalizeRepoPath(path.posix.join(relativeDir, entry.name));
      if (!repoPath) {
        continue;
      }
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name) && !classifyRepoFile(repoPath).isNoise) {
          await walk(repoPath);
        }
        continue;
      }
      if (entry.isFile()) {
        files.push(repoPath);
      }
      if (files.length >= maximumWalkFiles) {
        return;
      }
    }
  }

  await walk("");
  return files;
}

async function repoTestFiles(cwd: string, changedFiles: string[], routedTests: ImpactFile[]): Promise<string[]> {
  const listedFiles = await gitRepoFiles(cwd);
  const repoFiles = listedFiles.length > 0 ? listedFiles : await walkedRepoFiles(cwd);

  return uniquePaths([
    ...changedFiles,
    ...routedTests.map((file) => file.path),
    ...repoFiles
  ].map(normalizeRepoPath).filter((file) => (
    classifyRepoFile(file).role === "test" || directTestPattern.test(file)
  )));
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

function stripExtension(filePath: string): string {
  return filePath
    .replace(/\.(test|spec)\.[cm]?[jt]sx?$/i, "")
    .replace(/\.[cm]?[jt]sx?$/i, "")
    .replace(/\.[^.]+$/i, "");
}

function comparableStem(filePath: string): string {
  return stripExtension(normalizeRepoPath(filePath))
    .replace(/^src\//, "")
    .replace(/^tests?\//, "")
    .replace(/^__tests__\//, "");
}

function pathTokens(filePath: string): Set<string> {
  return new Set(comparableStem(filePath)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[\/._\-\s]+/)
    .filter((token) => token.length > 1 && !["src", "test", "tests", "spec", "__tests__"].includes(token)));
}

function taskTokens(task: string): Set<string> {
  const generic = new Set([
    "add",
    "change",
    "fix",
    "improve",
    "test",
    "tests",
    "update",
    "work"
  ]);

  return new Set((task.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? [])
    .flatMap((term) => term.split(/[._-]+/))
    .filter((term) => term.length > 1 && !generic.has(term)));
}

function taskTestNameScore(testPath: string, terms: Set<string>): number {
  if (terms.size === 0) {
    return 0;
  }

  const shared = [...pathTokens(testPath)].filter((token) => terms.has(token)).length;
  return shared > 0 ? Math.min(28, 16 + shared * 6) : 0;
}

function filenameSimilarityScore(testPath: string, sourcePaths: string[]): number {
  const testTokens = pathTokens(testPath);
  let bestScore = 0;

  for (const sourcePath of sourcePaths) {
    const sourceTokens = pathTokens(sourcePath);
    const shared = [...testTokens].filter((token) => sourceTokens.has(token)).length;
    if (shared === 0) {
      continue;
    }

    const exactStem = comparableStem(testPath).toLowerCase() === comparableStem(sourcePath).toLowerCase();
    const union = new Set([...testTokens, ...sourceTokens]).size || 1;
    const score = exactStem ? 42 : Math.min(34, 10 + Math.round((shared / union) * 32));
    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}

function sameDirectoryScore(testPath: string, sourcePaths: string[]): number {
  const testDir = path.posix.dirname(comparableStem(testPath));
  if (testDir === ".") {
    return 0;
  }

  return sourcePaths.some((sourcePath) => path.posix.dirname(comparableStem(sourcePath)) === testDir) ? 22 : 0;
}

function moduleScope(filePath: string): string {
  const parts = comparableStem(filePath).split("/").filter(Boolean);
  if (parts[0] === "packages" && parts.length >= 2) {
    return parts.slice(0, 2).join("/");
  }
  return parts[0] ?? "";
}

function sameModuleScore(testPath: string, sourcePaths: string[]): number {
  const testScope = moduleScope(testPath);
  if (!testScope) {
    return 0;
  }

  return sourcePaths.some((sourcePath) => moduleScope(sourcePath) === testScope) ? 24 : 0;
}

async function importRelationshipScore(cwd: string, testPath: string, sourcePaths: string[]): Promise<number> {
  let content;
  try {
    content = await readFile(path.join(cwd, testPath), "utf8");
  } catch {
    return 0;
  }

  const normalizedContent = content.replace(/\\/g, "/");
  const testDir = path.posix.dirname(testPath);

  for (const sourcePath of sourcePaths) {
    const sourceNoExt = stripExtension(sourcePath);
    const relativeNoExt = normalizeRepoPath(path.posix.relative(testDir, sourceNoExt));
    const fragments = [
      sourceNoExt,
      `./${relativeNoExt}`,
      relativeNoExt,
      path.posix.basename(sourceNoExt)
    ].filter((fragment) => fragment.length > 1);

    if (fragments.some((fragment) => normalizedContent.includes(fragment))) {
      return 48;
    }
  }

  return 0;
}

function learnedTestSet(brief: WorkBrief, routeTests: ImpactFile[]): Set<string> {
  return new Set([
    ...brief.learnedTests,
    ...routeTests
      .filter((file) => /\blearned|repository learning|work-log\b/i.test(file.reason))
      .map((file) => file.path)
  ].map(normalizeRepoPath));
}

async function coChangeTestSet(cwd: string, sourcePaths: string[]): Promise<Set<string>> {
  const model = await buildRepositoryLearningModelForRepo(cwd);
  const sourceSet = new Set(sourcePaths.map(normalizeRepoPath));
  const tests = new Set<string>();

  for (const item of model.frequentlyModifiedTogether) {
    if (item.count < 2 || !item.files.some((file) => sourceSet.has(normalizeRepoPath(file)))) {
      continue;
    }

    for (const file of item.files.map(normalizeRepoPath)) {
      if (classifyRepoFile(file).role === "test" || directTestPattern.test(file)) {
        tests.add(file);
      }
    }
  }

  return tests;
}

function reasonFromSignals(score: number, signals: string[]): string {
  return `confidence score ${score}: ${signals.join("; ")}`;
}

function hasStrongAffectedTestSignals(signals: string[]): boolean {
  const strongSignals = new Set([
    "changed test file",
    "imports affected source",
    "repository learning",
    "co-change history"
  ]);

  if (signals.some((signal) => strongSignals.has(signal))) {
    return true;
  }

  const corroboratingLocalSignals = signals.filter((signal) => [
    "same package/module",
    "same directory",
    "filename similarity",
    "specific routed test name"
  ].includes(signal));

  return signals.includes("task routing evidence")
    && corroboratingLocalSignals.length >= 1;
}

async function scoredAffectedTests(
  cwd: string,
  brief: WorkBrief,
  changedFiles: string[],
  affectedFiles: ImpactFile[],
  routeTests: ImpactFile[],
  maxFiles: number
): Promise<ImpactFile[]> {
  const candidatePaths = await repoTestFiles(cwd, changedFiles, routeTests);
  const terms = taskTokens(brief.task);
  const changedTestSet = new Set(changedTestFiles(changedFiles).map((file) => file.path));
  const routeTestSet = new Set(routeTests.map((file) => file.path));
  const learnedTests = learnedTestSet(brief, routeTests);
  const sourcePaths = uniquePaths([
    ...changedSourceFiles(changedFiles),
    ...affectedFiles
      .map((file) => file.path)
      .filter((file) => !isDocsOnlyPath(file) && classifyRepoFile(file).role !== "test")
  ]);
  const coChangedTests = await coChangeTestSet(cwd, sourcePaths);

  const scored = await Promise.all(candidatePaths.map(async (testPath) => {
    let score = 0;
    const signals: string[] = [];

    if (changedTestSet.has(testPath)) {
      score += 100;
      signals.push("changed test file");
    }
    if (routeTestSet.has(testPath)) {
      score += 40;
      signals.push("task routing evidence");
    }
    const taskNameScore = routeTestSet.has(testPath) ? taskTestNameScore(testPath, terms) : 0;
    if (taskNameScore > 0) {
      score += taskNameScore;
      signals.push("task/test name match");
    }
    if (routeTestSet.has(testPath) && taskNameScore >= 22) {
      score += 20;
      signals.push("specific routed test name");
    }
    if (learnedTests.has(testPath)) {
      score += 58;
      signals.push("repository learning");
    }
    if (coChangedTests.has(testPath)) {
      score += 46;
      signals.push("co-change history");
    }

    const importScore = await importRelationshipScore(cwd, testPath, sourcePaths);
    if (importScore > 0) {
      score += importScore;
      signals.push("imports affected source");
    }

    const nameScore = filenameSimilarityScore(testPath, sourcePaths);
    if (nameScore > 0) {
      score += nameScore;
      signals.push("filename similarity");
    }

    const moduleScore = sameModuleScore(testPath, sourcePaths);
    if (moduleScore > 0) {
      score += moduleScore;
      signals.push("same package/module");
    }

    const directoryScore = sameDirectoryScore(testPath, sourcePaths);
    if (directoryScore > 0) {
      score += directoryScore;
      signals.push("same directory");
    }

    if (signals.length === 1 && signals[0] === "task routing evidence") {
      score -= 30;
      signals.push("weak generic route penalty");
    }

    return { path: testPath, score, signals };
  }));

  return scored
    .filter((item) => item.score >= affectedTestScoreThreshold && hasStrongAffectedTestSignals(item.signals))
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, Math.min(maxFiles, maximumAffectedTests))
    .map((item) => impactFile(item.path, reasonFromSignals(item.score, item.signals)));
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

function isDocsOnlyImpact(affectedFiles: ImpactFile[], tests: ImpactFile[], changedFiles: string[]): boolean {
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
  tests: ImpactFile[]
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
    notes: [
      "Heuristic MVP: combines git working-tree changes, RCC task routing, learned test signals, and scored affected test candidates.",
      "This is not a full static dependency analysis.",
      ...(isDocsOnlyImpact(readmeDocsImpact, affectedTests, changedFiles) ? ["Docs-only impact detected; no focused test command suggested."] : []),
      ...(filteredWeakCount > 0 ? ["Filtered weak semantic source candidates from affectedFiles."] : []),
      ...(readmeDocsImpact.length === 0 && affectedTests.length > 0 ? ["No high-confidence affected source files found."] : [])
    ]
  };
}
