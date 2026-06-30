import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { buildStartupContext, focusStartupContextForStart } from "../suggester";
import { learnedRoutingSignalsForTask } from "../repositoryLearningRouting";
import { assessMapFreshness } from "../../cli/work/mapFreshness";
import { readRecentLogs, readRelevantDecisions } from "../../cli/work/memorySignals";
import {
  buildReadFirstGuidance,
  existingReadFirstContextFiles
} from "../../cli/work/readFirstGuidance";
import { targetedLookupHints } from "../../cli/work/targetedLookup";
import { uniquePaths } from "../../cli/work/taskFileRecommendations";
import type { TaskAnalysisOptions } from "./types";
import type { TaskIntentAnalysis } from "../taskIntent";

const execFileAsync = promisify(execFile);

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

function isRelativeInsideRepo(relativePath: string): boolean {
  return relativePath.length > 0 && relativePath !== "." && !relativePath.startsWith("../") && relativePath !== "..";
}

export function normalizeTaskAnalysisPath(filePath: string, repoRoot: string): string {
  const normalizedPath = normalizeRepoPath(filePath);
  const absoluteRepoRoot = path.resolve(repoRoot);

  if (path.isAbsolute(normalizedPath)) {
    const relativePath = normalizeRepoPath(path.relative(absoluteRepoRoot, normalizedPath));

    return isRelativeInsideRepo(relativePath) ? relativePath : normalizedPath;
  }

  const repoBasename = path.basename(absoluteRepoRoot);
  const repoBasenamePrefix = `${repoBasename}/`;

  if (repoBasename.length > 0 && normalizedPath.toLowerCase().startsWith(repoBasenamePrefix.toLowerCase())) {
    const strippedPath = normalizedPath.slice(repoBasenamePrefix.length);

    return strippedPath.length > 0 ? strippedPath : normalizedPath;
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

export async function discoverCandidates(
  cwd: string,
  task: string,
  taskIntent: TaskIntentAnalysis,
  options: TaskAnalysisOptions = {}
) {
  const contextBudget = options.contextBudget ?? "balanced";
  const maxFiles = options.maxFiles ?? 50;
  const taskOnly = options.taskOnly ?? false;
  const repoRoot = path.resolve(cwd);
  const startupContext = await buildStartupContext(repoRoot, task, {
    maxFiles,
    genericFallbackMaxTests: 5
  });
  const focusedStartupContext = focusStartupContextForStart(startupContext, {
    maxSourceFiles: Math.min(maxFiles, 8),
    maxTestFiles: Math.min(maxFiles, 6)
  });
  const [mapFreshness, decisions, logs, lookupHints, learnedSignals, rawChangedFiles] = await Promise.all([
    assessMapFreshness(repoRoot),
    readRelevantDecisions(repoRoot, focusedStartupContext, taskIntent),
    readRecentLogs(repoRoot),
    targetedLookupHints(repoRoot, taskIntent, focusedStartupContext),
    learnedRoutingSignalsForTask(repoRoot, task),
    taskOnly ? Promise.resolve([]) : changedRepoPaths(repoRoot)
  ]);
  const existingContextFiles = await existingReadFirstContextFiles(repoRoot);
  const readFirstGuidance = buildReadFirstGuidance(
    focusedStartupContext,
    lookupHints,
    contextBudget,
    existingContextFiles,
    taskIntent
  );
  const changedFiles = uniquePaths(rawChangedFiles.map((file) => normalizeTaskAnalysisPath(file, repoRoot)));

  return {
    repoRoot,
    contextBudget,
    maxFiles,
    taskOnly,
    startupContext,
    focusedStartupContext,
    mapFreshness,
    decisions,
    logs,
    lookupHints,
    learnedSignals,
    readFirstGuidance,
    changedFiles
  };
}
