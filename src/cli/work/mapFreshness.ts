import { stat } from "node:fs/promises";
import path from "node:path";
import { classifyRepoFile } from "../../core/repoFileClassifier";
import { listFilesRecursive, readTextFile } from "../../core/fileSystem";
import {
  changeLogPath,
  contextFiles,
  freshnessAffectedFileLimit,
  freshnessImportantRoles
} from "./workConstants";
import type { WorkMapFreshness } from "./workTypes";

interface FreshnessFileUpdate {
  path: string;
  time: number;
}

export async function fileMtimeMs(cwd: string, filePath: string): Promise<number | undefined> {
  try {
    return (await stat(path.join(cwd, filePath))).mtimeMs;
  } catch {
    return undefined;
  }
}

export function isoFromMs(value: number | undefined): string | null {
  return typeof value === "number" ? new Date(value).toISOString() : null;
}

function statusMessage(freshness: Omit<WorkMapFreshness, "message">): string {
  return `${freshness.status}. ${freshness.reason}`;
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [];
  }

  const cells: string[] = [];
  let cell = "";
  const inner = trimmed.slice(1, -1);

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === "|" && inner[index - 1] !== "\\") {
      cells.push(cell.replace(/\\\|/g, "|").replace(/`/g, "").trim());
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell.replace(/\\\|/g, "|").replace(/`/g, "").trim());
  return cells;
}

export function parsedMapGeneratedAt(content: string): number | undefined {
  const generatedRow = content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .find((cells) => cells.length >= 4 && cells[1] === "repo-context-center map --write");

  const date = generatedRow?.[0];
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return undefined;
  }

  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function contextFileUpdate(cwd: string, filePath: string): Promise<FreshnessFileUpdate | undefined> {
  const mtime = await fileMtimeMs(cwd, filePath);
  if (mtime === undefined) {
    return undefined;
  }

  if (filePath !== changeLogPath) {
    return { path: filePath, time: mtime };
  }

  try {
    const metadataTime = parsedMapGeneratedAt(await readTextFile(path.join(cwd, filePath)));
    return { path: filePath, time: Math.max(mtime, metadataTime ?? 0) };
  } catch {
    return { path: filePath, time: mtime };
  }
}

export function isFreshnessRelevantRepoFile(filePath: string): boolean {
  if (filePath.startsWith(".git/") || filePath.startsWith("docs/ai-context/archive/")) {
    return false;
  }

  const info = classifyRepoFile(filePath);
  return !info.isNoise && info.role !== "asset" && info.role !== "generated" && !contextFiles.includes(filePath as typeof contextFiles[number]);
}

export function isImportantFreshnessFile(filePath: string): boolean {
  return freshnessImportantRoles.has(classifyRepoFile(filePath).role);
}

export async function assessMapFreshness(cwd: string): Promise<WorkMapFreshness> {
  const contextUpdates = (await Promise.all(contextFiles.map((file) => contextFileUpdate(cwd, file))))
    .filter((value): value is FreshnessFileUpdate => value !== undefined);

  if (contextUpdates.length === 0) {
    const base = {
      status: "unknown" as const,
      score: 0,
      reason: "Run npx repo-context-center init to generate context.",
      latestContextUpdate: null,
      latestRelevantSourceChange: null,
      affectedFiles: [],
      affectedContextFiles: []
    };
    return { ...base, message: statusMessage(base) };
  }

  const latestContext = contextUpdates.reduce((latest, entry) => entry.time > latest.time ? entry : latest);
  const repoFiles = await listFilesRecursive(cwd);
  const relevantChanges = (await Promise.all(repoFiles
    .filter(isFreshnessRelevantRepoFile)
    .map(async (file) => {
      const time = await fileMtimeMs(cwd, file);
      return time === undefined ? undefined : { path: file, time };
    })))
    .filter((value): value is FreshnessFileUpdate => value !== undefined);
  const newerChanges = relevantChanges
    .filter((entry) => entry.time > latestContext.time + 1000)
    .sort((left, right) => right.time - left.time || left.path.localeCompare(right.path));
  const importantChanges = newerChanges.filter((entry) => isImportantFreshnessFile(entry.path));
  const latestRelevantSource = newerChanges[0] ?? relevantChanges
    .sort((left, right) => right.time - left.time || left.path.localeCompare(right.path))[0];

  if (importantChanges.length > 0) {
    const base = {
      status: "stale" as const,
      score: 35,
      reason: "Important source, config, workflow, package, or test files changed after the last context generation.",
      latestContextUpdate: isoFromMs(latestContext.time),
      latestRelevantSourceChange: isoFromMs(latestRelevantSource?.time),
      affectedFiles: importantChanges.slice(0, freshnessAffectedFileLimit).map((entry) => entry.path),
      affectedContextFiles: contextUpdates.map((entry) => entry.path)
    };
    return { ...base, message: statusMessage(base) };
  }

  if (newerChanges.length > 0) {
    const base = {
      status: "maybe_stale" as const,
      score: 68,
      reason: "Repository files changed after the last context generation, but their impact on context is unclear.",
      latestContextUpdate: isoFromMs(latestContext.time),
      latestRelevantSourceChange: isoFromMs(latestRelevantSource?.time),
      affectedFiles: newerChanges.slice(0, freshnessAffectedFileLimit).map((entry) => entry.path),
      affectedContextFiles: contextUpdates.map((entry) => entry.path)
    };
    return { ...base, message: statusMessage(base) };
  }

  const base = {
    status: "fresh" as const,
    score: 100,
    reason: "Context is newer than recent source, config, workflow, package, and test changes.",
    latestContextUpdate: isoFromMs(latestContext.time),
    latestRelevantSourceChange: isoFromMs(latestRelevantSource?.time),
    affectedFiles: [],
    affectedContextFiles: contextUpdates.map((entry) => entry.path)
  };
  return { ...base, message: statusMessage(base) };
}
