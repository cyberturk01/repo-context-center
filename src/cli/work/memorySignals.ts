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

const decisionFallbackLimit = 2;
const meaningfulDecisionStopTerms = new Set([
  "add",
  "after",
  "and",
  "are",
  "bug",
  "change",
  "changes",
  "command",
  "commands",
  "continue",
  "create",
  "do",
  "does",
  "done",
  "for",
  "from",
  "fix",
  "implementation",
  "implement",
  "improve",
  "into",
  "make",
  "none",
  "not",
  "only",
  "related",
  "task",
  "test",
  "tests",
  "the",
  "this",
  "update",
  "use",
  "with"
]);
const decisionModuleTerms = new Set([
  "agent",
  "build",
  "handoff",
  "json",
  "render",
  "work",
  "write"
]);

interface DecisionMatchContext {
  exactPathTerms: string[];
  fallbackTerms: Set<string>;
  queryTerms: Set<string>;
}

interface DecisionRow {
  cells: string[];
  exact: boolean;
  fallback: boolean;
  index: number;
  score: number;
}

function aliasDecisionTerm(term: string): string {
  if (term === "handover" || term === "handovers" || term === "handoffs") {
    return "handoff";
  }

  if (term === "renderer" || term === "rendering" || term === "renders") {
    return "render";
  }

  if (term === "builder" || term === "building" || term === "built") {
    return "build";
  }

  if (term === "writer" || term === "writing" || term === "written") {
    return "write";
  }

  if (term.length > 4 && term.endsWith("s")) {
    return term.slice(0, -1);
  }

  return term;
}

function splitDecisionTerms(value: string): string[] {
  const camelSplit = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

  return camelSplit
    .toLowerCase()
    .replace(/[`'"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((term) => aliasDecisionTerm(term.trim()))
    .filter(Boolean);
}

function meaningfulDecisionTerms(values: string[]): string[] {
  return [...new Set(values
    .flatMap((value) => splitDecisionTerms(value))
    .filter((term) => term.length > 2 || decisionModuleTerms.has(term))
    .filter((term) => !meaningfulDecisionStopTerms.has(term) || decisionModuleTerms.has(term)))];
}

function normalizedDecisionPath(value: string): string {
  return value
    .replace(/`/g, "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/");
}

function basenameWithoutExtension(filePath: string): string {
  const base = path.basename(filePath);
  return base.replace(/\.[^.]+$/u, "");
}

function buildDecisionMatchContext(startup: StartupContext, taskIntent: TaskIntentAnalysis): DecisionMatchContext {
  const likelyFiles = [
    ...startup.likelySourceFiles,
    ...startup.likelyTests,
    ...startup.readFirstDocs
  ].filter(Boolean);
  const taskTerms = meaningfulDecisionTerms([
    ...taskIntent.lookupTerms,
    ...taskIntent.rawTokens
  ]);
  const pathTerms = meaningfulDecisionTerms(likelyFiles);
  const basenameTerms = meaningfulDecisionTerms(likelyFiles.map(basenameWithoutExtension));
  const taskTermSet = new Set(taskTerms);
  const taskHasModuleTerm = taskTerms.some((term) => decisionModuleTerms.has(term));
  const taskMatchesRecommendedPath = [...pathTerms, ...basenameTerms].some((term) => taskTermSet.has(term));
  const useRecommendedFileTerms = taskHasModuleTerm || taskMatchesRecommendedPath;
  const recommendedPathTerms = useRecommendedFileTerms ? pathTerms : [];
  const recommendedBasenameTerms = useRecommendedFileTerms ? basenameTerms : [];
  const moduleTerms = [...new Set([
    ...taskTerms,
    ...recommendedPathTerms,
    ...recommendedBasenameTerms
  ].filter((term) => decisionModuleTerms.has(term)))];
  const queryTerms = new Set([
    ...taskTerms,
    ...recommendedPathTerms,
    ...recommendedBasenameTerms,
    ...moduleTerms
  ]);
  const fallbackTerms = new Set([
    ...taskTerms,
    ...moduleTerms
  ].filter((term) => decisionModuleTerms.has(term) || !meaningfulDecisionStopTerms.has(term)));

  return {
    exactPathTerms: useRecommendedFileTerms ? likelyFiles.map(normalizedDecisionPath).filter(Boolean) : [],
    fallbackTerms,
    queryTerms
  };
}

function decisionRowTerms(cells: string[]): Set<string> {
  return new Set(meaningfulDecisionTerms(cells.slice(1)));
}

function scoreDecisionCells(cells: string[], context: DecisionMatchContext): DecisionRow["score"] {
  const haystack = normalizedDecisionPath(cells.slice(1).join(" "));
  const rowTerms = decisionRowTerms(cells);
  let score = 0;

  for (const filePath of context.exactPathTerms) {
    if (filePath && haystack.includes(filePath)) {
      score += 8;
    }
  }

  for (const term of context.queryTerms) {
    if (rowTerms.has(term)) {
      score += decisionModuleTerms.has(term) ? 3 : 2;
    }
  }

  return score;
}

function decisionHasFallbackTerm(cells: string[], context: DecisionMatchContext): boolean {
  const rowTerms = decisionRowTerms(cells);

  for (const term of context.fallbackTerms) {
    if (decisionModuleTerms.has(term) && rowTerms.has(term)) {
      return true;
    }
  }

  return false;
}

function formatDecisionRow(cells: string[]): string {
  return `${cells[0]} | ${cells[1]} | ${cells[2]} | ${cells[3]}`;
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
  const context = buildDecisionMatchContext(startup, taskIntent);
  const rows = content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length >= 5 && cells[0] !== "Date" && !cells.every((cell) => /^-+$/.test(cell)));
  const scoredRows: DecisionRow[] = rows.map((cells, index) => {
    const score = scoreDecisionCells(cells, context);

    return {
      cells,
      exact: score > 0,
      fallback: decisionHasFallbackTerm(cells, context),
      index,
      score
    };
  });
  const exactRows = scoredRows
    .filter((row) => row.exact)
    .sort((left, right) => right.score - left.score || right.index - left.index)
    .slice(0, decisionLimit)
    .map((row) => formatDecisionRow(row.cells));

  if (exactRows.length > 0) {
    return dedupeEntries(exactRows).slice(0, decisionLimit);
  }

  if (!startup.task.trim()) {
    return [];
  }

  const fallbackRows = scoredRows
    .filter((row) => row.fallback)
    .sort((left, right) => right.index - left.index)
    .slice(0, decisionFallbackLimit)
    .map((row) => formatDecisionRow(row.cells));

  return dedupeEntries(fallbackRows).slice(0, decisionFallbackLimit);
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
