import { readSuggestContext, type ContextDocument, type SuggestContextFile } from "./contextReader";

export type SuggestMode = "Compact" | "Investigation" | "Detailed";
export type RiskLevel = "low" | "medium" | "high";

export interface ContextSuggestion {
  task: string;
  mode: SuggestMode;
  contextFiles: SuggestContextFile[];
  likelySourceFiles: string[];
  likelyTests: string[];
  riskLevel: RiskLevel;
  reasons: string[];
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

function tokenize(text: string): string[] {
  return uniqueSorted(
    text
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
  return /(^|\/)(__tests__|tests?|e2e|cypress)(\/|$)|\.(test|spec)\./i.test(filePath);
}

function isLikelySourcePath(filePath: string): boolean {
  return !isLikelyTestPath(filePath) && !filePath.startsWith("docs/");
}

function findDocument(documents: ContextDocument[], file: SuggestContextFile): ContextDocument | undefined {
  return documents.find((document) => document.path === file);
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

function modeForTask(task: string, tokens: string[]): SuggestMode {
  if (investigationKeywords.some((keyword) => tokens.includes(keyword) || task.toLowerCase().includes(keyword))) {
    return "Investigation";
  }

  if (detailedKeywords.some((keyword) => task.toLowerCase().includes(keyword)) || tokens.length > 10) {
    return "Detailed";
  }

  return "Compact";
}

function riskFor(mode: SuggestMode, riskMatches: number, dependencyMatches: number): RiskLevel {
  if (mode === "Investigation" || riskMatches > 0) {
    return "high";
  }

  if (mode === "Detailed" || dependencyMatches > 0) {
    return "medium";
  }

  return "low";
}

export async function suggestContext(cwd: string, task: string): Promise<ContextSuggestion> {
  const documents = await readSuggestContext(cwd);
  const tokens = tokenize(task);
  const taskRouting = findDocument(documents, "docs/ai-context/TASK_ROUTING.md");
  const moduleIndex = findDocument(documents, "docs/ai-context/MODULE_INDEX.md");
  const dependencyMap = findDocument(documents, "docs/ai-context/DEPENDENCY_MAP.md");
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
  if (riskRegister && riskMatches.length > 0) {
    contextFiles.push(riskRegister.path);
  }
  if (hotspots && riskMatches.length > 0) {
    contextFiles.push(hotspots.path);
  }

  const mode = modeForTask(task, tokens);
  const riskLevel = riskFor(mode, riskMatches.length, dependencyModuleMatches.length + dependencyMatches.length);

  if (riskLevel === "high") {
    if (riskRegister) {
      contextFiles.push(riskRegister.path);
    }
    if (hotspots) {
      contextFiles.push(hotspots.path);
    }
  }

  return {
    task,
    mode,
    contextFiles: uniqueSorted(contextFiles) as SuggestContextFile[],
    likelySourceFiles: uniqueSorted(candidatePaths.filter(isLikelySourcePath)),
    likelyTests: uniqueSorted(candidatePaths.filter(isLikelyTestPath)),
    riskLevel,
    reasons: uniqueSorted([
      routingMatches.length > 0 ? "task matched routing guidance" : "",
      moduleMatches.length > 0 ? "task matched module index entries" : "",
      dependencyModuleMatches.length > 0 || dependencyMatches.length > 0 ? "module dependency guidance matched" : "",
      riskMatches.length > 0 ? "risk or hotspot guidance matched" : "",
      mode === "Investigation" ? "task contains investigation keyword" : ""
    ].filter(Boolean))
  };
}
