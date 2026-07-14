import { spawnSync } from "node:child_process";
import path from "node:path";
import { autoArchiveWorkLog } from "../../core/archiver";
import { pathExists, readTextFile, writeTextFile } from "../../core/fileSystem";
import { evaluateLearningQuality } from "../../core/learningQuality";
import { refreshWorkMemoryArtifacts } from "../../core/workMemoryRefresh";
import {
  appendWorkEventLine,
  evaluateWorkMemoryBudget,
  formatWorkEventLine,
  repositoryLearningPath,
  type WorkMemoryEntry,
  workEventsPath,
  workIndexPath
} from "../../core/workMemory";
import type { CliIO } from "../index";

interface DoneOptions {
  dryRun: boolean;
  fileMode: "auto" | "manual" | "none";
  files: string[];
  followUps: string;
  learningMode: "auto" | "force" | "skip";
  logFormat: "compact" | "verbose";
  memoryOnly: boolean;
  risk: string;
  summary: string;
  verify: string;
}

interface GitStatusFiles {
  files: string[];
  memoryFiles: string[];
}

const workLogPath = "docs/ai-context/WORK_LOG.md";
const memoryStart = "<!-- repo-context-center:work-log:start -->";
const memoryEnd = "<!-- repo-context-center:work-log:end -->";
const noisyAutoFileThreshold = 10;
const usage = 'Usage: rcc done --summary "<summary>" [--files auto|none|"<path,path>"] [--verify "<command/result>"] [--log-format compact|verbose] [--learn|--no-learn] [--memory-only] [--dry-run]';
const helpText = [
  usage,
  "",
  "File modes:",
  "  --files auto  Detect changed files from git status (default)",
  "  --files none  Record no changed files",
  '  --files "<path,path>"  Record explicit comma-separated files',
  "",
  "Log formats:",
  "  --log-format compact   Write one compact markdown entry (default)",
  "  --log-format verbose   Write legacy handoff JSON and done JSON blocks",
  "",
  "Churn control:",
  "  --memory-only  Append a WORK_LOG.md entry only; skip WORK_INDEX.md and REPOSITORY_LEARNING.md",
  "",
  "Learning:",
  "  --learn     Force repository learning refresh",
  "  --no-learn  Skip repository learning refresh"
].join("\n");

function parseDoneOptions(args: string[]): DoneOptions | undefined {
  let dryRun = false;
  let fileMode: DoneOptions["fileMode"] = "auto";
  let followUps = "";
  let learningMode: DoneOptions["learningMode"] = "auto";
  let logFormat: DoneOptions["logFormat"] = "compact";
  let memoryOnly = false;
  let risk = "";
  let summary = "";
  let verify = "";
  const files: string[] = [];
  const summaryParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--learn") {
      learningMode = "force";
      continue;
    }

    if (arg === "--no-learn") {
      learningMode = "skip";
      continue;
    }

    if (arg === "--memory-only") {
      memoryOnly = true;
      continue;
    }

    if (arg === "--log-format") {
      const value = args[index + 1];
      if (value !== "compact" && value !== "verbose") {
        return undefined;
      }
      logFormat = value;
      index += 1;
      continue;
    }

    if (arg === "--summary") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }
      summary = value.trim();
      index += 1;
      continue;
    }

    if (arg === "--tests" || arg === "--verify") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }
      verify = value.trim();
      index += 1;
      continue;
    }

    if (arg === "--risk" || arg === "--risks") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }
      risk = value.trim();
      index += 1;
      continue;
    }

    if (arg === "--follow-ups" || arg === "--followUps") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }
      followUps = value.trim();
      index += 1;
      continue;
    }

    if (arg === "--files") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }
      const trimmed = value.trim();
      if (trimmed === "auto" || trimmed === "none") {
        fileMode = trimmed;
      } else {
        fileMode = "manual";
        files.push(...trimmed.split(",").map((file) => file.trim()).filter(Boolean));
      }
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return undefined;
    }

    summaryParts.push(arg);
  }

  if (!summary) {
    summary = summaryParts.join(" ").trim();
  } else if (summaryParts.length > 0) {
    return undefined;
  }

  if (!summary) {
    return undefined;
  }

  return { dryRun, fileMode, files, followUps, learningMode, logFormat, memoryOnly, risk, summary, verify };
}

