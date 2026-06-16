import path from "node:path";
import { ensureDir, pathExists, readTextFile, writeTextFile } from "../../core/fileSystem";
import type { CliIO } from "../index";

interface DecisionAddOptions {
  decision: string;
  files: string[];
  reason: string;
  status: string;
}

interface DecisionEntry {
  date: string;
  decision: string;
  files: string;
  reason: string;
  status: string;
}

const decisionsPath = "docs/ai-context/DECISIONS.md";
const manualStart = "<!-- repo-context-center:manual-decisions:start -->";
const manualEnd = "<!-- repo-context-center:manual-decisions:end -->";
const manualHeader = "| Date | Decision | Reason | Status | Files |";
const manualDivider = "| --- | --- | --- | --- | --- |";
const usage = [
  'Usage: repo-context-center decision add "<decision>" --reason "<reason>" [--status <status>] [--files <path,path>]',
  "       repo-context-center decision list",
  '       repo-context-center decision search "<query>"'
].join("\n");

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDecisionAddOptions(args: string[]): DecisionAddOptions | undefined {
  if (args[0] !== "add") {
    return undefined;
  }

  let reason = "";
  let status = "active";
  const files: string[] = [];
  const decisionParts: string[] = [];

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--reason") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }
      reason = value.trim();
      index += 1;
      continue;
    }

    if (arg === "--status") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }
      status = value.trim();
      index += 1;
      continue;
    }

    if (arg === "--files") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }
      files.push(...value.split(",").map((file) => file.trim()).filter(Boolean));
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return undefined;
    }

    decisionParts.push(arg);
  }

  const decision = decisionParts.join(" ").trim();
  if (!decision || !reason) {
    return undefined;
  }

  return { decision, files, reason, status: status || "active" };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function unescapeCell(value: string): string {
  return value.replace(/\\\|/g, "|").replace(/`/g, "").trim();
}

function formatStatus(status: string): string {
  const normalized = escapeCell(status || "active").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatFiles(files: string[]): string {
  if (files.length === 0) {
    return "_not specified_";
  }

  return files.map(escapeCell).join(", ");
}

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeFiles(value: string): string {
  return value.split(",").map((file) => file.trim()).filter(Boolean).join(", ");
}

function isDuplicateDecision(entries: DecisionEntry[], options: DecisionAddOptions): boolean {
  const decision = normalizeText(options.decision);
  const reason = normalizeText(options.reason);
  const status = normalizeText(unescapeCell(formatStatus(options.status)));
  const files = normalizeFiles(unescapeCell(formatFiles(options.files)));

  return entries.some((entry) => (
    normalizeText(entry.decision) === decision
    && normalizeText(entry.reason) === reason
    && normalizeText(entry.status) === status
    && normalizeFiles(entry.files) === files
  ));
}

function formatRow(options: DecisionAddOptions): string {
  return [
    "|",
    todayIso(),
    "|",
    escapeCell(options.decision),
    "|",
    escapeCell(options.reason),
    "|",
    formatStatus(options.status),
    "|",
    formatFiles(options.files),
    "|"
  ].join(" ");
}

function defaultDecisionsContent(): string {
  return [
    "# Decisions",
    "",
    "Durable project decisions preserved across AI sessions.",
    ""
  ].join("\n");
}

function manualSection(row: string): string {
  return [
    manualStart,
    manualHeader,
    manualDivider,
    row,
    manualEnd
  ].join("\n");
}

function insertDecision(content: string, options: DecisionAddOptions): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\n*$/u, "\n");
  const row = formatRow(options);
  const startIndex = normalized.indexOf(manualStart);
  const endIndex = normalized.indexOf(manualEnd);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const beforeEnd = normalized.slice(0, endIndex).trimEnd();
    const afterEnd = normalized.slice(endIndex);
    return `${beforeEnd}\n${row}\n${afterEnd}`.trimEnd() + "\n";
  }

  return `${normalized.trimEnd()}\n\n${manualSection(row)}\n`;
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
      cells.push(unescapeCell(cell));
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(unescapeCell(cell));
  return cells;
}

function parseDecisions(content: string): DecisionEntry[] {
  const startIndex = content.indexOf(manualStart);
  const endIndex = content.indexOf(manualEnd);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return [];
  }

  return content
    .slice(startIndex + manualStart.length, endIndex)
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length === 5 && cells[0] !== "Date" && !cells.every((cell) => /^-+$/.test(cell.trim())))
    .map(([date, decision, reason, status, files]) => ({ date, decision, files, reason, status }));
}

function formatDecisionEntries(entries: DecisionEntry[]): string {
  return `${entries
    .map((entry) => `${entry.date} | ${entry.status} | ${entry.decision} | ${entry.reason} | ${entry.files}`)
    .join("\n")}\n`;
}

async function readDecisionEntries(cwd: string): Promise<DecisionEntry[] | undefined> {
  const targetPath = path.join(cwd, decisionsPath);
  if (!(await pathExists(targetPath))) {
    return undefined;
  }

  return parseDecisions(await readTextFile(targetPath));
}

async function addDecision(io: CliIO, args: string[]): Promise<number> {
  const options = parseDecisionAddOptions(args);
  if (!options) {
    io.stderr(`${usage}\n`);
    return 1;
  }

  const targetPath = path.join(io.cwd, decisionsPath);
  const existing = (await pathExists(targetPath))
    ? await readTextFile(targetPath)
    : defaultDecisionsContent();
  if (isDuplicateDecision(parseDecisions(existing), options)) {
    io.stdout(`Decision already exists in ${decisionsPath}\n`);
    return 0;
  }

  const nextContent = insertDecision(existing, options);

  await ensureDir(path.dirname(targetPath));
  await writeTextFile(targetPath, nextContent);

  io.stdout(`Updated ${decisionsPath}\n`);
  return 0;
}

async function listDecisions(io: CliIO): Promise<number> {
  const entries = await readDecisionEntries(io.cwd);
  if (!entries || entries.length === 0) {
    io.stdout(`No decisions recorded yet. Add one with repo-context-center decision add "<decision>" --reason "<reason>".\n`);
    return 0;
  }

  io.stdout(formatDecisionEntries(entries));
  return 0;
}

async function searchDecisions(io: CliIO, args: string[]): Promise<number> {
  const query = args.slice(1).join(" ").trim();
  if (!query) {
    io.stderr(`${usage}\n`);
    return 1;
  }

  const entries = await readDecisionEntries(io.cwd);
  if (!entries || entries.length === 0) {
    io.stdout(`No decisions recorded yet. Add one with repo-context-center decision add "<decision>" --reason "<reason>".\n`);
    return 0;
  }

  const normalizedQuery = query.toLowerCase();
  const matches = entries.filter((entry) => [
    entry.decision,
    entry.reason,
    entry.status,
    entry.files
  ].some((value) => value.toLowerCase().includes(normalizedQuery)));

  if (matches.length === 0) {
    io.stdout(`No decisions matched "${query}".\n`);
    return 0;
  }

  io.stdout(formatDecisionEntries(matches));
  return 0;
}

export async function decisionCommand(io: CliIO, args: string[] = []): Promise<number> {
  if (args[0] === "add") {
    return addDecision(io, args);
  }

  if (args[0] === "list") {
    return listDecisions(io);
  }

  if (args[0] === "search") {
    return searchDecisions(io, args);
  }

  io.stderr(`${usage}\n`);
  return 1;
}
