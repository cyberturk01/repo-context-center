import path from "node:path";
import { pathExists, readTextFile } from "../../core/fileSystem";
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
const memoryLimit = 3;
const usage = 'Usage: rcc work "<task>"';

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

async function readRecentMemory(cwd: string): Promise<string[]> {
  const entries: string[] = [];
  const memoryFiles = [
    { label: "Work", path: workLogPath, reader: recentWorkSummaryLines },
    { label: "Decision", path: decisionsPath, reader: recentTableRows },
    { label: "Lesson", path: lessonsPath, reader: recentBulletLines },
    { label: "Log", path: changeLogPath, reader: recentTableRows }
  ];

  for (const file of memoryFiles) {
    const fullPath = path.join(cwd, file.path);
    if (!(await pathExists(fullPath))) {
      continue;
    }

    const content = await readTextFile(fullPath);
    for (const entry of file.reader(content, memoryLimit * 3)) {
      entries.push(`${file.label}: ${entry}`);
    }
  }

  return dedupeMemory(entries).slice(0, memoryLimit);
}

function normalizeMemoryEntry(entry: string): string {
  return entry
    .replace(/^[^:]+:\s*/, "")
    .replace(/^\d{4}-\d{2}-\d{2}(?:T[^\s|]+)?\s*\|\s*/, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function dedupeMemory(entries: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const entry of entries) {
    const key = normalizeMemoryEntry(entry);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
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

function formatWorkBrief(startup: StartupContext, memory: string[]): string {
  const readFirst = startup.readFirstDocs.slice(0, 4);
  const lines = [
    "repo-context-center work brief",
    "",
    "Task intent:",
    startup.task,
    "",
    "Recommended files to inspect first:",
    ...formatRecommendedFiles(startup).slice(0, 8),
    "",
    "Relevant tests or test folders:",
    ...formatRecommendedTests(startup).slice(0, 6),
    "",
    "Recent decisions / memory:",
    ...formatList(memory, "none found"),
    "",
    "Known risks:",
    ...riskLines(startup),
    "",
    "Read first:",
    ...formatList(readFirst, "no RCC context files found; run npx repo-context-center init to install them"),
    "",
    "Next command after meaningful work:",
    'rcc done --summary "<summary>" --files "<files>" --verify "<check>"'
  ];

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
  const memory = await readRecentMemory(io.cwd);

  io.stdout(formatWorkBrief(focusedStartupContext, memory));
  return 0;
}