function cleanInline(value: string, maxLength = 300): string {
  const cleaned = value
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/<!--/g, "<! --")
    .replace(/-->/g, "-- >")
    .trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}...` : cleaned;
}

function compactList(value: string): string[] {
  const cleaned = cleanInline(value);
  return cleaned ? [cleaned] : [];
}

function cleanFileList(files: string[]): string[] {
  return files
    .map((file) => cleanInline(file, 500))
    .filter(Boolean);
}

function formatTimestamp(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function formatFiles(files: string[], emptyLabel = "_not detected_", visibleCount = 2): string {
  if (files.length === 0) {
    return emptyLabel;
  }

  const visibleFiles = files.slice(0, visibleCount).map((file) => cleanInline(file, 160).replace(/`/g, ""));
  const remainder = files.length - visibleFiles.length;
  return [
    ...visibleFiles,
    ...(remainder > 0 ? [`+${remainder}`] : [])
  ].join(", ");
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

function isRccMemoryPath(filePath: string): boolean {
  return filePath === ".repo-context-center" || filePath.startsWith(".repo-context-center/")
    || filePath === "docs/ai-context" || filePath.startsWith("docs/ai-context/");
}

function detectGitStatusFiles(cwd: string): GitStatusFiles {
  try {
    const result = spawnSync("git", ["status", "--short", "--untracked-files=all"], {
      cwd,
      encoding: "utf8"
    });

    if (result.status !== 0 || result.error) {
      return { files: [], memoryFiles: [] };
    }

    const allFiles = parseGitStatusFiles(result.stdout);
    return {
      files: allFiles.filter((file) => !isRccMemoryPath(file)),
      memoryFiles: allFiles.filter(isRccMemoryPath)
    };
  } catch {
    return { files: [], memoryFiles: [] };
  }
}

function defaultContent(): string {
  return [
    "# Work Log",
    "",
    "Lightweight RCC memory from completed agent work.",
    "",
    memoryStart,
    memoryEnd,
    ""
  ].join("\n");
}

function formatEntry(options: DoneOptions, files: string[], timestamp = formatTimestamp()): string {
  if (options.logFormat === "verbose") {
    return formatVerboseEntry(options, files, timestamp);
  }

  const lines = [
    `## ${timestamp}`,
    `- ${cleanInline(options.summary)}`,
    `- files: ${formatFiles(files, options.fileMode === "none" ? "_none_" : "_not detected_")}`
  ];

  if (options.verify) {
    lines.push(`- verify: ${cleanInline(options.verify)}`);
  }
  if (options.risk) {
    lines.push(`- risk: ${cleanInline(options.risk, 80)}`);
  }
  if (options.followUps) {
    lines.push(`- follow-ups: ${cleanInline(options.followUps)}`);
  }

  return lines.join("\n");
}

function buildWorkMemoryEntry(options: DoneOptions, files: string[], timestamp: string): WorkMemoryEntry {
  return {
    files,
    followUps: compactList(options.followUps),
    risks: compactList(options.risk),
    summary: cleanInline(options.summary),
    timestamp,
    verification: compactList(options.verify)
  };
}

function formatVerboseFiles(files: string[], options: DoneOptions): string {
  if (files.length === 0) {
    return options.fileMode === "none" ? "_none_" : "_not detected_";
  }

  return files.map((file) => `\`${cleanInline(file, 500).replace(/`/g, "")}\``).join(", ");
}

function formatVerboseEntry(options: DoneOptions, files: string[], timestamp: string): string {
  const entry = buildWorkMemoryEntry(options, files, timestamp);
  const handoffPayload = {
    schemaVersion: 1,
    summary: entry.summary,
    files: entry.files,
    verification: entry.verification,
    followUps: entry.followUps,
    risks: entry.risks,
    timestamp: entry.timestamp
  };
  const donePayload = {
    schemaVersion: 1,
    command: "done",
    timestamp: entry.timestamp,
    summary: entry.summary,
    files: entry.files,
    verification: cleanInline(options.verify),
    followUps: entry.followUps,
    risks: entry.risks
  };
  const lines = [
    `## ${timestamp}`,
    `- Summary: ${entry.summary}`,
    `- Changed files: ${formatVerboseFiles(files, options)}`
  ];

  if (options.verify) {
    lines.push(`- Verification: ${cleanInline(options.verify)}`);
  }
  if (options.risk) {
    lines.push(`- Risk: ${cleanInline(options.risk, 80)}`);
  }
  if (options.followUps) {
    lines.push(`- Follow-ups: ${cleanInline(options.followUps)}`);
  }

  lines.push(
    "<!-- rcc:handoff",
    JSON.stringify(handoffPayload, null, 2),
    "-->",
    "```json repo-context-center:done",
    JSON.stringify(donePayload, null, 2),
    "```"
  );

  return lines.join("\n");
}

