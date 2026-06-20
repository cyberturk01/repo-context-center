import { readFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir, pathExists, writeTextFile } from "./fileSystem";
import { upsertRepositoryLearning } from "./renderRepositoryLearning";
import { buildRepositoryLearningModel } from "./repositoryLearning";
import {
  parseWorkMemoryEntries,
  repositoryLearningPath,
  renderWorkIndex,
  workIndexPath,
  workLogArchivePath,
  workLogEnd,
  workLogPath,
  workLogStart
} from "./workMemory";

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
  updatedPaths: string[];
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

const workLogArchiveTitle = "Work Log Archive";

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

function entryTimestamp(entry: string): string {
  return entry.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? "";
}

function entryTime(entry: string): number | undefined {
  const timestamp = entryTimestamp(entry);
  const time = Date.parse(timestamp);
  return Number.isNaN(time) ? undefined : time;
}

function extractGeneratedSection(content: string, startMarker: string, endMarker: string): {
  before: string;
  entries: string[];
  after: string;
} {
  const normalized = content.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(startMarker);
  const end = normalized.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) {
    return {
      before: normalized.trimEnd(),
      entries: [],
      after: ""
    };
  }

  const body = normalized.slice(start + startMarker.length, end).trim();
  const entries = body
    ? body.split(/\n(?=##\s+)/).map((entry) => entry.trim()).filter(Boolean)
    : [];

  return {
    before: normalized.slice(0, start + startMarker.length).trimEnd(),
    entries,
    after: normalized.slice(end).trimStart()
  };
}

function selectWorkLogEntries(entries: string[], keep: number): { keptEntries: string[]; archivedEntries: string[] } {
  const ranked = entries.map((entry, index) => ({
    entry,
    index,
    time: entryTime(entry)
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
    keptEntries: ranked.slice(0, keep).map((entry) => entry.entry),
    archivedEntries: ranked.slice(keep).map((entry) => entry.entry)
  };
}

function renderWorkLog(source: ReturnType<typeof extractGeneratedSection>, entries: string[]): string {
  return [
    source.before,
    "",
    ...entries.flatMap((entry) => [entry, ""]),
    source.after || workLogEnd,
    ""
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}

function renderWorkLogArchive(entries: string[], existingContent?: string): string {
  const existing = existingContent?.trimEnd();
  const archivedEntries = existingContent
    ? extractGeneratedSection(existingContent, workLogStart, workLogEnd).entries
    : [];
  const body = [...archivedEntries, ...entries];

  if (existing && archivedEntries.length === 0) {
    return `${existing}\n\n${workLogStart}\n${body.join("\n\n")}\n${workLogEnd}\n`;
  }

  return [
    `# ${workLogArchiveTitle}`,
    "",
    "Older completed-work entries archived from WORK_LOG.md.",
    "",
    workLogStart,
    "",
    ...body.flatMap((entry) => [entry, ""]),
    workLogEnd,
    ""
  ].join("\n").replace(/\n{3,}/g, "\n\n");
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

async function readIfPresent(filePath: string): Promise<string | undefined> {
  return (await pathExists(filePath)) ? readFile(filePath, "utf8") : undefined;
}

async function writeWorkMemorySummaries(
  options: ArchiveOptions,
  workLogContent: string,
  archiveContent?: string
): Promise<string[]> {
  if (options.dryRun) {
    return [];
  }

  const entries = [
    ...parseWorkMemoryEntries(workLogContent),
    ...(archiveContent ? parseWorkMemoryEntries(archiveContent) : [])
  ];

  await writeTextFile(path.join(options.cwd, workIndexPath), renderWorkIndex(entries));
  const learningTargetPath = path.join(options.cwd, repositoryLearningPath);
  const existingLearning = await readIfPresent(learningTargetPath);
  await writeTextFile(learningTargetPath, upsertRepositoryLearning(existingLearning, buildRepositoryLearningModel({
    workLog: [workLogContent, archiveContent].filter((content): content is string => Boolean(content)).join("\n\n")
  })));
  return [workIndexPath, repositoryLearningPath];
}

async function archiveWorkLog(options: ArchiveOptions): Promise<{ result: ArchiveFileResult; updatedPaths: string[] }> {
  const sourcePath = path.join(options.cwd, workLogPath);
  const archivePath = path.join(options.cwd, workLogArchivePath);

  if (!(await pathExists(sourcePath))) {
    const existingArchive = await readIfPresent(archivePath);
    const updatedPaths = await writeWorkMemorySummaries(options, "", existingArchive);
    return {
      result: {
        sourcePath: workLogPath,
        archivePath: workLogArchivePath,
        kept: 0,
        archived: 0,
        missing: true
      },
      updatedPaths
    };
  }

  const content = await readFile(sourcePath, "utf8");
  const parsed = extractGeneratedSection(content, workLogStart, workLogEnd);
  const existingArchive = await readIfPresent(archivePath);
  if (parsed.entries.length <= options.keep) {
    const updatedPaths = await writeWorkMemorySummaries(options, content, existingArchive);
    return {
      result: {
        sourcePath: workLogPath,
        archivePath: workLogArchivePath,
        kept: parsed.entries.length,
        archived: 0,
        missing: false
      },
      updatedPaths
    };
  }

  const { keptEntries, archivedEntries } = selectWorkLogEntries(parsed.entries, options.keep);
  const nextWorkLog = renderWorkLog(parsed, keptEntries);
  const nextArchive = renderWorkLogArchive(archivedEntries, existingArchive);

  if (!options.dryRun) {
    await writeTextFile(sourcePath, nextWorkLog);
    await ensureDir(path.dirname(archivePath));
    await writeTextFile(archivePath, nextArchive);
  }
  const updatedPaths = [
    ...(!options.dryRun ? [workLogPath] : []),
    ...await writeWorkMemorySummaries(options, nextWorkLog, nextArchive)
  ];

  return {
    result: {
      sourcePath: workLogPath,
      archivePath: workLogArchivePath,
      kept: keptEntries.length,
      archived: archivedEntries.length,
      missing: false
    },
    updatedPaths
  };
}

export async function archiveContextFiles(options: ArchiveOptions): Promise<ArchiveResult> {
  if (!Number.isInteger(options.keep) || options.keep < 1) {
    throw new Error("--keep must be a positive integer");
  }

  const workLogResult = await archiveWorkLog(options);
  const files = [
    ...(await Promise.all(targetFiles.map((target) => archiveFile(target, options)))),
    workLogResult.result
  ];
  return { files, updatedPaths: workLogResult.updatedPaths };
}
