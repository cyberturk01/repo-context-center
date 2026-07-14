import { spawnSync } from "node:child_process";
import path from "node:path";
import { autoArchiveWorkLog } from "../../core/archiver";
import { pathExists, readTextFile, writeTextFile } from "../../core/fileSystem";
import { evaluateLearningQuality } from "../../core/learningQuality";
import { refreshWorkMemoryArtifacts } from "../../core/workMemoryRefresh";
import {
  repositoryLearningPath,
  workIndexPath
} from "../../core/workMemory";
import type { CliIO } from "../index";

interface DoneOptions {
  dryRun: boolean;
  fileMode: "auto" | "manual" | "none";
  files: string[];
  followUps: string;
  learningMode: "auto" | "force" | "skip";
  memoryOnly: boolean;
  risk: string;
  summary: string;
  verify: string;
}

const workLogPath = "docs/ai-context/WORK_LOG.md";
const memoryStart = "<!-- repo-context-center:work-log:start -->";
const memoryEnd = "<!-- repo-context-center:work-log:end -->";
const usage = 'Usage: rcc done --summary "<summary>" [--files auto|none|"<path,path>"] [--verify "<command/result>"] [--learn|--no-learn] [--memory-only] [--dry-run]';
const helpText = [
  usage,
  "",
  "File modes:",
  "  --files auto  Detect changed files from git status (default)",
  "  --files none  Record no changed files",
  '  --files "<path,path>"  Record explicit comma-separated files',
  "",
  "Churn control:",
  "  --memory-only  Append a simple WORK_LOG.md entry only; skip WORK_INDEX.md, REPOSITORY_LEARNING.md, and handoff JSON",
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

  return { dryRun, fileMode, files, followUps, learningMode, memoryOnly, risk, summary, verify };
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

function handoffBlockJson(options: DoneOptions, files: string[], timestamp: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    summary: cleanInline(options.summary),
    files,
    verification: compactList(options.verify),
    followUps: compactList(options.followUps),
    risks: compactList(options.risk),
    timestamp
  }, null, 2);
}

function formatFiles(files: string[], emptyLabel = "_not detected_"): string {
  if (files.length === 0) {
    return emptyLabel;
  }

  return files.slice(0, 10).map((file) => `\`${cleanInline(file, 160).replace(/`/g, "")}\``).join(", ");
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

function detectChangedFiles(cwd: string): string[] {
  try {
    const result = spawnSync("git", ["status", "--short", "--untracked-files=all"], {
      cwd,
      encoding: "utf8"
    });

    if (result.status !== 0 || result.error) {
      return [];
    }

    return parseGitStatusFiles(result.stdout).filter((file) => !isRccMemoryPath(file));
  } catch {
    return [];
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

function formatEntry(options: DoneOptions, files: string[], timestamp = new Date().toISOString()): string {
  const lines = [
    `## ${timestamp}`,
    `- Summary: ${cleanInline(options.summary)}`,
    `- Changed files: ${formatFiles(files, options.fileMode === "none" ? "_none_" : "_not detected_")}`
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
    handoffBlockJson(options, files, timestamp),
    "-->",
    "```json repo-context-center:done",
    JSON.stringify({
      schemaVersion: 1,
      command: "done",
      timestamp,
      summary: cleanInline(options.summary),
      files,
      verification: options.verify ? cleanInline(options.verify) : null,
      followUps: compactList(options.followUps),
      risks: compactList(options.risk)
    }, null, 2),
    "```"
  );

  return lines.join("\n");
}

function formatSimpleEntry(options: DoneOptions, files: string[], timestamp = new Date().toISOString()): string {
  const lines = [
    `## ${timestamp}`,
    `- Summary: ${cleanInline(options.summary)}`,
    `- Changed files: ${formatFiles(files, options.fileMode === "none" ? "_none_" : "_not detected_")}`
  ];

  if (options.verify) {
    lines.push(`- Verification: ${cleanInline(options.verify)}`);
  }

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

function formatSavedMessage(options: DoneOptions, files: string[], skippedLearning: boolean, autoArchived = 0): string {
  const workIndexVerb = options.memoryOnly
    ? options.dryRun ? "would skip" : "skipped"
    : options.dryRun ? "would update" : "updated";
  const lines = [
    `Summary: ${cleanInline(options.summary)}`,
    `Changed files: ${files.length > 0 ? files.slice(0, 10).join(", ") : options.fileMode === "none" ? "none" : "not detected"}`,
    `RCC memory ${options.dryRun ? "would update" : "updated"}: ${workLogPath}`,
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
  if (autoArchived > 0) {
    lines.push(`Auto-archived ${autoArchived} older work log entries.`);
  }

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

  const detectedFiles = options.fileMode === "none"
    ? []
    : options.fileMode === "manual"
      ? options.files
      : detectChangedFiles(io.cwd);
  const files = cleanFileList(detectedFiles);
  const targetPath = path.join(io.cwd, workLogPath);
  const existing = (await pathExists(targetPath)) ? await readTextFile(targetPath) : defaultContent();
  const nextContent = appendEntry(existing, options.memoryOnly ? formatSimpleEntry(options, files) : formatEntry(options, files));
  const skippedLearning = shouldSkipRepositoryLearning(options, files);
  let autoArchived = 0;

  if (!options.dryRun) {
    await writeTextFile(targetPath, nextContent);
    if (!options.memoryOnly) {
      await refreshWorkMemoryArtifacts(io.cwd, {
        includeLowSignalLearning: options.learningMode === "force",
        workLogContent: nextContent,
        updateRepositoryLearning: !skippedLearning
      });
      const archiveResult = await autoArchiveWorkLog({
        cwd: io.cwd,
        includeLowSignalLearning: options.learningMode === "force",
        updateRepositoryLearning: !skippedLearning
      });
      autoArchived = archiveResult?.archived ?? 0;
    }
  }

  io.stdout(formatSavedMessage(options, files, skippedLearning, autoArchived));
  return 0;
}
