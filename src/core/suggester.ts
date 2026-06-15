import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { readSuggestContext, type ContextDocument, type SuggestContextFile } from "./contextReader";
import { classifyRepoFile, isGeneratedRepoDirectoryName } from "./repoFileClassifier";

export type SuggestMode = "Compact" | "Investigation" | "Detailed";
export type RiskLevel = "unknown" | "low" | "medium" | "high";

export interface StartupContext {
  task: string;
  mode: SuggestMode;
  riskLevel: RiskLevel;
  readFirstDocs: string[];
  likelySourceFiles: string[];
  likelyTests: string[];
  relevantSymbols: SymbolRecommendation[];
  startupInstructions: string[];
  recommendationReasons: Record<string, string[]>;
  reasons: string[];
}

export interface ContextSuggestion extends StartupContext {
  contextFiles: SuggestContextFile[];
}

export interface SuggestContextOptions {
  maxFiles?: number;
}

export interface SymbolRecommendation {
  file: string;
  symbols: string[];
  tests: string[];
  risk: RiskLevel | "unknown";
}

const investigationKeywords = [
  "auth",
  "security",
  "migration",
  "payment",
  "consent",
  "audit",
  "production",
  "release",
  "bug"
];

const detailedKeywords = ["refactor", "architecture", "performance", "cross-module", "integration"];
const workflowKeywords = [
  "action",
  "actions",
  "build",
  "cd",
  "ci",
  "deploy",
  "deployment",
  "docker",
  "github",
  "package",
  "pipeline",
  "production",
  "railway",
  "release",
  "workflow",
  "workflows"
];
const testDiscoveryKeywords = ["test", "unit test", "spec", "failure", "jest", "vitest", "cypress", "e2e"];
const workflowFiles = ["package.json", "Dockerfile", "railway.json"];
const defaultSuggestMaxFiles = 50;
const activeTestPattern = /\.(test|spec)\.[^.]+$/i;
const stopWords = new Set([
  "a",
  "an",
  "and",
  "app",
  "docs",
  "for",
  "in",
  "lib",
  "of",
  "on",
  "or",
  "packages",
  "src",
  "test",
  "tests",
  "the",
  "to",
  "with"
]);

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function uniqueOrdered(values: string[]): string[] {
  return [...new Set(values)];
}

function addReason(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function tokenize(text: string): string[] {
  return uniqueSorted(
    text
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/[^a-z0-9_-]+/)
      .filter((token) => token.length > 1 && !stopWords.has(token))
  );
}

function includesAny(text: string, tokens: string[]): boolean {
  const textTokens = new Set(tokenize(text));
  return tokens.some((token) => textTokens.has(token));
}

