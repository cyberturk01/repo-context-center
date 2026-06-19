import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathExists, readTextFile } from "../../core/fileSystem";
import {
  agentsPath,
  changeLogPath,
  decisionsPath,
  handoffSourceLimit,
  lessonsPath,
  workLogPath
} from "./handoffConstants";

export interface HandoffSources {
  agents: string | null;
  changeLog: string[];
  decisions: string[];
  gitStatus: string[];
  lessons: string[];
  recentTouchedFiles: string[];
  workLog: string[];
}

interface WorkLogEntry {
  changedFiles: string[];
  summary: string | null;
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

function parseChangedFilesLine(line: string): string[] {
  const value = line.replace(/^- Changed files:\s*/, "").trim();
  if (!value || value === "_none_" || value === "_not detected_" || value === "`auto`" || value === "auto") {
    return [];
  }

  const backtickPaths = [...value.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);

  if (backtickPaths.length > 0) {
    return backtickPaths;
  }

  return value
    .split(",")
    .map((item) => item.trim().replace(/^`|`$/g, ""))
    .filter(Boolean);
}

function recentWorkLogEntries(content: string, limit = handoffSourceLimit): WorkLogEntry[] {
  const entries: WorkLogEntry[] = [];
  let current: WorkLogEntry | null = null;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      if (current) {
        entries.push(current);
      }
      current = { changedFiles: [], summary: null };
      continue;
    }

    if (!current) {
      continue;
    }

    if (trimmed.startsWith("- Summary: ")) {
      current.summary = trimmed.replace(/^- Summary:\s*/, "").trim() || null;
      continue;
    }

    if (trimmed.startsWith("- Changed files: ")) {
      current.changedFiles = parseChangedFilesLine(trimmed);
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries.slice(-limit).reverse();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
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
  const [agents, workLog, decisions, changeLog, lessons] = await Promise.all([
    readOptionalText(cwd, agentsPath),
    readOptionalText(cwd, workLogPath),
    readOptionalText(cwd, decisionsPath),
    readOptionalText(cwd, changeLogPath),
    readOptionalText(cwd, lessonsPath)
  ]);
  const workLogEntries = workLog ? recentWorkLogEntries(workLog) : [];

  return {
    agents: agents?.trim() || null,
    changeLog: changeLog ? recentTableRows(changeLog) : [],
    decisions: decisions ? recentTableRows(decisions) : [],
    gitStatus: readGitStatus(cwd),
    lessons: lessons ? recentBulletLines(lessons) : [],
    recentTouchedFiles: uniqueSorted(workLogEntries.flatMap((entry) => entry.changedFiles)),
    workLog: workLogEntries.map((entry) => entry.summary).filter((summary): summary is string => Boolean(summary))
  };
}