function shouldSkipRepositoryLearning(options: DoneOptions, files: string[]): boolean {
  if (options.memoryOnly) {
    return true;
  }
  if (options.learningMode === "force") {
    return false;
  }
  if (options.learningMode === "skip") {
    return true;
  }

  return !evaluateLearningQuality({
    files,
    summary: options.summary,
    verification: compactList(options.verify)
  }).shouldLearn;
}

function learningStatusLine(options: DoneOptions, skippedLearning: boolean): string {
  const verb = options.dryRun
    ? skippedLearning ? "would skip" : "would update"
    : skippedLearning ? "skipped" : "updated";
  const suffix = skippedLearning && options.memoryOnly
    ? " (--memory-only)"
    : skippedLearning && options.learningMode === "auto"
    ? " (tiny/noise task; use --learn to force)"
    : skippedLearning && options.learningMode === "skip"
      ? " (--no-learn)"
      : "";

  return `RCC learning ${verb}: ${repositoryLearningPath}${suffix}`;
}

function appendEntry(content: string, entry: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\n*$/u, "\n");
  const startIndex = normalized.indexOf(memoryStart);
  const endIndex = normalized.indexOf(memoryEnd);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const beforeEnd = normalized.slice(0, endIndex).trimEnd();
    const afterEnd = normalized.slice(endIndex);
    return `${beforeEnd}\n\n${entry}\n${afterEnd}`.trimEnd() + "\n";
  }

  return `${normalized.trimEnd()}\n\n${memoryStart}\n${entry}\n${memoryEnd}\n`;
}

function formatBudgetWarning(content: string, attemptedCompaction: boolean): string | undefined {
  const budget = evaluateWorkMemoryBudget(content);
  if (budget.status === "healthy") {
    return undefined;
  }

  if (budget.status === "oversized") {
    const attempted = attemptedCompaction
      ? " Automatic compaction/archive was attempted; run `rcc archive --keep 50 --compact-work-log` if this warning remains."
      : " Run `rcc archive --keep 50 --compact-work-log` to compact/archive it.";
    return `Warning: ${workLogPath} is about ${budget.estimatedTokens} tokens, above the ${budget.compactThreshold} token compact/archive threshold.${attempted}`;
  }

  return `Warning: ${workLogPath} is about ${budget.estimatedTokens} tokens, above the ${budget.warnThreshold} token warning threshold. RCC will try to compact/archive above ${budget.compactThreshold} tokens.`;
}

function formatDryRunBudgetStatus(content: string): string[] {
  const budget = evaluateWorkMemoryBudget(content);
  const archiveAction = budget.status === "oversized"
    ? "A normal run would attempt WORK_LOG compact/archive due to token budget."
    : "A normal run would not compact/archive WORK_LOG by token budget.";

  return [
    `RCC memory budget: ${workLogPath} would be ${budget.status} (~${budget.estimatedTokens} tokens; warn ${budget.warnThreshold}, compact ${budget.compactThreshold}).`,
    archiveAction
  ];
}

function autoFileWarnings(options: DoneOptions, statusFiles: GitStatusFiles): string[] {
  if (options.fileMode !== "auto") {
    return [];
  }

  const warnings: string[] = [];
  if (statusFiles.files.length > noisyAutoFileThreshold) {
    warnings.push(`Warning: --files auto detected ${statusFiles.files.length} changed non-RCC files. Manual --files is safer for commit-clean workflows.`);
  }
  if (statusFiles.memoryFiles.length > 0) {
    warnings.push(`Warning: --files auto excluded ${statusFiles.memoryFiles.length} RCC memory file${statusFiles.memoryFiles.length === 1 ? "" : "s"}; use manual --files when you need a commit-clean record.`);
  }

  return warnings;
}

