import { readFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists, writeTextFile } from "./fileSystem";

export interface ArchiveOptions {
  cwd: string;
  keep: number;
  dryRun?: boolean;
}

export interface ArchiveFileResult {
  sourcePath: string;
  archivePath: string;
  kept: number;
  archived: number;
  missing: boolean;
}

export interface ArchiveResult {
  files: ArchiveFileResult[];
}

interface TargetFile {
  sourcePath: string;
  archivePath: string;
  archiveTitle: string;
}

interface ParsedTable {
  before: string[];
  header: string;
  divider: string;
  rows: string[];
  after: string[];
}

const targetFiles: TargetFile[] = [
  {
    sourcePath: "docs/ai-context/CHANGE_LOG.md",
    archivePath: "docs/ai-context/archive/CHANGE_LOG_ARCHIVE.md",
    archiveTitle: "Change Log Archive"
  },
  {
    sourcePath: "docs/ai-context/LESSONS_LEARNED.md",
    archivePath: "docs/ai-context/archive/LESSONS_LEARNED_ARCHIVE.md",
    archiveTitle: "Lessons Learned Archive"
  }
];

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isDividerRow(line: string): boolean {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(line.trim());
}

function splitLines(content: string): string[] {
  return content.replace(/\r\n/g, "\n").split("\n");
}

function parseFirstTable(content: string): ParsedTable | undefined {
  const lines = splitLines(content);

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!isTableRow(lines[index]) || !isDividerRow(lines[index + 1])) {
      continue;
    }

    const rows: string[] = [];
    let cursor = index + 2;
    while (cursor < lines.length && isTableRow(lines[cursor])) {
      rows.push(lines[cursor]);
      cursor += 1;
    }

    return {
      before: lines.slice(0, index),
      header: lines[index],
      divider: lines[index + 1],
      rows,
      after: lines.slice(cursor)
    };
  }

  return undefined;
}

function firstCell(row: string): string {
  return row.split("|")[1]?.trim() ?? "";
}

function rowTime(row: string): number | undefined {
  const value = firstCell(row);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(time) ? undefined : time;
}

function selectRows(rows: string[], keep: number): { keptRows: string[]; archivedRows: string[] } {
  const ranked = rows.map((row, index) => ({
    row,
    index,
    time: rowTime(row)
  }));

  ranked.sort((left, right) => {
    if (left.time !== undefined && right.time !== undefined && left.time !== right.time) {
      return right.time - left.time;
    }

    if (left.time !== undefined && right.time === undefined) {
      return -1;
    }

    if (left.time === undefined && right.time !== undefined) {
      return 1;
    }

    return left.index - right.index;
  });

  return {
    keptRows: ranked.slice(0, keep).map((entry) => entry.row),
    archivedRows: ranked.slice(keep).map((entry) => entry.row)
  };
}

function renderTable(table: ParsedTable, rows: string[]): string {
  const output = [...table.before, table.header, table.divider, ...rows, ...table.after];
  return `${output.join("\n").replace(/\n+$/u, "")}\n`;
}

function renderArchive(title: string, table: ParsedTable, rows: string[], existingContent?: string): string {
  const existing = existingContent?.trimEnd();
  const existingTable = existingContent ? parseFirstTable(existingContent) : undefined;

  if (existing && existingTable) {
    return renderTable(existingTable, [...existingTable.rows, ...rows]);
  }

  if (existing) {
    return `${existing}\n\n${table.header}\n${table.divider}\n${rows.join("\n")}\n`;
  }

  return `# ${title}\n\n${table.header}\n${table.divider}\n${rows.join("\n")}\n`;
}

async function archiveFile(target: TargetFile, options: ArchiveOptions): Promise<ArchiveFileResult> {
  const sourcePath = path.join(options.cwd, target.sourcePath);
  const archivePath = path.join(options.cwd, target.archivePath);

  if (!(await pathExists(sourcePath))) {
    return {
      sourcePath: target.sourcePath,
      archivePath: target.archivePath,
      kept: 0,
      archived: 0,
      missing: true
    };
  }

  const content = await readFile(sourcePath, "utf8");
  const table = parseFirstTable(content);
  if (!table || table.rows.length <= options.keep) {
    return {
      sourcePath: target.sourcePath,
      archivePath: target.archivePath,
      kept: table?.rows.length ?? 0,
      archived: 0,
      missing: false
    };
  }

  const { keptRows, archivedRows } = selectRows(table.rows, options.keep);
  if (!options.dryRun) {
    const existingArchive = (await pathExists(archivePath)) ? await readFile(archivePath, "utf8") : undefined;
    await writeTextFile(sourcePath, renderTable(table, keptRows));
    await ensureDir(path.dirname(archivePath));
    await writeTextFile(archivePath, renderArchive(target.archiveTitle, table, archivedRows, existingArchive));
  }

  return {
    sourcePath: target.sourcePath,
    archivePath: target.archivePath,
    kept: keptRows.length,
    archived: archivedRows.length,
    missing: false
  };
}

export async function archiveContextFiles(options: ArchiveOptions): Promise<ArchiveResult> {
  if (!Number.isInteger(options.keep) || options.keep < 1) {
    throw new Error("--keep must be a positive integer");
  }

  const files = await Promise.all(targetFiles.map((target) => archiveFile(target, options)));
  return { files };
}
