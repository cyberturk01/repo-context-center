import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { contextArchiveDir } from "./contextFiles";
import { pathExists, readTextFile } from "./fileSystem";
import { classifyRepoFile } from "./repoFileClassifier";
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
  likelyContextTokens: number;
  recommendedContextFiles: FileTokenEstimate[];
  likelySourceFiles: FileTokenEstimate[];
  likelyTests: FileTokenEstimate[];
  likelyContextFiles: FileTokenEstimate[];
}

export interface TokenEstimateOptions {
  cwd: string;
  mode: EstimateMode;
  task?: string;
  compareNaive?: boolean;
  maxFiles: number;
}

export interface TokenEstimateReport {
  schemaVersion: 1;
  command: "estimate";
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
  naiveScanExcludedFiles?: number;
  naiveScanExcludedExamples?: string[];
  naiveScanIgnoredFiles?: number;
  naiveScanIgnoredExamples?: string[];
  naiveScanUnsupportedFiles?: number;
  naiveScanUnsupportedExamples?: string[];
  naiveScanSkippedByCap?: number;
  naiveScanCapExamples?: string[];
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
  ".git",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".next",
  ".nuxt",
  "generated",
  "out",
  "tmp",
  "logs",
  "debug-logs",
  ".repo-context-center",
  ".turbo",
  ".pnpm-store",
  ".yarn/cache",
  "target",
  "vendor",
  "docs/ai-context/archive"
];

const naiveBinaryExtensions = new Set([
  ".7z",
  ".dll",
  ".dylib",
  ".exe",
  ".gif",
  ".gz",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".so",
  ".tar",
  ".webp",
  ".zip"
]);

const naiveLockFileNames = new Set([
  "bun.lockb",
  "cargo.lock",
  "composer.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "yarn.lock"
]);

export function estimateTokens(characterCount: number): number {
  return Math.ceil(characterCount / 4);
}

export function estimateSavingPercent(naiveTokens: number, startupTokens: number, savedTokens: number): number {
  if (naiveTokens <= 0) {
    return 0;
  }

  const rawPercent = (savedTokens / naiveTokens) * 100;
  if (startupTokens === 0 && rawPercent >= 100) {
    return 100;
  }

  const rounded = Math.round(rawPercent * 10) / 10;
  return Math.min(99.9, Math.max(0, rounded));
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

function matchingExcludedPath(relativePath: string, excludedPaths: string[]): string | undefined {
  const normalized = relativePath.replace(/\\/g, "/").replace(/\/$/, "");
  const parts = normalized.split("/");

  return excludedPaths.find((excludedPath) => {
    const excluded = excludedPath.replace(/\\/g, "/").replace(/\/$/, "");
    return normalized === excluded || normalized.startsWith(`${excluded}/`) || parts.includes(excluded);
  });
}

function isExcluded(relativePath: string, excludedPaths: string[]): boolean {
  return matchingExcludedPath(relativePath, excludedPaths) !== undefined;
}

function isSourceOrDocFile(filePath: string): boolean {
  return sourceExtensions.has(path.extname(filePath).toLowerCase());
}

function isNaiveScanReadableFile(filePath: string): boolean {
  if (!isSourceOrDocFile(filePath)) {
    return false;
  }

  const normalized = filePath.replace(/\\/g, "/");
  const basename = path.posix.basename(normalized).toLowerCase();
  if (naiveLockFileNames.has(basename)) {
    return false;
  }

  const info = classifyRepoFile(normalized);
  return info.role !== "generated"
    && info.role !== "fixture"
    && info.role !== "snapshot"
    && info.role !== "asset";
}

type NaiveSkipCategory = "ignored" | "unsupported" | "cap";

interface NaiveSkipReason {
  category: NaiveSkipCategory;
  reason: string;
}

function naiveSkipReason(filePath: string, excludedPaths: string[]): NaiveSkipReason | undefined {
  const excludedPath = matchingExcludedPath(filePath, excludedPaths);
  if (excludedPath) {
    return { category: "ignored", reason: excludedPath };
  }

  const normalized = filePath.replace(/\\/g, "/");
  const basename = path.posix.basename(normalized).toLowerCase();
  const extension = path.extname(basename).toLowerCase();
  if (naiveBinaryExtensions.has(extension)) {
    return { category: "unsupported", reason: extension };
  }
  if (naiveLockFileNames.has(basename)) {
    return { category: "unsupported", reason: basename };
  }
  const role = classifyRepoFile(filePath).role;
  if (role === "generated" || role === "fixture" || role === "snapshot") {
    return { category: "ignored", reason: role };
  }
  if (role === "asset") {
    return { category: "unsupported", reason: role };
  }

  return undefined;
}

interface NaiveScanStats {
  excludedFiles: number;
  exclusionCounts: Map<string, number>;
  ignoredFiles: number;
  ignoredCounts: Map<string, number>;
  unsupportedFiles: number;
  unsupportedCounts: Map<string, number>;
  skippedByCap: number;
  capCounts: Map<string, number>;
}

function addCount(counts: Map<string, number>, reason: string, fileCount: number): void {
  counts.set(reason, (counts.get(reason) ?? 0) + fileCount);
}

function addExclusion(stats: NaiveScanStats, skip: NaiveSkipReason, fileCount: number): void {
  if (fileCount <= 0) {
    return;
  }

  stats.excludedFiles += fileCount;
  addCount(stats.exclusionCounts, skip.reason, fileCount);

  if (skip.category === "ignored") {
    stats.ignoredFiles += fileCount;
    addCount(stats.ignoredCounts, skip.reason, fileCount);
  } else if (skip.category === "unsupported") {
    stats.unsupportedFiles += fileCount;
    addCount(stats.unsupportedCounts, skip.reason, fileCount);
  } else {
    stats.skippedByCap += fileCount;
    addCount(stats.capCounts, skip.reason, fileCount);
  }
}

async function countFilesRecursive(cwd: string, dir: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(path.join(cwd, dir), { withFileTypes: true });
  } catch {
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    const relativePath = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      count += await countFilesRecursive(cwd, relativePath);
    } else if (entry.isFile()) {
      count += 1;
    }
  }

  return count;
}

