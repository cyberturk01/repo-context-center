import { execFile } from "node:child_process";
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

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
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
    return ["source", "config", "workflow", "package"].includes(info.role);
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
  return filePath === "AGENTS.md" || filePath.startsWith("docs/ai-context/");
}

function commandForTests(tests: ImpactFile[]): ImpactCommand[] {
  const runnable = tests
    .map((test) => test.path)
    .filter((file) => /\.test\.js$/i.test(file) || /\.spec\.js$/i.test(file))
    .slice(0, 8);

  if (runnable.length === 0) {
    return [];
  }

  return [{
    command: `node --test ${runnable.join(" ")}`,
    type: "test",
    scope: "focused",
    confidence: "high",
    reason: "run affected JavaScript tests directly"
  }];
}

function hasPackageScript(brief: WorkBrief, changedFiles: string[]): boolean {
  return changedFiles.some((file) => classifyRepoFile(file).role === "package")
    || brief.primaryFiles.some((file) => classifyRepoFile(file.path).role === "package");
}

function hasBuildRelevantChange(brief: WorkBrief, changedFiles: string[]): boolean {
  const files = uniquePaths([
    ...changedFiles,
    ...brief.primaryFiles.map((file) => file.path),
    ...brief.supportingFiles.map((file) => file.path)
  ]);

  return files.some((file) => {
    const info = classifyRepoFile(file);
    return info.language === "typescript" || ["config", "package"].includes(info.role);
  });
}

function suggestedCommands(brief: WorkBrief, changedFiles: string[], tests: ImpactFile[]): ImpactCommand[] {
  const commands: ImpactCommand[] = [
    ...commandForTests(tests)
  ];

  if (hasBuildRelevantChange(brief, changedFiles)) {
    commands.push({
      command: "npm run build",
      type: "build",
      scope: "project",
      confidence: "medium",
      reason: "verify TypeScript and generated CLI output"
    });
  }

  if (commands.length === 0 || hasPackageScript(brief, changedFiles)) {
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
  const [brief, changedFiles] = await Promise.all([
    buildWorkBriefForTask(cwd, task, { maxFiles }),
    changedRepoPaths(cwd)
  ]);
  const pairedTests = (await Promise.all(changedSourceFiles(changedFiles).map((file) => pairedTestsForSource(cwd, file)))).flat();
  const changedFilesWithReasons = changedImpactFiles(changedFiles);
  const routeFiles = routeImpactFiles(brief);
  const routeTests = routeImpactTests(brief);
  const pairedImpactTests = pairedTests.map((file) => impactFile(file, "paired with changed source file"));
  const affectedFiles = mergeImpactFiles([
    changedFilesWithReasons.filter((file) => classifyRepoFile(file.path).role !== "test"),
    routeFiles.filter((file) => !isContextScaffoldingPath(file.path))
  ], maxFiles);
  const affectedTests = mergeImpactFiles([
    changedTestFiles(changedFiles),
    pairedImpactTests,
    routeTests
  ], Math.min(maxFiles, 20));

  return {
    schemaVersion: 1,
    command: "impact",
    task,
    basis: basis(changedFiles, routeFiles),
    changedFiles: changedFilesWithReasons.slice(0, maxFiles),
    affectedFiles,
    affectedTests,
    suggestedCommands: suggestedCommands(brief, changedFiles, affectedTests),
    confidence: confidence(changedFiles, affectedFiles, affectedTests),
    notes: [
      "Heuristic MVP: combines git working-tree changes, RCC task routing, learned test signals, and simple source/test pairing.",
      "This is not a full static dependency analysis."
    ]
  };
}
