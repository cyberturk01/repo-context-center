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
  latestDoneEntry: StructuredDoneEntry | null;
  lessons: string[];
  recentTouchedFiles: string[];
  workLog: string[];
}

interface WorkLogEntry {
  changedFiles: string[];
  followUps: string[];
  risks: string[];
  summary: string | null;
  timestamp: string | null;
  verification: string | null;
}

export interface StructuredDoneEntry {
  files: string[];
  followUps: string[];
  risks: string[];
  summary: string;
  timestamp: string;
  verification: string | null;
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)
    : [];
}

function parseStructuredDoneEntry(value: unknown): StructuredDoneEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Record<string, unknown>;
  if (entry.schemaVersion !== 1 || entry.command !== "done") {
    return null;
  }

  const summary = typeof entry.summary === "string" ? entry.summary.trim() : "";
  const timestamp = typeof entry.timestamp === "string" ? entry.timestamp.trim() : "";
  if (!summary || !timestamp) {
    return null;
  }

  return {
    files: stringArray(entry.files),
    followUps: stringArray(entry.followUps),
    risks: stringArray(entry.risks),
    summary,
    timestamp,
    verification: typeof entry.verification === "string" && entry.verification.trim()
      ? entry.verification.trim()
      : null
  };
}

function structuredDoneEntries(content: string, limit = handoffSourceLimit): StructuredDoneEntry[] {
  const entries: StructuredDoneEntry[] = [];
  const pattern = /```json repo-context-center:done\s*\n(?<json>[\s\S]*?)\n```/g;

  for (const match of content.matchAll(pattern)) {
    const rawJson = match.groups?.json;
    if (!rawJson) {
      continue;
    }

    try {
      const entry = parseStructuredDoneEntry(JSON.parse(rawJson));
      if (entry) {
        entries.push(entry);
      }
    } catch {
      // Ignore malformed structured blocks and fall back to legacy parsing.
    }
  }

  return entries.slice(-limit).reverse();
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
      current = {
        changedFiles: [],
        followUps: [],
        risks: [],
        summary: null,
        timestamp: trimmed.replace(/^##\s*/, "").trim() || null,
        verification: null
      };
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
      continue;
    }

    if (trimmed.startsWith("- Verification: ")) {
      current.verification = trimmed.replace(/^- Verification:\s*/, "").trim() || null;
      continue;
    }

    if (trimmed.startsWith("- Risk: ")) {
      const risk = trimmed.replace(/^- Risk:\s*/, "").trim();
      current.risks = risk ? [risk] : [];
      continue;
    }

    if (trimmed.startsWith("- Follow-ups: ")) {
      const followUp = trimmed.replace(/^- Follow-ups:\s*/, "").trim();
      current.followUps = followUp ? [followUp] : [];
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries.slice(-limit).reverse();
}

function doneEntryFromWorkLogEntry(entry: WorkLogEntry): StructuredDoneEntry | null {
  if (!entry.summary || !entry.timestamp) {
    return null;
  }

  return {
    files: entry.changedFiles,
    followUps: entry.followUps,
    risks: entry.risks,
    summary: entry.summary,
    timestamp: entry.timestamp,
    verification: entry.verification
  };
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
  const structuredEntries = workLog ? structuredDoneEntries(workLog) : [];
  const legacyWorkLogEntries = workLog ? recentWorkLogEntries(workLog) : [];
  const doneEntries = structuredEntries.length > 0
    ? structuredEntries
    : legacyWorkLogEntries
      .map(doneEntryFromWorkLogEntry)
      .filter((entry): entry is StructuredDoneEntry => Boolean(entry));

  return {
    agents: agents?.trim() || null,
    changeLog: changeLog ? recentTableRows(changeLog) : [],
    decisions: decisions ? recentTableRows(decisions) : [],
    gitStatus: readGitStatus(cwd),
    latestDoneEntry: doneEntries[0] ?? null,
    lessons: lessons ? recentBulletLines(lessons) : [],
    recentTouchedFiles: uniqueSorted(doneEntries.flatMap((entry) => entry.files)),
    workLog: doneEntries.map((entry) => entry.summary)
  };
}