function formatSavedMessage(
  options: DoneOptions,
  files: string[],
  skippedLearning: boolean,
  autoArchived = 0,
  autoCompacted = 0,
  budgetWarning?: string,
  warnings: string[] = [],
  dryRunBudgetStatus: string[] = []
): string {
  const workIndexVerb = options.memoryOnly
    ? options.dryRun ? "would skip" : "skipped"
    : options.dryRun ? "would update" : "updated";
  const lines = [
    `Summary: ${cleanInline(options.summary)}`,
    `Changed files: ${files.length > 0 ? files.slice(0, 10).join(", ") : options.fileMode === "none" ? "none" : "not detected"}`,
    `RCC memory ${options.dryRun ? "would update" : "updated"}: ${workLogPath}; ${workEventsPath}`,
    `RCC work index ${workIndexVerb}: ${workIndexPath}${options.memoryOnly ? " (--memory-only)" : ""}`,
    learningStatusLine(options, skippedLearning)
  ];

  if (options.verify) {
    lines.push(`Verification: ${cleanInline(options.verify)}`);
  }
  if (options.risk) {
    lines.push(`Risk: ${cleanInline(options.risk, 80)}`);
  }
  if (options.followUps) {
    lines.push(`Follow-ups: ${cleanInline(options.followUps)}`);
  }
  lines.push(...dryRunBudgetStatus);
  if (autoArchived > 0) {
    lines.push(`Auto-archived ${autoArchived} older work log entries.`);
  }
  if (autoCompacted > 0) {
    lines.push(`Auto-compacted ${autoCompacted} verbose work log entries.`);
  }
  if (budgetWarning) {
    lines.push(budgetWarning);
  }
  lines.push(...warnings);

  return `${lines.join("\n")}\n`;
}

export async function doneCommand(io: CliIO, args: string[] = []): Promise<number> {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    io.stdout(`${helpText}\n`);
    return 0;
  }

  const options = parseDoneOptions(args);
  if (!options) {
    io.stderr(`${usage}\n`);
    return 1;
  }

  const statusFiles = options.fileMode === "auto" ? detectGitStatusFiles(io.cwd) : { files: [], memoryFiles: [] };
  const detectedFiles = options.fileMode === "none"
    ? []
    : options.fileMode === "manual"
      ? options.files
      : statusFiles.files;
  const files = cleanFileList(detectedFiles);
  const targetPath = path.join(io.cwd, workLogPath);
  const eventsTargetPath = path.join(io.cwd, workEventsPath);
  const existing = (await pathExists(targetPath)) ? await readTextFile(targetPath) : defaultContent();
  const existingEvents = (await pathExists(eventsTargetPath)) ? await readTextFile(eventsTargetPath) : "";
  const timestamp = formatTimestamp();
  const entry = buildWorkMemoryEntry(options, files, timestamp);
  const nextContent = appendEntry(existing, formatEntry(options, files, timestamp));
  const nextEventsContent = appendWorkEventLine(existingEvents, formatWorkEventLine(entry));
  const skippedLearning = shouldSkipRepositoryLearning(options, files);
  const warnings = autoFileWarnings(options, statusFiles);
  let autoArchived = 0;
  let autoCompacted = 0;
  let finalWorkLogContent = nextContent;
  let attemptedBudgetCompaction = false;

  if (!options.dryRun) {
    await writeTextFile(targetPath, nextContent);
    await writeTextFile(eventsTargetPath, nextEventsContent);
    if (!options.memoryOnly) {
      await refreshWorkMemoryArtifacts(io.cwd, {
        includeLowSignalLearning: options.learningMode === "force",
        workEventsContent: nextEventsContent,
        workLogContent: nextContent,
        updateRepositoryLearning: !skippedLearning
      });
      const archiveResult = await autoArchiveWorkLog({
        cwd: io.cwd,
        includeLowSignalLearning: options.learningMode === "force",
        trigger: evaluateWorkMemoryBudget(nextContent).status === "oversized" ? 0 : undefined,
        updateRepositoryLearning: !skippedLearning
      });
      attemptedBudgetCompaction = evaluateWorkMemoryBudget(nextContent).status === "oversized";
      autoArchived = archiveResult?.archived ?? 0;
      autoCompacted = archiveResult?.compacted ?? 0;
      if (archiveResult) {
        finalWorkLogContent = await readTextFile(targetPath);
      }
    }
  }

  const budgetWarning = formatBudgetWarning(
    finalWorkLogContent,
    attemptedBudgetCompaction || autoArchived > 0 || autoCompacted > 0
  );
  io.stdout(formatSavedMessage(
    options,
    files,
    skippedLearning,
    autoArchived,
    autoCompacted,
    budgetWarning,
    warnings,
    options.dryRun ? formatDryRunBudgetStatus(nextContent) : []
  ));
  return 0;
}