function topExamples(counts: Map<string, number>): string[] {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([reason]) => reason);
}

function emptyNaiveScanStats(): NaiveScanStats {
  return {
    excludedFiles: 0,
    exclusionCounts: new Map(),
    ignoredFiles: 0,
    ignoredCounts: new Map(),
    unsupportedFiles: 0,
    unsupportedCounts: new Map(),
    skippedByCap: 0,
    capCounts: new Map()
  };
}

async function collectNaiveFiles(
  cwd: string,
  dir: string,
  excludedPaths: string[],
  maxFiles: number,
  files: string[],
  stats: NaiveScanStats
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

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const relativePath = dir ? `${dir}/${entry.name}` : entry.name;

    if (files.length >= maxFiles) {
      for (const remainingEntry of entries.slice(index)) {
        const remainingPath = dir ? `${dir}/${remainingEntry.name}` : remainingEntry.name;
        addExclusion(stats, { category: "cap", reason: remainingPath }, remainingEntry.isDirectory()
          ? await countFilesRecursive(cwd, remainingPath)
          : remainingEntry.isFile() ? 1 : 0);
      }
      return;
    }

    const skipReason = naiveSkipReason(relativePath, excludedPaths);

    if (entry.isDirectory()) {
      if (skipReason) {
        addExclusion(stats, skipReason, await countFilesRecursive(cwd, relativePath));
      } else {
        await collectNaiveFiles(cwd, relativePath, excludedPaths, maxFiles, files, stats);
      }
    } else if (entry.isFile()) {
      if (skipReason || !isNaiveScanReadableFile(relativePath)) {
        addExclusion(stats, skipReason ?? { category: "unsupported", reason: "non-source" }, 1);
      } else {
        files.push(relativePath);
      }
    }
  }
}

export async function estimateNaiveScan(cwd: string, maxFiles: number): Promise<{
  tokens: number;
  fileCount: number;
  excludedFileCount: number;
  excludedExamples: string[];
  ignoredFileCount: number;
  ignoredExamples: string[];
  unsupportedFileCount: number;
  unsupportedExamples: string[];
  skippedByScanCap: number;
  scanCapExamples: string[];
  capped: boolean;
}> {
  const excludedPaths = await readExcludedPaths(cwd);
  const files: string[] = [];
  const stats = emptyNaiveScanStats();
  await collectNaiveFiles(cwd, "", excludedPaths, maxFiles, files, stats);
  const estimates = await Promise.all(files.map((file) => estimateBySize(cwd, file)));

  return {
    tokens: sumTokens(estimates),
    fileCount: files.length,
    excludedFileCount: stats.excludedFiles,
    excludedExamples: topExamples(stats.exclusionCounts),
    ignoredFileCount: stats.ignoredFiles,
    ignoredExamples: topExamples(stats.ignoredCounts),
    unsupportedFileCount: stats.unsupportedFiles,
    unsupportedExamples: topExamples(stats.unsupportedCounts),
    skippedByScanCap: stats.skippedByCap,
    scanCapExamples: topExamples(stats.capCounts),
    capped: files.length >= maxFiles
  };
}

async function estimateRecommendedFiles(cwd: string, files: string[], maxFiles: number): Promise<FileTokenEstimate[]> {
  const limitedFiles = uniqueSorted(files).slice(0, maxFiles);
  return Promise.all(limitedFiles.map((file) => estimateBySize(cwd, file)));
}

function isContextPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized === "AGENTS.md"
    || normalized.startsWith("docs/ai-context/")
    || normalized.startsWith(".project-brain/");
}

function isTestPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");

  return normalized.startsWith("tests/")
    || normalized.startsWith("cypress/")
    || parts.some((part) => part.toLowerCase().includes("tests"))
    || /\.(spec|test)\.[^.]+$/i.test(normalized);
}

function classifyRecommendedPath(filePath: string): "context" | "test" | "source" {
  if (isContextPath(filePath)) {
    return "context";
  }

  if (isTestPath(filePath)) {
    return "test";
  }

  return "source";
}

async function collectRecommendedFiles(
  cwd: string,
  filePath: string,
  excludedPaths: string[],
  files: string[],
  maxFiles: number
): Promise<void> {
  if (files.length >= maxFiles) {
    return;
  }

  const normalizedPath = filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
  let fileStat;

  try {
    fileStat = await stat(path.join(cwd, normalizedPath));
  } catch {
    return;
  }

  if (fileStat.isFile()) {
    if (isSourceOrDocFile(normalizedPath)) {
      files.push(normalizedPath);
    }
    return;
  }

  if (!fileStat.isDirectory()) {
    return;
  }

  let entries;
  try {
    entries = await readdir(path.join(cwd, normalizedPath), { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (files.length >= maxFiles) {
      return;
    }

    const relativePath = `${normalizedPath}/${entry.name}`;
    if (entry.name === ".git" || isExcluded(relativePath, excludedPaths)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectRecommendedFiles(cwd, relativePath, excludedPaths, files, maxFiles);
    } else if (entry.isFile() && isSourceOrDocFile(relativePath)) {
      files.push(relativePath);
    }
  }
}

async function resolveRecommendedFiles(cwd: string, paths: string[], maxFiles: number): Promise<string[]> {
  const excludedPaths = await readExcludedPaths(cwd);
  const files: string[] = [];

  for (const filePath of uniqueSorted(paths)) {
    if (files.length >= maxFiles) {
      break;
    }

    await collectRecommendedFiles(cwd, filePath, excludedPaths, files, maxFiles);
  }

  return uniqueSorted(files).slice(0, maxFiles);
}

async function estimateTaskRecommendation(
  cwd: string,
  task: string,
  maxFiles: number
): Promise<TaskTokenEstimate> {
  const suggestion = await suggestContext(cwd, task, { maxFiles });
  const recommendedPaths = [
    ...suggestion.contextFiles,
    ...suggestion.likelySourceFiles,
    ...suggestion.likelyTests
  ];
  const resolvedFiles = await resolveRecommendedFiles(cwd, recommendedPaths, maxFiles);
  const sourcePaths = resolvedFiles.filter((file) => classifyRecommendedPath(file) === "source");
  const testPaths = resolvedFiles.filter((file) => classifyRecommendedPath(file) === "test");
  const contextPaths = resolvedFiles.filter((file) => classifyRecommendedPath(file) === "context");
  const recommendedContextFiles = await estimateRecommendedFiles(cwd, contextPaths, maxFiles);
  const likelySourceFiles = await estimateRecommendedFiles(cwd, sourcePaths, maxFiles);
  const likelyTests = await estimateRecommendedFiles(cwd, testPaths, maxFiles);

  return {
    task,
    recommendedContextTokens: sumTokens(recommendedContextFiles),
    likelySourceTokens: sumTokens(likelySourceFiles),
    likelyTestTokens: sumTokens(likelyTests),
    likelyContextTokens: sumTokens(recommendedContextFiles),
    recommendedContextFiles,
    likelySourceFiles,
    likelyTests,
    likelyContextFiles: recommendedContextFiles
  };
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
    schemaVersion: 1,
    command: "estimate",
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
    report.naiveScanExcludedFiles = naive.excludedFileCount;
    report.naiveScanExcludedExamples = naive.excludedExamples;
    report.naiveScanIgnoredFiles = naive.ignoredFileCount;
    report.naiveScanIgnoredExamples = naive.ignoredExamples;
    report.naiveScanUnsupportedFiles = naive.unsupportedFileCount;
    report.naiveScanUnsupportedExamples = naive.unsupportedExamples;
    report.naiveScanSkippedByCap = naive.skippedByScanCap;
    report.naiveScanCapExamples = naive.scanCapExamples;
    report.naiveScanCapped = naive.capped;
    report.estimatedSavedTokens = Math.max(0, naive.tokens - report.startupTokens);
    report.estimatedSavingPercent = estimateSavingPercent(naive.tokens, report.startupTokens, report.estimatedSavedTokens);

    if (naive.capped) {
      warnings.push(`Naive scan was capped at ${options.maxFiles} files.`);
    }
  }

  if (options.task) {
    try {
      report.taskEstimate = await estimateTaskRecommendation(options.cwd, options.task, options.maxFiles);
    } catch {
      warnings.push("Task-specific suggestion failed; estimate excludes task recommendations.");
    }
  }

  return report;
}
