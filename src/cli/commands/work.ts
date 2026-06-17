import { stat } from "node:fs/promises";
import path from "node:path";
import { classifyRepoFile } from "../../core/repoFileClassifier";
import { listFilesRecursive, pathExists, readTextFile } from "../../core/fileSystem";
import { buildStartupContext, focusStartupContextForStart, type StartupContext } from "../../core/suggester";
import type { CliIO } from "../index";

interface WorkOptions {
  maxFiles: number;
  task: string;
}

const decisionsPath = "docs/ai-context/DECISIONS.md";
const workLogPath = "docs/ai-context/WORK_LOG.md";
const lessonsPath = "docs/ai-context/LESSONS_LEARNED.md";
const changeLogPath = "docs/ai-context/CHANGE_LOG.md";
const logLimit = 3;
const decisionLimit = 3;
const usage = 'Usage: rcc work "<task>"';
const contextFiles = [
  "AGENTS.md",
  "docs/ai-context/TASK_ROUTING.md",
  "docs/ai-context/MODULE_INDEX.md",
  "docs/ai-context/PROJECT_MAP.md",
  "docs/ai-context/RISK_REGISTER.md",
  "docs/ai-context/DEPENDENCY_MAP.md",
  "docs/ai-context/SYMBOL_MAP.md",
  "docs/ai-context/TOKEN_BUDGET.md",
  "docs/ai-context/DO_NOT_READ.md",
  "docs/ai-context/HOTSPOTS.md"
];

function parseWorkOptions(args: string[]): WorkOptions | undefined {
  let maxFiles = 50;
  const taskParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--max-files") {
      const value = Number.parseInt(args[index + 1] ?? "", 10);
      if (!Number.isInteger(value) || value < 1) {
        return undefined;
      }
      maxFiles = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return undefined;
    }

    taskParts.push(arg);
  }

  const task = taskParts.join(" ").trim();
  if (!task) {
    return undefined;
  }

  return {
    maxFiles,
    task
  };
}

function formatList(values: string[], fallback: string): string[] {
  if (values.length === 0) {
    return [`- ${fallback}`];
  }

  return values.map((value) => `- ${value}`);
}

function tokenize(value: string): string[] {
  return [...new Set(value
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((token) => token.length > 1))];
}

function compactReason(reasons: string[] | undefined): string {
  if (!reasons || reasons.length === 0) {
    return "";
  }

  return ` (${reasons.slice(0, 2).join("; ")})`;
}

function formatRecommendedFiles(startup: StartupContext): string[] {
  if (startup.likelySourceFiles.length === 0) {
    if (startup.readFirstDocs.length > 0) {
      return startup.readFirstDocs.map((file) => `- ${file}`);
    }

    const reason = startup.emptyRecommendationReasons.source
      ? ` ${startup.emptyRecommendationReasons.source}`
      : " Start from RCC context docs before broad search.";
    return [`- none.${reason}`];
  }

  return startup.likelySourceFiles.map((file) => {
    return `- ${file}${compactReason(startup.recommendationReasons[file])}`;
  });
}

function formatRecommendedTests(startup: StartupContext): string[] {
  if (startup.likelyTests.length === 0) {
    const reason = startup.emptyRecommendationReasons.test
      ? ` ${startup.emptyRecommendationReasons.test}`
      : " Find nearby tests after inspecting source.";
    return [`- none.${reason}`];
  }

  return startup.likelyTests.map((file) => {
    return `- ${file}${compactReason(startup.recommendationReasons[file])}`;
  });
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

function decisionMatches(cells: string[], startup: StartupContext): boolean {
  const haystack = cells.slice(1).join(" ").toLowerCase();
  const taskTokens = tokenize(startup.task);
  const likelyFiles = [...startup.likelySourceFiles, ...startup.likelyTests];

  return taskTokens.some((token) => haystack.includes(token))
    || likelyFiles.some((file) => file && haystack.includes(file.toLowerCase()));
}

async function readRelevantDecisions(cwd: string, startup: StartupContext): Promise<string[]> {
  const fullPath = path.join(cwd, decisionsPath);
  if (!(await pathExists(fullPath))) {
    return [];
  }

  const content = await readTextFile(fullPath);
  const rows = content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length >= 5 && cells[0] !== "Date" && !cells.every((cell) => /^-+$/.test(cell)))
    .filter((cells) => decisionMatches(cells, startup))
    .slice(-decisionLimit)
    .reverse()
    .map((cells) => `${cells[0]} | ${cells[1]} | ${cells[2]} | ${cells[3]}`);

  return dedupeEntries(rows).slice(0, decisionLimit);
}