function extractBacktickPaths(text: string): string[] {
  const paths: string[] = [];
  const pattern = /`([^`]+)`/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const value = match[1].trim();
    if (value.includes("/") || value.includes(".")) {
      paths.push(value.replace(/\/$/, ""));
    }
  }

  return paths;
}

function isLikelyTestPath(filePath: string): boolean {
  return classifyRepoFile(filePath).role === "test";
}

function isPrimaryTestPath(filePath: string): boolean {
  if (classifyRepoFile(filePath).role !== "test") {
    return false;
  }

  return /^(tests?|__tests__)\/.*\.(test|spec)\.[^.]+$/i.test(filePath)
    || /^cypress\/.*\.(cy|spec)\.[^.]+$/i.test(filePath)
    || /^e2e\/.*\.(cy|test|spec)\.[^.]+$/i.test(filePath)
    || /^(packages|libs)\/[^/]+\/tests?\/.*\.(test|spec)\.[^.]+$/i.test(filePath)
    || /(^|\/)(test_[^/]+|[^/]+_test)\.py$/i.test(filePath);
}

function isExcludedPrimaryTestPath(filePath: string): boolean {
  return classifyRepoFile(filePath).isNoise
    || /(^|\/)schemas\//i.test(filePath)
    || /\.(md|json|sql)$/i.test(filePath);
}

function isFallbackTestPath(filePath: string): boolean {
  return classifyRepoFile(filePath).role === "test"
    && !/(^|\/)schemas\//i.test(filePath)
    && !/\.(md|json|sql)$/i.test(filePath);
}

function isLikelySourceSearchPath(filePath: string): boolean {
  return classifyRepoFile(filePath).role === "source";
}

function isWorkflowTask(tokens: string[]): boolean {
  return workflowKeywords.some((keyword) => tokens.includes(keyword));
}

function isTestRelatedTask(task: string): boolean {
  const lowerTask = task.toLowerCase();
  return testDiscoveryKeywords.some((keyword) => {
    if (keyword.includes(" ")) {
      return lowerTask.includes(keyword);
    }

    return new RegExp(`(^|[^a-z0-9])${keyword}([^a-z0-9]|$)`).test(lowerTask);
  });
}

function pathTokens(filePath: string): string[] {
  return tokenize(filePath.replace(/\.[^.]+$/g, ""));
}

function basenameWithoutExtensions(filePath: string): string {
  return path.posix.basename(filePath).replace(/(\.test|\.spec|\.cy)?\.[^.]+$/i, "");
}

function parentFolder(filePath: string): string {
  return path.posix.dirname(filePath);
}

function filenameTokens(filePath: string): string[] {
  return tokenize(basenameWithoutExtensions(filePath));
}

function parentTokens(filePath: string): string[] {
  const parent = parentFolder(filePath);
  return parent === "." ? [] : tokenize(parent);
}

function segmentTokens(filePath: string): string[] {
  return filePath
    .split("/")
    .flatMap((segment) => tokenize(segment.replace(/\.[^.]+$/g, "")));
}

function matchingTokenCount(values: string[], tokens: Set<string>): number {
  return uniqueOrdered(values).filter((token) => tokens.has(token)).length;
}

function pathMatchesTokens(filePath: string, tokens: string[]): boolean {
  const tokenSet = new Set(tokens);
  return matchingTokenCount(segmentTokens(filePath), tokenSet) > 0;
}

function isPackageLockPath(filePath: string): boolean {
  return /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|composer\.lock|poetry\.lock|cargo\.lock)$/i.test(filePath);
}

function noisePenalty(filePath: string): number {
  const info = classifyRepoFile(filePath);

  if (info.isNoise || info.role === "generated" || info.role === "fixture" || info.role === "snapshot") {
    return 200;
  }
  if (/(^|\/)(archive|archived|legacy)\//i.test(filePath)) {
    return 90;
  }
  if (info.role === "asset" || isPackageLockPath(filePath)) {
    return 120;
  }

  return 0;
}

function tokenMatchScore(filePath: string, tokens: Set<string>): number {
  const strongMatches = matchingTokenCount(filenameTokens(filePath), tokens);
  const mediumMatches = matchingTokenCount(parentTokens(filePath), tokens);
  const segmentMatches = matchingTokenCount(segmentTokens(filePath), tokens);

  return (strongMatches * 30) + (mediumMatches * 16) + (segmentMatches > 0 ? 4 : 0);
}

function activeTestScore(filePath: string): number {
  if (isPrimaryTestPath(filePath)) {
    return 24;
  }
  if (activeTestPattern.test(filePath) || /(^|\/)(test_[^/]+|[^/]+_test)\.py$/i.test(filePath)) {
    return 16;
  }
  return 0;
}

function pathStem(filePath: string): string {
  return basenameWithoutExtensions(filePath).toLowerCase();
}

function packageScopeFor(filePath: string): string | undefined {
  return classifyRepoFile(filePath).packageScope;
}

function commonDirectoryDepth(left: string, right: string): number {
  const leftParts = parentFolder(left).split("/").filter(Boolean);
  const rightParts = parentFolder(right).split("/").filter(Boolean);
  let depth = 0;

  while (leftParts[depth] && leftParts[depth] === rightParts[depth]) {
    depth += 1;
  }

  return depth;
}

function pairingScore(filePath: string, selectedPaths: string[]): number {
  let score = 0;
  const fileStem = pathStem(filePath);
  const fileTokens = new Set(filenameTokens(filePath));
  const filePackageScope = packageScopeFor(filePath);

  for (const selectedPath of selectedPaths) {
    const selectedStem = pathStem(selectedPath);
    const selectedTokens = filenameTokens(selectedPath);
    const sharedFilenameTokens = selectedTokens.filter((token) => fileTokens.has(token)).length;
    const selectedPackageScope = packageScopeFor(selectedPath);

    if (fileStem === selectedStem || fileStem.includes(selectedStem) || selectedStem.includes(fileStem)) {
      score = Math.max(score, 34);
    }
    if (sharedFilenameTokens > 0) {
      score = Math.max(score, 18 + (sharedFilenameTokens * 6));
    }
    if (filePackageScope && selectedPackageScope && filePackageScope === selectedPackageScope) {
      score = Math.max(score, 24);
    }
    if (commonDirectoryDepth(filePath, selectedPath) > 0) {
      score = Math.max(score, 8 + Math.min(commonDirectoryDepth(filePath, selectedPath), 3) * 3);
    }
  }

  return score;
}

function pairedSourceReason(filePath: string, selectedSourceFiles: string[]): string | undefined {
  const fileStem = pathStem(filePath);
  const fileTokens = new Set(filenameTokens(filePath));
  const filePackageScope = packageScopeFor(filePath);

  for (const selectedPath of selectedSourceFiles) {
    const selectedStem = pathStem(selectedPath);
    const selectedTokens = filenameTokens(selectedPath);
    const sharedFilenameTokens = selectedTokens.filter((token) => fileTokens.has(token)).length;
    const selectedPackageScope = packageScopeFor(selectedPath);

    if (
      fileStem === selectedStem
      || fileStem.includes(selectedStem)
      || selectedStem.includes(fileStem)
      || sharedFilenameTokens > 0
    ) {
      return `paired with source file: ${selectedPath}`;
    }
    if (filePackageScope && selectedPackageScope && filePackageScope === selectedPackageScope) {
      return "same monorepo package scope";
    }
    if (commonDirectoryDepth(filePath, selectedPath) > 0) {
      return `paired with source file: ${selectedPath}`;
    }
  }

  return undefined;
}

function hasSamePackageScope(filePath: string, selectedSourceFiles: string[]): boolean {
  const filePackageScope = packageScopeFor(filePath);
  return Boolean(
    filePackageScope
    && selectedSourceFiles.some((selectedPath) => packageScopeFor(selectedPath) === filePackageScope)
  );
}

interface ScoredCandidate {
  path: string;
  score: number;
}

function orderScoredCandidates(candidates: ScoredCandidate[]): string[] {
  return candidates
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      return scoreDifference === 0 ? left.path.localeCompare(right.path) : scoreDifference;
    })
    .map((candidate) => candidate.path);
}

async function listRepoFiles(cwd: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(relativeDir: string): Promise<void> {
    const fullDir = path.join(cwd, relativeDir);
    let entries;

    try {
      entries = await readdir(fullDir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (entry.name !== ".git" && !isGeneratedRepoDirectoryName(entry.name)) {
          await walk(relativePath);
        }
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  await walk("");
  return files;
}

async function pathExistsInRepo(cwd: string, relativePath: string): Promise<"file" | "directory" | undefined> {
  try {
    const fileStat = await stat(path.join(cwd, relativePath));
    if (fileStat.isFile()) {
      return "file";
    }
    if (fileStat.isDirectory()) {
      return "directory";
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function expandExistingPathHints(cwd: string, files: string[], pathHints: string[]): Promise<string[]> {
  const matches: string[] = [];

  for (const hint of uniqueSorted(pathHints)) {
    const normalized = hint.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
    if (!normalized || normalized.startsWith("docs/")) {
      continue;
    }

    const existingType = await pathExistsInRepo(cwd, normalized);
    if (existingType === "file") {
      matches.push(normalized);
    } else if (existingType === "directory") {
      matches.push(...files.filter((file) => file.startsWith(`${normalized}/`)));
    }
  }

  return matches;
}

function discoverLikelySourceFiles(
  files: string[],
  tokens: string[],
  existingHintMatches: string[],
  includeWorkflowFiles: boolean,
  maxFiles: number
): string[] {
  const tokenSet = new Set(tokens);
  const hintSet = new Set(existingHintMatches);
  const candidates = files.map((file) => {
    const info = classifyRepoFile(file);
    let score = 0;
    const matchScore = tokenMatchScore(file, tokenSet);

    if (info.role === "source") {
      if (!hintSet.has(file) && matchScore === 0) {
        return { path: file, score: 0 };
      }
      score += 32;
      score += matchScore;
    } else if (includeWorkflowFiles && info.role === "workflow") {
      score += 80;
      score += matchScore;
    } else if (includeWorkflowFiles && workflowFiles.includes(file)) {
      score += 38;
      score += matchScore;
    } else if (hintSet.has(file) && info.role !== "test") {
      score += 22;
    } else {
      return { path: file, score: 0 };
    }

    if (hintSet.has(file)) {
      score += 55;
    }
    if (includeWorkflowFiles && info.role === "workflow") {
      score += 28;
    }
    if (info.role === "package") {
      score -= 16;
    }
    if (info.role === "config") {
      score -= 8;
    }

    score -= noisePenalty(file);
    return { path: file, score };
  });

  return orderScoredCandidates(candidates).slice(0, maxFiles);
}

function discoverLikelyTests(
  files: string[],
  tokens: string[],
  existingHintMatches: string[],
  selectedSourceFiles: string[],
  includeAllTests: boolean,
  maxFiles: number
): string[] {
  const tokenSet = new Set(tokens);
  const hintSet = new Set(existingHintMatches);
  const primaryCandidates = files.map((file) => {
    if (!isPrimaryTestPath(file) || isExcludedPrimaryTestPath(file)) {
      return { path: file, score: 0 };
    }

    let score = 34 + activeTestScore(file) + tokenMatchScore(file, tokenSet);
    score += pairingScore(file, selectedSourceFiles);

    if (hintSet.has(file)) {
      score += 60;
    }
    if (includeAllTests) {
      score += 8;
    } else if (!hintSet.has(file) && !pathMatchesTokens(file, tokens) && pairingScore(file, selectedSourceFiles) === 0) {
      score = 0;
    }

    score -= noisePenalty(file);
    return { path: file, score };
  });
  const orderedPrimaryTests = orderScoredCandidates(primaryCandidates);

  if (orderedPrimaryTests.length > 0) {
    return orderedPrimaryTests.slice(0, maxFiles);
  }

  const fallbackCandidates = files.map((file) => {
    if (!isFallbackTestPath(file)) {
      return { path: file, score: 0 };
    }

    let score = 16 + activeTestScore(file) + tokenMatchScore(file, tokenSet);
    score += pairingScore(file, selectedSourceFiles);

    if (hintSet.has(file)) {
      score += 60;
    }
    if (includeAllTests) {
      score += 4;
    } else if (!hintSet.has(file) && !pathMatchesTokens(file, tokens) && pairingScore(file, selectedSourceFiles) === 0) {
      score = 0;
    }

    score -= noisePenalty(file);
    return { path: file, score };
  });

  return orderScoredCandidates(fallbackCandidates).slice(0, maxFiles);
}

function firstMatchingTaskToken(filePath: string, taskTokens: string[]): string | undefined {
  const fileTokenSet = new Set(segmentTokens(filePath));
  return taskTokens.find((token) => fileTokenSet.has(token));
}

function firstMatchingFilenameStem(filePath: string, tokens: string[]): string | undefined {
  const filenameTokenSet = new Set(filenameTokens(filePath));
  return tokens.find((token) => filenameTokenSet.has(token));
}

function firstMatchingParentFolder(filePath: string, tokens: string[]): string | undefined {
  const parentTokenSet = new Set(parentTokens(filePath));
  return tokens.find((token) => parentTokenSet.has(token));
}

function reasonsForRecommendedFile(
  filePath: string,
  taskTokens: string[],
  discoveryTokens: string[],
  existingHintMatches: string[],
  selectedSourceFiles: string[],
  includeWorkflowFiles: boolean,
  genericTestFallback: boolean
): string[] {
  const reasons: string[] = [];
  const info = classifyRepoFile(filePath);
  const taskToken = firstMatchingTaskToken(filePath, taskTokens);
  const filenameStem = firstMatchingFilenameStem(filePath, discoveryTokens);
  const parentFolderMatch = firstMatchingParentFolder(filePath, discoveryTokens);

  if (taskToken) {
    addReason(reasons, `matched task token: ${taskToken}`);
  }
  if (filenameStem) {
    addReason(reasons, `matched filename stem: ${filenameStem}`);
  }
  if (parentFolderMatch) {
    addReason(reasons, `matched parent folder: ${parentFolderMatch}`);
  }

  if (existingHintMatches.includes(filePath)) {
    addReason(reasons, "matched context path hint");
  }

  if (includeWorkflowFiles && (info.role === "workflow" || workflowFiles.includes(filePath))) {
    addReason(reasons, "workflow task match");
  }

  if (info.role === "test") {
    const pairedReason = pairedSourceReason(filePath, selectedSourceFiles);
    if (pairedReason) {
      addReason(reasons, pairedReason);
    }
    if (hasSamePackageScope(filePath, selectedSourceFiles)) {
      addReason(reasons, "same monorepo package scope");
    }
    if (genericTestFallback) {
      addReason(reasons, "generic test-task fallback");
    }
  }

  return reasons;
}

function recommendationReasonsFor(
  likelySourceFiles: string[],
  likelyTests: string[],
  taskTokens: string[],
  discoveryTokens: string[],
  existingHintMatches: string[],
  includeWorkflowFiles: boolean,
  genericTestFallback: boolean
): Record<string, string[]> {
  const reasons: Record<string, string[]> = {};

  for (const filePath of likelySourceFiles) {
    const fileReasons = reasonsForRecommendedFile(
      filePath,
      taskTokens,
      discoveryTokens,
      existingHintMatches,
      likelySourceFiles,
      includeWorkflowFiles,
      genericTestFallback
    );
    if (fileReasons.length > 0) {
      reasons[filePath] = fileReasons;
    }
  }

  for (const filePath of likelyTests) {
    const fileReasons = reasonsForRecommendedFile(
      filePath,
      taskTokens,
      discoveryTokens,
      existingHintMatches,
      likelySourceFiles,
      includeWorkflowFiles,
      genericTestFallback
    );
    if (fileReasons.length > 0) {
      reasons[filePath] = fileReasons;
    }
  }

  return reasons;
}

function onlyExistingSymbolEntries(symbolEntries: SymbolRecommendation[], files: string[]): SymbolRecommendation[] {
  const fileSet = new Set(files);

  return symbolEntries
    .filter((entry) => fileSet.has(entry.file))
    .map((entry) => ({
      ...entry,
      tests: entry.tests.filter((testPath) => fileSet.has(testPath))
    }));
}

function findDocument(documents: ContextDocument[], file: SuggestContextFile): ContextDocument | undefined {
  return documents.find((document) => document.path === file);
}

function isSuggestContextFile(filePath: string): filePath is SuggestContextFile {
  return [
    "docs/ai-context/TASK_ROUTING.md",
    "docs/ai-context/MODULE_INDEX.md",
    "docs/ai-context/DEPENDENCY_MAP.md",
    "docs/ai-context/SYMBOL_MAP.md",
    "docs/ai-context/RISK_REGISTER.md",
    "docs/ai-context/HOTSPOTS.md"
  ].includes(filePath);
}

function matchingLines(document: ContextDocument | undefined, tokens: string[]): string[] {
  if (!document) {
    return [];
  }

  return document.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && includesAny(line, tokens));
}

function normalizeRisk(value: string): RiskLevel | "unknown" {
  const risk = value.toLowerCase().trim();
  if (risk === "low" || risk === "medium" || risk === "high") {
    return risk;
  }

  return "unknown";
}

function parseSymbolMap(document: ContextDocument | undefined): SymbolRecommendation[] {
  if (!document) {
    return [];
  }

  const entries: SymbolRecommendation[] = [];
  let current: SymbolRecommendation | undefined;
  let section: "symbols" | "tests" | "risk" | undefined;

  for (const rawLine of document.content.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = /^##\s+(.+)$/.exec(line);

    if (heading) {
      if (current) {
        entries.push(current);
      }

      current = {
        file: heading[1].trim(),
        symbols: [],
        tests: [],
        risk: "unknown"
      };
      section = undefined;
      continue;
    }

    if (!current) {
      continue;
    }

    if (/^Important symbols:/i.test(line)) {
      section = "symbols";
      continue;
    }
    if (/^Common tests:/i.test(line)) {
      section = "tests";
      continue;
    }
    if (/^Risk:/i.test(line)) {
      section = "risk";
      const inlineRisk = line.split(":").slice(1).join(":").trim();
      if (inlineRisk) {
        current.risk = normalizeRisk(inlineRisk);
      }
      continue;
    }

    if (section === "symbols" && line.startsWith("- ")) {
      const symbol = line.slice(2).replace(/`/g, "").trim();
      if (symbol && !symbol.startsWith("_")) {
        current.symbols.push(symbol);
      }
    } else if (section === "tests" && line.startsWith("- ")) {
      const testPath = line.slice(2).replace(/`/g, "").trim();
      if (testPath && !testPath.startsWith("_")) {
        current.tests.push(testPath);
      }
    } else if (section === "risk" && line) {
      current.risk = normalizeRisk(line);
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries.map((entry) => ({
    ...entry,
    symbols: uniqueSorted(entry.symbols),
    tests: uniqueSorted(entry.tests)
  }));
}

function matchingSymbolEntries(
  symbolEntries: SymbolRecommendation[],
  tokens: string[],
  candidatePaths: string[]
): SymbolRecommendation[] {
  const candidateSet = new Set(candidatePaths);

  return symbolEntries
    .map((entry) => {
      const matchedSymbols = entry.symbols.filter((symbol) => includesAny(symbol, tokens));
      const fileMatches = includesAny(entry.file, tokens)
        || [...candidateSet].some((candidatePath) => candidatePath === entry.file || entry.file.startsWith(`${candidatePath}/`));

      if (matchedSymbols.length === 0 && !fileMatches) {
        return undefined;
      }

      return {
        ...entry,
        symbols: matchedSymbols.length > 0 ? uniqueSorted(matchedSymbols) : entry.symbols
      };
    })
    .filter((entry): entry is SymbolRecommendation => Boolean(entry));
}

function modeForTask(task: string, tokens: string[]): SuggestMode {
  const lowerTask = task.toLowerCase();
  const highRiskKeywords = [
    ...investigationKeywords,
    "database",
    "db",
    "deployment",
    "workflow"
  ];

  if (highRiskKeywords.some((keyword) => tokens.includes(keyword) || lowerTask.includes(keyword))) {
    return "Investigation";
  }

  if (detailedKeywords.some((keyword) => lowerTask.includes(keyword)) || tokens.length > 10) {
    return "Detailed";
  }

  return "Compact";
}

function riskFor(
  mode: SuggestMode,
  riskMatches: number,
  dependencyMatches: number,
  repoSignalCount: number,
  likelySourceFiles: string[],
  likelyTests: string[]
): RiskLevel {
  if (mode === "Investigation" || riskMatches > 0) {
    return "high";
  }

  if (repoSignalCount === 0) {
    return "unknown";
  }

  if (mode === "Detailed" || dependencyMatches > 0) {
    return "medium";
  }

  if (mode !== "Compact" && likelySourceFiles.length > 0 && likelyTests.length > 0) {
    return "medium";
  }

  return "low";
}

function readFirstDocsFor(files: string[], contextFiles: SuggestContextFile[], routingMatches: number): string[] {
  const docs: string[] = [];
  if (files.includes("AGENTS.md")) {
    docs.push("AGENTS.md");
  }
  if (contextFiles.includes("docs/ai-context/TASK_ROUTING.md")) {
    docs.push("docs/ai-context/TASK_ROUTING.md");
  }
  if (contextFiles.includes("docs/ai-context/MODULE_INDEX.md") || (routingMatches === 0 && files.includes("docs/ai-context/MODULE_INDEX.md"))) {
    docs.push("docs/ai-context/MODULE_INDEX.md");
  }

  for (const file of contextFiles) {
    if (!docs.includes(file)) {
      docs.push(file);
    }
  }

  return uniqueOrdered(docs);
}

function startupInstructionsFor(startup: Omit<StartupContext, "startupInstructions">): string[] {
  const instructions: string[] = [];
  const hasWorkflowOrDeploymentFiles = startup.likelySourceFiles.some((file) => {
    return file.startsWith(".github/workflows/")
      || workflowFiles.includes(file)
      || /(^|\/)(docker-compose|compose)\.ya?ml$/i.test(file);
  });

  if (startup.readFirstDocs.includes("AGENTS.md")) {
    instructions.push("Read AGENTS.md first for repo-specific agent guidance.");
  }
  if (startup.readFirstDocs.includes("docs/ai-context/TASK_ROUTING.md")) {
    instructions.push("Read docs/ai-context/TASK_ROUTING.md for task-specific routing.");
  }
  if (startup.readFirstDocs.includes("docs/ai-context/MODULE_INDEX.md")) {
    instructions.push("Use docs/ai-context/MODULE_INDEX.md if routing is insufficient or the task spans modules.");
  }

  if (startup.likelySourceFiles.length > 0) {
    instructions.push(`Open likely source files: ${startup.likelySourceFiles.join(", ")}.`);
  } else {
    instructions.push("No confident source files were identified; start from the matched tests or context docs before broad search.");
  }

  if (startup.likelyTests.length > 0) {
    instructions.push(`Open likely tests: ${startup.likelyTests.join(", ")}.`);
  } else {
    instructions.push("No confident tests were identified; search for nearby test files after reading the source context.");
  }

  if (startup.relevantSymbols.length > 0) {
    instructions.push("Use the relevant symbol recommendations to prioritize exact functions and their listed tests.");
  }

  if (hasWorkflowOrDeploymentFiles) {
    instructions.push("For workflow or deployment changes, review CI/deploy configuration and package scripts before editing.");
  }

  if (startup.riskLevel === "high") {
    instructions.push("Treat this as high risk: keep the change narrow and verify the focused tests plus related regression coverage.");
  } else if (startup.riskLevel === "unknown") {
    instructions.push("Repo signal is limited; expand search carefully before editing.");
  }

  instructions.push("Expand search only if the recommended docs, source files, and tests are insufficient.");

  return instructions;
}

function toContextSuggestion(startupContext: StartupContext): ContextSuggestion {
  return {
    ...startupContext,
    contextFiles: uniqueSorted(startupContext.readFirstDocs.filter(isSuggestContextFile)) as SuggestContextFile[]
  };
}

export async function buildStartupContext(
  cwd: string,
  task: string,
  options: SuggestContextOptions = {}
): Promise<StartupContext> {
  const maxFiles = options.maxFiles ?? defaultSuggestMaxFiles;
  const documents = await readSuggestContext(cwd);
  const tokens = tokenize(task);
  const testRelatedTask = isTestRelatedTask(task);
  const repoFiles = await listRepoFiles(cwd);
  const taskRouting = findDocument(documents, "docs/ai-context/TASK_ROUTING.md");
  const moduleIndex = findDocument(documents, "docs/ai-context/MODULE_INDEX.md");
  const dependencyMap = findDocument(documents, "docs/ai-context/DEPENDENCY_MAP.md");
  const symbolMap = findDocument(documents, "docs/ai-context/SYMBOL_MAP.md");
  const riskRegister = findDocument(documents, "docs/ai-context/RISK_REGISTER.md");
  const hotspots = findDocument(documents, "docs/ai-context/HOTSPOTS.md");

  const routingMatches = matchingLines(taskRouting, tokens);
  const moduleMatches = matchingLines(moduleIndex, tokens);
  const dependencyMatches = matchingLines(dependencyMap, tokens);
  const matchedModulePaths = extractBacktickPaths(moduleMatches.join("\n"));
  const dependencyModuleMatches = dependencyMap
    ? matchingLines(dependencyMap, [...tokens, ...matchedModulePaths.flatMap((filePath) => tokenize(filePath))])
    : [];
  const riskMatches = [
    ...matchingLines(riskRegister, tokens),
    ...matchingLines(hotspots, tokens),
    ...matchingLines(riskRegister, matchedModulePaths.flatMap((filePath) => tokenize(filePath))),
    ...matchingLines(hotspots, matchedModulePaths.flatMap((filePath) => tokenize(filePath)))
  ];

  const candidatePaths = [
    ...extractBacktickPaths(routingMatches.join("\n")),
    ...extractBacktickPaths(moduleMatches.join("\n")),
    ...extractBacktickPaths(dependencyModuleMatches.join("\n")),
    ...extractBacktickPaths(riskMatches.join("\n"))
  ];
  const relevantSymbols = onlyExistingSymbolEntries(
    matchingSymbolEntries(parseSymbolMap(symbolMap), tokens, candidatePaths),
    repoFiles
  );
  const symbolRiskMatches = relevantSymbols.filter((entry) => entry.risk === "high").length;
  const pathHints = [
    ...candidatePaths,
    ...relevantSymbols.map((entry) => entry.file),
    ...relevantSymbols.flatMap((entry) => entry.tests)
  ];
  const existingHintMatches = await expandExistingPathHints(cwd, repoFiles, pathHints);
  const discoveryTokens = uniqueSorted([
    ...tokens,
    ...candidatePaths.flatMap((filePath) => tokenize(filePath)),
    ...relevantSymbols.flatMap((entry) => [entry.file, ...entry.symbols, ...entry.tests].flatMap((value) => tokenize(value)))
  ]);

  const contextFiles: SuggestContextFile[] = [];
  if (taskRouting) {
    contextFiles.push(taskRouting.path);
  }
  if (moduleIndex && (moduleMatches.length > 0 || routingMatches.length > 0)) {
    contextFiles.push(moduleIndex.path);
  }
  if (dependencyMap && (dependencyModuleMatches.length > 0 || dependencyMatches.length > 0)) {
    contextFiles.push(dependencyMap.path);
  }
  if (symbolMap && relevantSymbols.length > 0) {
    contextFiles.push(symbolMap.path);
  }
  if (riskRegister && riskMatches.length > 0) {
    contextFiles.push(riskRegister.path);
  }
  if (hotspots && riskMatches.length > 0) {
    contextFiles.push(hotspots.path);
  }

  const mode = modeForTask(task, tokens);
  const likelySourceFiles = discoverLikelySourceFiles(
    repoFiles,
    discoveryTokens,
    existingHintMatches,
    isWorkflowTask(tokens),
    maxFiles
  );
  const likelyTests = discoverLikelyTests(repoFiles, discoveryTokens, existingHintMatches, likelySourceFiles, testRelatedTask, maxFiles);
  const genericTestFallback = testRelatedTask && likelySourceFiles.length === 0 && likelyTests.length > 0;
  const recommendationReasons = recommendationReasonsFor(
    likelySourceFiles,
    likelyTests,
    tokens,
    discoveryTokens,
    existingHintMatches,
    isWorkflowTask(tokens),
    genericTestFallback
  );
  const repoSignalCount = contextFiles.length + likelySourceFiles.length + likelyTests.length + relevantSymbols.length;
  const finalRiskLevel = riskFor(
    mode,
    riskMatches.length + symbolRiskMatches,
    dependencyModuleMatches.length + dependencyMatches.length,
    repoSignalCount,
    likelySourceFiles,
    likelyTests
  );

  if (finalRiskLevel === "high") {
    if (riskRegister) {
      contextFiles.push(riskRegister.path);
    }
    if (hotspots) {
      contextFiles.push(hotspots.path);
    }
  }

  const uniqueContextFiles = uniqueSorted(contextFiles) as SuggestContextFile[];
  const readFirstDocs = readFirstDocsFor(repoFiles, uniqueContextFiles, routingMatches.length);
  const baseStartupContext: Omit<StartupContext, "startupInstructions"> = {
    task,
    mode,
    riskLevel: finalRiskLevel,
    readFirstDocs,
    likelySourceFiles,
    likelyTests,
    relevantSymbols,
    recommendationReasons,
    reasons: uniqueSorted([
      routingMatches.length > 0 ? "task matched routing guidance" : "",
      moduleMatches.length > 0 ? "task matched module index entries" : "",
      dependencyModuleMatches.length > 0 || dependencyMatches.length > 0 ? "module dependency guidance matched" : "",
      relevantSymbols.length > 0 ? "task matched symbol map entries" : "",
      riskMatches.length > 0 ? "risk or hotspot guidance matched" : "",
      testRelatedTask ? "test-related task triggered test discovery" : "",
      genericTestFallback ? "generic test-task fallback ranked active test files" : "",
      mode === "Investigation" ? "task contains investigation keyword" : "",
      finalRiskLevel === "unknown" ? "insufficient repo signal for risk confidence" : ""
    ].filter(Boolean))
  };

  return {
    ...baseStartupContext,
    startupInstructions: startupInstructionsFor(baseStartupContext)
  };
}

export async function suggestContext(
  cwd: string,
  task: string,
  options: SuggestContextOptions = {}
): Promise<ContextSuggestion> {
  return toContextSuggestion(await buildStartupContext(cwd, task, options));
}
