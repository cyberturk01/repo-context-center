import { open, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathExists, readTextFile } from "../../core/fileSystem";
import { parseWorkMemoryEntries, type WorkMemoryEntry } from "../../core/workMemory";
import {
  agentsPath,
  changeLogPath,
  decisionsPath,
  handoffSourceLimit,
  lessonsPath,
  workEventsPath,
  workIndexPath,
  workLogPath
} from "./handoffConstants";

export interface HandoffSources {
  agents: string | null;
  changeLog: string[];
  decisions: string[];
  gitStatus: string[];
  latestDoneEntry: WorkMemoryEntry | null;
  lessons: string[];
  recentTouchedFiles: string[];
  workIndex: string[];
  workLog: string[];
}

async function readOptionalText(cwd: string, relativePath: string): Promise<string | null> {
  const fullPath = path.join(cwd, relativePath);
  if (!(await pathExists(fullPath))) {
    return null;
  }

  try {
    return await readTextFile(fullPath);
  } catch {
    return null;
  }
}

async function readOptionalTail(cwd: string, relativePath: string, maxBytes = 24000): Promise<string | null> {
  const fullPath = path.join(cwd, relativePath);
  if (!(await pathExists(fullPath))) {
    return null;
  }

  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    const fileStat = await stat(fullPath);
    const start = Math.max(0, fileStat.size - maxBytes);
    const length = fileStat.size - start;
    const buffer = Buffer.alloc(length);
    handle = await open(fullPath, "r");
    await handle.read(buffer, 0, length, start);
    return buffer.toString("utf8");
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
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

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function recentTableRows(content: string, limit = handoffSourceLimit): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length >= 3 && cells[0] !== "Date" && !isSeparatorRow(cells))
    .slice(-limit)
    .reverse()
    .map((cells) => cells.slice(0, 5).filter(Boolean).join(" | "));
}

function recentBulletLines(content: string, limit = handoffSourceLimit): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") && !line.includes("repo-context-center:"))
    .slice(-limit)
    .reverse()
    .map((line) => line.replace(/^- /, "").trim())
    .filter(Boolean);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function workIndexLines(content: string, limit = handoffSourceLimit): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") && !line.includes("repo-context-center:"))
    .slice(0, limit)
    .map((line) => line.replace(/^- /, "Work index: ").trim())
    .filter(Boolean);
}

function parseGitStatusFiles(output: string): string[] {
  const files = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const filePath = line.slice(3).trim();
      return filePath.includes(" -> ") ? filePath.split(" -> ").pop() ?? filePath : filePath;
    })
    .map((file) => file.replace(/^"|"$/g, ""))
    .filter(Boolean);

  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

function readGitStatus(cwd: string): string[] {
  try {
    const result = spawnSync("git", ["status", "--short", "--untracked-files=all"], {
      cwd,
      encoding: "utf8"
    });

    if (result.status !== 0 || result.error) {
      return [];
    }

    return parseGitStatusFiles(result.stdout);
  } catch {
    return [];
  }
}

export async function readHandoffSources(cwd: string): Promise<HandoffSources> {
  const [agents, workIndex, decisions, changeLog, lessons] = await Promise.all([
    readOptionalText(cwd, agentsPath),
    readOptionalText(cwd, workIndexPath),
    readOptionalText(cwd, decisionsPath),
    readOptionalText(cwd, changeLogPath),
    readOptionalText(cwd, lessonsPath)
  ]);
  const workEvents = await readOptionalText(cwd, workEventsPath);
  let doneEntries = workEvents ? parseWorkMemoryEntries(workEvents).slice(0, handoffSourceLimit) : [];

  const workLogTail = doneEntries.length === 0 ? await readOptionalTail(cwd, workLogPath) : null;
  doneEntries = doneEntries.length > 0
    ? doneEntries
    : workLogTail ? parseWorkMemoryEntries(workLogTail).slice(0, handoffSourceLimit) : [];

  if (doneEntries.length === 0) {
    const workLog = await readOptionalText(cwd, workLogPath);
    doneEntries = workLog ? parseWorkMemoryEntries(workLog).slice(0, handoffSourceLimit) : [];
  }

  return {
    agents: agents?.trim() || null,
    changeLog: changeLog ? recentTableRows(changeLog) : [],
    decisions: decisions ? recentTableRows(decisions) : [],
    gitStatus: readGitStatus(cwd),
    latestDoneEntry: doneEntries[0] ?? null,
    lessons: lessons ? recentBulletLines(lessons) : [],
    recentTouchedFiles: uniqueSorted(doneEntries.flatMap((entry) => entry.files)),
    workIndex: workIndex ? workIndexLines(workIndex) : [],
    workLog: doneEntries.map((entry) => entry.summary)
  };
}
