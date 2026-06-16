import path from "node:path";
import { ensureDir, pathExists, readTextFile, writeTextFile } from "../../core/fileSystem";
import type { CliIO } from "../index";

interface LogOptions {
  dryRun: boolean;
  files: string[];
  summary: string;
}

const changeLogPath = "docs/ai-context/CHANGE_LOG.md";
const generatedStart = "<!-- repo-context-center:generated:start -->";
const manualHeader = "| Date | Summary | Files |";
const manualDivider = "| --- | --- | --- |";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseLogOptions(args: string[]): LogOptions | undefined {
  let dryRun = false;
  const files: string[] = [];
  const summaryParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--dry-run") {
      dryRun = true;
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

    summaryParts.push(arg);
  }

  const summary = summaryParts.join(" ").trim();
  if (!summary) {
    return undefined;
  }

  return { dryRun, files, summary };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function formatFiles(files: string[]): string {
  if (files.length === 0) {
    return "_not specified_";
  }

  return files.map((file) => `\`${escapeCell(file)}\``).join(", ");
}

function insertEntry(content: string, options: LogOptions): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\n*$/u, "\n");
  const markerIndex = normalized.indexOf(generatedStart);
  const beforeGenerated = markerIndex === -1 ? normalized : normalized.slice(0, markerIndex).trimEnd();
  const afterGenerated = markerIndex === -1 ? "" : normalized.slice(markerIndex).trimStart();
  const row = `| ${todayIso()} | ${escapeCell(options.summary)} | ${formatFiles(options.files)} |`;

  if (beforeGenerated.includes(manualHeader) && beforeGenerated.includes(manualDivider)) {
    const lines = beforeGenerated.split("\n");
    const dividerIndex = lines.findIndex((line) => line.trim() === manualDivider);
    lines.splice(dividerIndex + 1, 0, row);
    return `${lines.join("\n")}\n\n${afterGenerated}`.trimEnd() + "\n";
  }

  const manualSection = [
    beforeGenerated,
    "",
    "## Manual Entries",
    "",
    manualHeader,
    manualDivider,
    row
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");

  return `${manualSection.trimEnd()}\n\n${afterGenerated}`.trimEnd() + "\n";
}

export async function logCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseLogOptions(args);
  if (!options) {
    io.stderr('Usage: repo-context-center log "<summary>" [--files <path,path>] [--dry-run]\n');
    return 1;
  }

  const targetPath = path.join(io.cwd, changeLogPath);
  const existing = (await pathExists(targetPath))
    ? await readTextFile(targetPath)
    : "# Change Log\n\nTrack meaningful context changes.\n";
  const nextContent = insertEntry(existing, options);

  if (!options.dryRun) {
    await ensureDir(path.dirname(targetPath));
    await writeTextFile(targetPath, nextContent);
  }

  io.stdout(`${options.dryRun ? "Would update" : "Updated"} ${changeLogPath}\n`);
  return 0;
}
