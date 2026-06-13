import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { contextArchiveDir } from "./contextFiles";
import { pathExists, readTextFile } from "./fileSystem";
import { suggestContext } from "./suggester";

export type EstimateMode = "compact" | "investigation" | "detailed";

export interface FileTokenEstimate {
  path: string;
  tokens: number;
  missing?: boolean;
}

export interface TaskTokenEstimate {
  task: string;
  recommendedContextTokens: number;
  likelySourceTokens: number;
  likelyTestTokens: number;
  recommendedContextFiles: FileTokenEstimate[];
  likelySourceFiles: FileTokenEstimate[];
  likelyTests: FileTokenEstimate[];
}

export interface TokenEstimateOptions {
  cwd: string;
  mode: EstimateMode;
  task?: string;
  compareNaive?: boolean;
  maxFiles: number;
}

export interface TokenEstimateReport {
  method: "ceil(characters / 4)";
  mode: EstimateMode;
  startupTokens: number;
  onDemandTokens: number;
  historyTokens: number;
  includedContextTokens: number;
  startupFiles: FileTokenEstimate[];
  onDemandFiles: FileTokenEstimate[];
  historyFiles: FileTokenEstimate[];
  includedContextFiles: FileTokenEstimate[];
  naiveScanTokens?: number;
  naiveScanFiles?: number;
  naiveScanCapped?: boolean;
  maxFiles: number;
  estimatedSavedTokens?: number;
  estimatedSavingPercent?: number;
  taskEstimate?: TaskTokenEstimate;
  warnings: string[];
}

const method = "ceil(characters / 4)" as const;

const startupContextFiles = [
  "AGENTS.md",
  "docs/ai-context/COMMUNICATION_MODE.md",
  "docs/ai-context/TASK_ROUTING.md",
  "docs/ai-context/TOKEN_BUDGET.md",
  "docs/ai-context/DO_NOT_READ.md"
] as const;

const onDemandContextFiles = [
  "docs/ai-context/MODULE_INDEX.md",
  "docs/ai-context/PROJECT_MAP.md",
  "docs/ai-context/DEPENDENCY_MAP.md",
  "docs/ai-context/RISK_REGISTER.md",
  "docs/ai-context/HOTSPOTS.md",
  "docs/ai-context/SYMBOL_MAP.md",
  "docs/ai-context/LESSONS_LEARNED.md"
] as const;

const historyContextFiles = ["docs/ai-context/CHANGE_LOG.md"] as const;

const sourceExtensions = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".html",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".kt",
  ".md",
  ".mjs",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".yaml",
  ".yml"
]);

const naiveGeneratedExclusions = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  "target",
  "docs/ai-context/archive"
];

function estimateTokens(characterCount: number): number {
  return Math.ceil(characterCount / 4);
}

function sumTokens(files: FileTokenEstimate[]): number {
  return files.reduce((total, file) => total + file.tokens, 0);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

async function estimateTextFile(cwd: string, filePath: string): Promise<FileTokenEstimate> {
  const fullPath = path.join(cwd, filePath);
  if (!(await pathExists(fullPath))) {
    return { path: filePath, tokens: 0, missing: true };
  }

  const content = await readTextFile(fullPath);
  return { path: filePath, tokens: estimateTokens(content.length) };
}

async function estimateBySize(cwd: string, filePath: string): Promise<FileTokenEstimate> {
  try {
    const fileStat = await stat(path.join(cwd, filePath));
    if (!fileStat.isFile()) {
      return { path: filePath, tokens: 0 };
    }

    return { path: filePath, tokens: estimateTokens(fileStat.size) };
  } catch {
    return { path: filePath, tokens: 0, missing: true };
  }
}

async function estimateContextFiles(cwd: string, files: readonly string[]): Promise<FileTokenEstimate[]> {
  return Promise.all(files.map((file) => estimateTextFile(cwd, file)));
}

function parseDoNotReadPaths(content: string): string[] {
  const paths: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const backtickMatches = [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    const values = backtickMatches.length > 0 ? backtickMatches : [line.replace(/^[-*]\s*/, "")];

    for (const value of values) {
      const clean = value.trim().replace(/^\.\//, "").replace(/\/$/, "");
      if (clean && !clean.includes(" ")) {
        paths.push(clean);
      }
    }
  }

  return uniqueSorted(paths);
}

async function readExcludedPaths(cwd: string): Promise<string[]> {
  const doNotReadPath = "docs/ai-context/DO_NOT_READ.md";
  const defaults = [...naiveGeneratedExclusions];

  if (!(await pathExists(path.join(cwd, doNotReadPath)))) {
    return uniqueSorted(defaults);
  }

  const content = await readTextFile(path.join(cwd, doNotReadPath));
  return uniqueSorted([...defaults, ...parseDoNotReadPaths(content)]);
}

function isExcluded(relativePath: string, excludedPaths: string[]): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/\/$/, "");
  const parts = normalized.split("/");

  return excludedPaths.some((excludedPath) => {
    const excluded = excludedPath.replace(/\\/g, "/").replace(/\/$/, "");
    return normalized === excluded || normalized.startsWith(`${excluded}/`) || parts.includes(excluded);
  });
}

function isSourceOrDocFile(filePath: string): boolean {
  return sourceExtensions.has(path.extname(filePath).toLowerCase());
}