async function readRecentLogs(cwd: string): Promise<string[]> {
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

async function fileMtimeMs(cwd: string, filePath: string): Promise<number | undefined> {
  try {
    return (await stat(path.join(cwd, filePath))).mtimeMs;
  } catch {
    return undefined;
  }
}

async function mapFreshnessLine(cwd: string): Promise<string> {
  const existingContextTimes = (await Promise.all(contextFiles.map((file) => fileMtimeMs(cwd, file))))
    .filter((value): value is number => typeof value === "number");

  if (existingContextTimes.length === 0) {
    return "unknown. run npx repo-context-center init to generate context.";
  }

  const contextTime = Math.max(...existingContextTimes);
  const repoFiles = await listFilesRecursive(cwd);
  const sourceTimes = (await Promise.all(repoFiles
    .filter((file) => {
      const role = classifyRepoFile(file).role;
      return role === "source" || role === "test";
    })
    .map((file) => fileMtimeMs(cwd, file))))
    .filter((value): value is number => typeof value === "number");
  const latestSourceTime = sourceTimes.length > 0 ? Math.max(...sourceTimes) : 0;

  if (latestSourceTime > contextTime + 1000) {
    return "stale. source files changed after context generation.";
  }

  return "fresh. generated context is available.";
}

function riskLines(startup: StartupContext): string[] {
  const lines = [`- ${startup.riskLevel}`];
  const riskReasons = startup.reasons.filter((reason) => (
    reason.includes("risk")
    || reason.includes("hotspot")
    || reason.includes("dependency")
    || reason.includes("insufficient")
  ));

  for (const reason of riskReasons.slice(0, 2)) {
    lines.push(`- ${reason}`);
  }

  if (startup.readFirstDocs.includes("docs/ai-context/RISK_REGISTER.md")) {
    lines.push("- Check docs/ai-context/RISK_REGISTER.md before editing.");
  }

  return lines;
}

function briefLines(
  startup: StartupContext,
  mapFreshness: string,
  decisions: string[],
  logs: string[],
  tokenEstimate: string
): string[] {
  const readFirst = startup.readFirstDocs.slice(0, 4);
  return [
    "repo-context-center work brief",
    "",
    "Task intent:",
    startup.task,
    "",
    "Map freshness:",
    `- ${mapFreshness}`,
    "",
    "Recommended files to inspect first:",
    ...formatRecommendedFiles(startup).slice(0, 8),
    "",
    "Relevant tests or test folders:",
    ...formatRecommendedTests(startup).slice(0, 6),
    "",
    "Relevant decisions:",
    ...formatList(decisions, "none. no matching decision was found."),
    "",
    "Recent logs:",
    ...formatList(logs, "none. no recent log was found."),
    "",
    "Token estimate:",
    `- ${tokenEstimate}`,
    "",
    "Known risks:",
    ...riskLines(startup),
    "",
    "Read first:",
    ...formatList(readFirst, "no RCC context files found; run npx repo-context-center init to install them"),
    "",
    "Fast lookup:",
    '- For targeted lookup, use: rcc find "<keyword>"',
    "- Prefer this before broad repo search when the target is unclear.",
    "",
    "Next command after meaningful work:",
    "```sh",
    'rcc done --summary "<summary>" --files "<files>" --verify "<check>"',
    "```"
  ];
}

function formatWorkBrief(
  startup: StartupContext,
  mapFreshness: string,
  decisions: string[],
  logs: string[]
): string {
  const preliminary = briefLines(startup, mapFreshness, decisions, logs, "calculating.");
  const roughTokens = Math.ceil(preliminary.join("\n").length / 4);
  const tokenEstimate = `roughly ${roughTokens} tokens for this brief.`;
  const lines = briefLines(startup, mapFreshness, decisions, logs, tokenEstimate);

  return `${lines.join("\n")}\n`;
}

export async function workCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseWorkOptions(args);
  if (!options) {
    io.stderr(`${usage}\n`);
    return 1;
  }

  const startupContext = await buildStartupContext(io.cwd, options.task, {
    maxFiles: options.maxFiles,
    genericFallbackMaxTests: 5
  });
  const focusedStartupContext = focusStartupContextForStart(startupContext, {
    maxSourceFiles: Math.min(options.maxFiles, 8),
    maxTestFiles: Math.min(options.maxFiles, 6)
  });
  const [mapFreshness, decisions, logs] = await Promise.all([
    mapFreshnessLine(io.cwd),
    readRelevantDecisions(io.cwd, focusedStartupContext),
    readRecentLogs(io.cwd)
  ]);

  io.stdout(formatWorkBrief(focusedStartupContext, mapFreshness, decisions, logs));
  return 0;
}
