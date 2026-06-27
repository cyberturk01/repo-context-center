import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { classifyRepoFile } from "../../core/repoFileClassifier";
import { buildRepositoryLearningModelForRepo } from "../../core/repositoryLearning";

const execFileAsync = promisify(execFile);
const directTestPattern = /\.(test|spec)\.[cm]?[jt]sx?$/i;
const affectedTestScoreThreshold = 75;
const defaultMaximumAffectedTests = 5;
const maximumWalkFiles = 2000;

export type AffectedTestConfidence = "strong" | "medium" | "weak";

export interface AffectedTestCandidate {
  path: string;
  reason?: string;
}

export interface ScoredAffectedTest {
  path: string;
  reason: string;
  score: number;
  confidence: AffectedTestConfidence;
  signals: string[];
}

export interface AffectedTestScoringOptions {
  cwd: string;
  task: string;
  changedFiles?: string[];
  sourcePaths: string[];
  routeTests?: AffectedTestCandidate[];
  learnedTests?: string[];
  includeRepoTestDiscovery?: boolean;
  maxTests?: number;
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

async function pathExists(cwd: string, repoPath: string): Promise<boolean> {
  try {
    await access(path.join(cwd, repoPath));
    return true;
  } catch {
    return false;
  }
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

async function repoTestFiles(cwd: string, candidateFiles: string[], includeRepoTestDiscovery: boolean): Promise<string[]> {
  if (!includeRepoTestDiscovery) {
    return uniquePaths(candidateFiles.map(normalizeRepoPath).filter((file) => (
      classifyRepoFile(file).role === "test" || directTestPattern.test(file)
    )));
  }

  const listedFiles = await gitRepoFiles(cwd);
  const repoFiles = listedFiles.length > 0 ? listedFiles : await walkedRepoFiles(cwd);

  return uniquePaths([
    ...candidateFiles,
    ...repoFiles
  ].map(normalizeRepoPath).filter((file) => (
    classifyRepoFile(file).role === "test" || directTestPattern.test(file)
  )));
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

function sameModuleRelationship(testPath: string, sourcePaths: string[], terms: Set<string>): { score: number; direct: boolean } {
  const testScope = moduleScope(testPath);
  if (!testScope) {
    return { score: 0, direct: false };
  }

  const sameModule = sourcePaths.some((sourcePath) => moduleScope(sourcePath) === testScope);
  if (!sameModule) {
    return { score: 0, direct: false };
  }

  const scopeTokens = testScope.split(/[\/._-]+/).filter((token) => token.length > 1);
  return {
    score: 24,
    direct: scopeTokens.some((token) => terms.has(token))
  };
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

function reasonFromSignals(score: number, confidence: AffectedTestConfidence, signals: string[]): string {
  return `${confidence} confidence score ${score}: ${signals.join("; ")}`;
}

function hasDirectRelationshipSignal(signals: string[]): boolean {
  const directSignals = new Set([
    "changed test file",
    "imports affected source",
    "same directory",
    "filename similarity",
    "same package/module with task token",
    "specific routed test name"
  ]);

  return signals.some((signal) => directSignals.has(signal));
}

function confidenceForAffectedTest(score: number, signals: string[]): AffectedTestConfidence {
  if (score >= affectedTestScoreThreshold && hasDirectRelationshipSignal(signals)) {
    return "strong";
  }

  if (score >= 50) {
    return "medium";
  }

  return "weak";
}

function changedTestFiles(changedFiles: string[]): string[] {
  return changedFiles
    .filter((file) => classifyRepoFile(file).role === "test" || directTestPattern.test(file))
    .map(normalizeRepoPath);
}

export async function scoreAffectedTests(options: AffectedTestScoringOptions): Promise<ScoredAffectedTest[]> {
  const changedFiles = uniquePaths((options.changedFiles ?? []).map(normalizeRepoPath));
  const routeTests = (options.routeTests ?? []).map((file) => ({
    ...file,
    path: normalizeRepoPath(file.path)
  }));
  const learnedTests = new Set((options.learnedTests ?? []).map(normalizeRepoPath));
  const sourcePaths = uniquePaths(options.sourcePaths.map(normalizeRepoPath)).filter((file) => (
    file.length > 0 && classifyRepoFile(file).role !== "test"
  ));
  const candidatePaths = await repoTestFiles(options.cwd, [
    ...changedFiles,
    ...routeTests.map((file) => file.path),
    ...learnedTests
  ], options.includeRepoTestDiscovery ?? true);
  const terms = taskTokens(options.task);
  const changedTestSet = new Set(changedTestFiles(changedFiles));
  const routeTestSet = new Set(routeTests.map((file) => file.path));
  const learnedRouteTests = routeTests
    .filter((file) => /\blearned|repository learning|work-log\b/i.test(file.reason ?? ""))
    .map((file) => file.path);

  for (const learnedRouteTest of learnedRouteTests) {
    learnedTests.add(learnedRouteTest);
  }

  const coChangedTests = await coChangeTestSet(options.cwd, sourcePaths);

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

    const importScore = await importRelationshipScore(options.cwd, testPath, sourcePaths);
    if (importScore > 0) {
      score += importScore;
      signals.push("imports affected source");
    }

    const nameScore = filenameSimilarityScore(testPath, sourcePaths);
    if (nameScore > 0) {
      score += nameScore;
      signals.push("filename similarity");
    }

    const moduleRelationship = sameModuleRelationship(testPath, sourcePaths, terms);
    if (moduleRelationship.score > 0) {
      score += moduleRelationship.score;
      signals.push(moduleRelationship.direct ? "same package/module with task token" : "same package/module");
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

    return {
      path: testPath,
      score,
      confidence: confidenceForAffectedTest(score, signals),
      signals
    };
  }));

  const filtered = scored
    .filter((item) => item.confidence === "strong")
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, Math.min(options.maxTests ?? defaultMaximumAffectedTests, defaultMaximumAffectedTests));
  const existing = await Promise.all(filtered.map(async (item) => ({
    item,
    exists: await pathExists(options.cwd, item.path)
  })));

  return existing
    .filter((entry) => entry.exists)
    .map((entry) => entry.item)
    .map((item) => ({
      ...item,
      reason: reasonFromSignals(item.score, item.confidence, item.signals)
    }));
}
