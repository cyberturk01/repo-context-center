import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { classifyRepoFile } from "../../core/repoFileClassifier";
import { buildWorkBriefForTask } from "../work/buildWorkBrief";
import { uniquePaths } from "../work/taskFileRecommendations";
import type { WorkBrief, WorkRecommendation } from "../work/workTypes";
import type { ImpactAnalysis, ImpactCommand, ImpactFile } from "./impactTypes";
import { recommendationReason } from "./impactTypes";

const execFileAsync = promisify(execFile);
const directTestPattern = /\.(test|spec)\.[cm]?[jt]sx?$/i;
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

async function pathExists(cwd: string, repoPath: string): Promise<boolean> {
  try {
    await access(path.join(cwd, repoPath));
    return true;
  } catch {
    return false;
  }
}

function sourceStem(filePath: string): string {
  return filePath
    .replace(/^src\//, "")
    .replace(/\.[cm]?[jt]sx?$/i, "")
    .replace(/\.[^.]+$/i, "");
}

async function pairedTestsForSource(cwd: string, filePath: string): Promise<string[]> {
  const stem = sourceStem(filePath);
  const basename = path.posix.basename(stem);
  const dirname = path.posix.dirname(stem);
  const scopedStem = dirname === "." ? basename : `${dirname}/${basename}`;
  const candidates = [
    `tests/${scopedStem}.test.js`,
    `tests/${scopedStem}.test.ts`,
    `tests/${scopedStem}.spec.js`,
    `tests/${scopedStem}.spec.ts`,
    `tests/${basename}.test.js`,
    `tests/${basename}.test.ts`,
    `tests/${basename}.spec.js`,
    `tests/${basename}.spec.ts`
  ];
  const existing = await Promise.all(candidates.map(async (candidate) => (
    await pathExists(cwd, candidate) ? candidate : null
  )));

  return uniquePaths(existing.filter((candidate): candidate is string => Boolean(candidate)));
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
    command: `node --test ${runnable.join(" ")}`,
    type: "test",
    scope: "focused",
    confidence: "high",
    reason: "run affected tests directly"
  }];
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

function confidence(changedFiles: string[], affectedFiles: ImpactFile[], affectedTests: ImpactFile[]): ImpactAnalysis["confidence"] {
  if (changedFiles.length > 0 && affectedTests.length > 0) {
    return "high";
  }
  if (affectedFiles.length > 0 || affectedTests.length > 0) {
    return "medium";
  }
  return "low";
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
  const pairedTests = (await Promise.all(changedSourceFiles(changedFiles).map((file) => pairedTestsForSource(repoRoot, file)))).flat();
  const changedFilesWithReasons = normalizeImpactFiles(changedImpactFiles(changedFiles), repoRoot);
  const routeFiles = normalizeImpactFiles(routeImpactFiles(brief), repoRoot);
  const routeTests = normalizeImpactFiles(routeImpactTests(brief), repoRoot);
  const pairedImpactTests = normalizeImpactFiles(
    pairedTests.map((file) => impactFile(file, "paired with changed source file")),
    repoRoot
  );
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
  const affectedTests = docsOnlyReadmeTask ? [] : mergeImpactFiles([
    normalizeImpactFiles(changedTestFiles(changedFiles), repoRoot),
    pairedImpactTests,
    routeTests
  ], Math.min(maxFiles, 20));
  const filteredWeakCount = routeFiles.filter((file) => isWeakSemanticImpact(file) && !readmeDocsImpact.some((affected) => affected.path === file.path)).length;

  return {
    schemaVersion: 1,
    command: "impact",
    task,
    basis: basis(changedFiles, routeFiles),
    changedFiles: changedFilesWithReasons.slice(0, maxFiles),
    contextChanges,
    affectedFiles: readmeDocsImpact,
    affectedTests,
    suggestedCommands: suggestedCommands(brief, changedFiles, readmeDocsImpact, affectedTests),
    confidence: confidence(changedFiles, readmeDocsImpact, affectedTests),
    notes: [
      "Heuristic MVP: combines git working-tree changes, RCC task routing, learned test signals, and simple source/test pairing.",
      "This is not a full static dependency analysis.",
      ...(isDocsOnlyImpact(readmeDocsImpact, affectedTests, changedFiles) ? ["Docs-only impact detected; no focused test command suggested."] : []),
      ...(filteredWeakCount > 0 ? ["Filtered weak semantic source candidates from affectedFiles."] : []),
      ...(readmeDocsImpact.length === 0 && affectedTests.length > 0 ? ["No high-confidence affected source files found."] : [])
    ]
  };
}
