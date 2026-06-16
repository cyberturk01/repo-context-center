import path from "node:path";
import { ensureDir, pathExists, readTextFile, writeTextFile } from "../../core/fileSystem";
import type { CliIO } from "../index";

interface DecisionAddOptions {
  decision: string;
  files: string[];
  reason: string;
  status: string;
}

const decisionsPath = "docs/ai-context/DECISIONS.md";
const manualStart = "<!-- repo-context-center:manual-decisions:start -->";
const manualEnd = "<!-- repo-context-center:manual-decisions:end -->";
const manualHeader = "| Date | Decision | Reason | Status | Files |";
const manualDivider = "| --- | --- | --- | --- | --- |";

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

export async function decisionCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseDecisionAddOptions(args);
  if (!options) {
    io.stderr('Usage: repo-context-center decision add "<decision>" --reason "<reason>" [--status <status>] [--files <path,path>]\n');
    return 1;
  }

  const targetPath = path.join(io.cwd, decisionsPath);
  const existing = (await pathExists(targetPath))
    ? await readTextFile(targetPath)
    : defaultDecisionsContent();
  const nextContent = insertDecision(existing, options);

  await ensureDir(path.dirname(targetPath));
  await writeTextFile(targetPath, nextContent);

  io.stdout(`Updated ${decisionsPath}\n`);
  return 0;
}
