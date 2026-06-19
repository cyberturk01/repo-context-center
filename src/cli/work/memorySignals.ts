import path from "node:path";
import { pathExists, readTextFile } from "../../core/fileSystem";
import type { StartupContext } from "../../core/suggester";
import type { TaskIntentAnalysis } from "../../core/taskIntent";
import {
  changeLogPath,
  decisionsPath,
  decisionLimit,
  lessonsPath,
  logLimit,
  workLogPath
} from "./workConstants";
import type { TargetedLookupSignal } from "./workTypes";

interface LookupMemorySignalsOptions {
  extractRepoPaths: (value: string) => string[];
  termPattern: (term: string) => RegExp;
}

export async function lookupMemorySignals(
  cwd: string,
  terms: string[],
  options: LookupMemorySignalsOptions
): Promise<Map<string, TargetedLookupSignal>> {
  const signals = new Map<string, TargetedLookupSignal>();
  const files = [
    { path: decisionsPath, signal: "decision-memory" as const },
    { path: workLogPath, signal: "work-log" as const },
    { path: changeLogPath, signal: "work-log" as const },
    { path: lessonsPath, signal: "work-log" as const }
  ];

  for (const file of files) {
    const fullPath = path.join(cwd, file.path);
    if (!(await pathExists(fullPath))) {
      continue;
    }

    const content = await readTextFile(fullPath);
    const relevantLines = content
      .split(/\r?\n/)
      .filter((line) => terms.some((term) => options.termPattern(term).test(line)))
      .slice(-10);

    for (const line of relevantLines) {
      for (const repoPath of options.extractRepoPaths(line)) {
        if (!(await pathExists(path.join(cwd, repoPath)))) {
          continue;
        }
        if (!signals.has(repoPath) || file.signal === "decision-memory") {
          signals.set(repoPath, file.signal);
        }
      }
    }
  }

  return signals;
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

function recentTableRows(content: string, limit: number): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length >= 3 && cells[0] !== "Date" && !cells.every((cell) => /^-+$/.test(cell)))
    .slice(-limit)
    .reverse()
    .map((cells) => cells.slice(0, 4).filter(Boolean).join(" | "));
}

function recentBulletLines(content: string, limit: number): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") && !line.includes("repo-context-center:"))
    .slice(-limit)
    .reverse()
    .map((line) => line.replace(/^- /, ""));
}

function recentWorkSummaryLines(content: string, limit: number): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- Summary: "))
    .slice(-limit)
    .reverse()
    .map((line) => line.replace(/^- Summary: /, ""));
}

function normalizeEntry(entry: string): string {
  return entry
    .replace(/^[^:]+:\s*/, "")
    .replace(/^\d{4}-\d{2}-\d{2}(?:T[^\s|]+)?\s*\|\s*/, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function dedupeEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const entry of entries) {
    const key = normalizeEntry(entry);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

function decisionMatches(cells: string[], startup: StartupContext, taskIntent: TaskIntentAnalysis): boolean {
  const haystack = cells.slice(1).join(" ").toLowerCase();
  const taskTokens = taskIntent.rawTokens;
  const likelyFiles = [...startup.likelySourceFiles, ...startup.likelyTests];

  return taskTokens.some((token) => haystack.includes(token))
    || likelyFiles.some((file) => file && haystack.includes(file.toLowerCase()));
}

export async function readRelevantDecisions(
  cwd: string,
  startup: StartupContext,
  taskIntent: TaskIntentAnalysis
): Promise<string[]> {
  const fullPath = path.join(cwd, decisionsPath);
  if (!(await pathExists(fullPath))) {
    return [];
  }

  const content = await readTextFile(fullPath);
  const rows = content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length >= 5 && cells[0] !== "Date" && !cells.every((cell) => /^-+$/.test(cell)))
    .filter((cells) => decisionMatches(cells, startup, taskIntent))
    .slice(-decisionLimit)
    .reverse()
    .map((cells) => `${cells[0]} | ${cells[1]} | ${cells[2]} | ${cells[3]}`);

  return dedupeEntries(rows).slice(0, decisionLimit);
}

export async function readRecentLogs(cwd: string): Promise<string[]> {
  const entries: string[] = [];
  const logFiles = [
    { label: "Work", path: workLogPath, reader: recentWorkSummaryLines },
    { label: "Change", path: changeLogPath, reader: recentTableRows },
    { label: "Lesson", path: lessonsPath, reader: recentBulletLines }
  ];

  for (const file of logFiles) {
    const fullPath = path.join(cwd, file.path);
    if (!(await pathExists(fullPath))) {
      continue;
    }

    const content = await readTextFile(fullPath);
    for (const entry of file.reader(content, logLimit * 2)) {
      entries.push(`${file.label}: ${entry}`);
    }
  }

  return dedupeEntries(entries).slice(0, logLimit);
}