async function collectNaiveFiles(
  cwd: string,
  dir: string,
  excludedPaths: string[],
  maxFiles: number,
  files: string[]
): Promise<void> {
  if (files.length >= maxFiles) {
    return;
  }

  let entries;
  try {
    entries = await readdir(path.join(cwd, dir), { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (files.length >= maxFiles) {
      return;
    }

    const relativePath = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.name === ".git" || isExcluded(relativePath, excludedPaths)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectNaiveFiles(cwd, relativePath, excludedPaths, maxFiles, files);
    } else if (entry.isFile() && isSourceOrDocFile(relativePath)) {
      files.push(relativePath);
    }
  }
}

async function estimateNaiveScan(cwd: string, maxFiles: number): Promise<{
  tokens: number;
  fileCount: number;
  capped: boolean;
}> {
  const excludedPaths = await readExcludedPaths(cwd);
  const files: string[] = [];
  await collectNaiveFiles(cwd, "", excludedPaths, maxFiles, files);
  const estimates = await Promise.all(files.map((file) => estimateBySize(cwd, file)));

  return {
    tokens: sumTokens(estimates),
    fileCount: files.length,
    capped: files.length >= maxFiles
  };
}

async function estimateRecommendedFiles(cwd: string, files: string[], maxFiles: number): Promise<FileTokenEstimate[]> {
  const limitedFiles = uniqueSorted(files).slice(0, maxFiles);
  return Promise.all(limitedFiles.map((file) => estimateBySize(cwd, file)));
}

function modeFiles(
  mode: EstimateMode,
  startupFiles: FileTokenEstimate[],
  onDemandFiles: FileTokenEstimate[],
  historyFiles: FileTokenEstimate[]
): FileTokenEstimate[] {
  if (mode === "compact") {
    return startupFiles;
  }

  if (mode === "investigation") {
    const investigationFiles = new Set([
      "docs/ai-context/DEPENDENCY_MAP.md",
      "docs/ai-context/RISK_REGISTER.md",
      "docs/ai-context/HOTSPOTS.md"
    ]);

    return [
      ...startupFiles,
      ...onDemandFiles.filter((file) => investigationFiles.has(file.path))
    ];
  }

  const changeLog = "docs/ai-context/CHANGE_LOG.md";
  return [
    ...startupFiles,
    ...onDemandFiles,
    ...historyFiles.filter((file) => file.path === changeLog)
  ];
}

async function estimateArchiveFiles(cwd: string): Promise<FileTokenEstimate[]> {
  const archiveRoot = path.join(cwd, contextArchiveDir);
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(path.join(cwd, dir), { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const relativePath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
        files.push(relativePath);
      }
    }
  }

  if (await pathExists(archiveRoot)) {
    await walk(contextArchiveDir);
  }

  return Promise.all(files.map((file) => estimateTextFile(cwd, file)));
}

export async function estimateTokenCost(options: TokenEstimateOptions): Promise<TokenEstimateReport> {
  const startupFiles = await estimateContextFiles(options.cwd, startupContextFiles);
  const onDemandFiles = await estimateContextFiles(options.cwd, onDemandContextFiles);
  const historyFiles = [
    ...await estimateContextFiles(options.cwd, historyContextFiles),
    ...await estimateArchiveFiles(options.cwd)
  ];
  const includedContextFiles = modeFiles(options.mode, startupFiles, onDemandFiles, historyFiles);
  const warnings = [
    "Estimates are approximate.",
    "Actual model tokenizer costs may differ.",
    "Savings depend on whether agents follow AGENTS.md and DO_NOT_READ.md."
  ];

  const report: TokenEstimateReport = {
    method,
    mode: options.mode,
    startupTokens: sumTokens(startupFiles),
    onDemandTokens: sumTokens(onDemandFiles),
    historyTokens: sumTokens(historyFiles),
    includedContextTokens: sumTokens(includedContextFiles),
    startupFiles,
    onDemandFiles,
    historyFiles,
    includedContextFiles,
    maxFiles: options.maxFiles,
    warnings
  };

  if (options.compareNaive) {
    const naive = await estimateNaiveScan(options.cwd, options.maxFiles);
    report.naiveScanTokens = naive.tokens;
    report.naiveScanFiles = naive.fileCount;
    report.naiveScanCapped = naive.capped;
    report.estimatedSavedTokens = Math.max(0, naive.tokens - report.startupTokens);
    report.estimatedSavingPercent = naive.tokens > 0
      ? Math.round((report.estimatedSavedTokens / naive.tokens) * 100)
      : 0;

    if (naive.capped) {
      warnings.push(`Naive scan was capped at ${options.maxFiles} files.`);
    }
  }

  if (options.task) {
    try {
      const suggestion = await suggestContext(options.cwd, options.task);
      const recommendedContextFiles = await Promise.all(
        suggestion.contextFiles.map((file) => estimateTextFile(options.cwd, file))
      );
      const likelySourceFiles = await estimateRecommendedFiles(options.cwd, suggestion.likelySourceFiles, options.maxFiles);
      const likelyTests = await estimateRecommendedFiles(options.cwd, suggestion.likelyTests, options.maxFiles);

      report.taskEstimate = {
        task: options.task,
        recommendedContextTokens: sumTokens(recommendedContextFiles),
        likelySourceTokens: sumTokens(likelySourceFiles),
        likelyTestTokens: sumTokens(likelyTests),
        recommendedContextFiles,
        likelySourceFiles,
        likelyTests
      };
    } catch {
      warnings.push("Task-specific suggestion failed; estimate excludes task recommendations.");
    }
  }

  return report;
}
