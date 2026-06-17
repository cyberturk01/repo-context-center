import { stat } from "node:fs/promises";
import path from "node:path";
import { requiredContextFiles } from "../../core/contextFiles";
import { classifyRepoFile } from "../../core/repoFileClassifier";
import { listFilesRecursive, pathExists, readTextFile } from "../../core/fileSystem";
import { buildStartupContext, focusStartupContextForStart, type StartupContext } from "../../core/suggester";
import type { CliIO } from "../index";

interface WorkOptions {
  contextBudget: ContextBudget;
  json: boolean;
  maxFiles: number;
  task: string;
}

interface TargetedLookupHint {
  path: string;
  term: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  score: number;
  index: number;
}

interface WorkRecommendation {
  path: string;
  reasons: string[];
}

type ContextBudget = "minimal" | "balanced" | "deep";
type ReadFirstPriority = "required" | "task_specific" | "optional" | "skipped";

interface ReadFirstGuidanceItem {
  path: string;
  reason: string;
  priority: ReadFirstPriority;
}

interface ReadFirstGuidance {
  required: ReadFirstGuidanceItem[];
  taskSpecific: ReadFirstGuidanceItem[];
  optional: ReadFirstGuidanceItem[];
  skipped: ReadFirstGuidanceItem[];
}

interface WorkMapFreshness {
  status: "fresh" | "maybe_stale" | "stale" | "unknown";
  score: number;
  reason: string;
  latestContextUpdate: string | null;
  latestRelevantSourceChange: string | null;
  affectedFiles: string[];
  affectedContextFiles: string[];
  message: string;
}

interface WorkBrief {
  task: string;
  mapFreshness: WorkMapFreshness;
  routingGuidance: string[];
  startupContext: StartupContext;
  recommendedFiles: WorkRecommendation[];
  relevantTests: WorkRecommendation[];
  targetedLookupHints: Array<Omit<TargetedLookupHint, "index">>;
  relevantDecisions: string[];
  recentLogs: string[];
  tokenEstimate: {
    roughTokens: number | null;
    text: string;
  };
  risks: string[];
  readFirst: string[];
  readFirstGuidance: ReadFirstGuidance;
  nextCommand: string;
}

const decisionsPath = "docs/ai-context/DECISIONS.md";
const workLogPath = "docs/ai-context/WORK_LOG.md";
const lessonsPath = "docs/ai-context/LESSONS_LEARNED.md";
const changeLogPath = "docs/ai-context/CHANGE_LOG.md";
const logLimit = 3;
const decisionLimit = 3;
const targetedLookupLimit = 5;
const targetedContentReadLimit = 64 * 1024;
const usage = 'Usage: rcc work "<task>" [--json] [--context-budget minimal|balanced|deep] [--max-files <number>]';
const nextCommand = 'rcc done --summary "<summary>" --files auto --verify "<check>"';
const freshnessAffectedFileLimit = 5;
const freshnessImportantRoles = new Set(["source", "test", "workflow", "config", "package"]);
const contextFiles = requiredContextFiles;
const lowSignalTaskTerms = new Set([
  "add",
  "bug",
  "change",
  "changes",
  "command",
  "commands",
  "fix",
  "improve",
  "issue",
  "issues",
  "make",
  "task",
  "update",
  "instructions"
]);

function parseWorkOptions(args: string[]): WorkOptions | undefined {
  let contextBudget: ContextBudget = "balanced";
  let json = false;
  let maxFiles = 50;
  const taskParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--context-budget") {
      const value = args[index + 1];
      if (value !== "minimal" && value !== "balanced" && value !== "deep") {
        return undefined;
      }
      contextBudget = value;
      index += 1;
      continue;
    }

    if (arg === "--max-files") {
      const value = Number.parseInt(args[index + 1] ?? "", 10);
      if (!Number.isInteger(value) || value < 1) {
        return undefined;
      }
      maxFiles = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return undefined;
    }

    taskParts.push(arg);
  }

  const task = taskParts.join(" ").trim();
  if (!task) {
    return undefined;
  }

  return {
    contextBudget,
    json,
    maxFiles,
    task
  };
}

function formatList(values: string[], fallback: string): string[] {
  if (values.length === 0) {
    return [`- ${fallback}`];
  }

  return values.map((value) => `- ${value}`);
}

function tokenize(value: string): string[] {
  return [...new Set(value
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((token) => token.length > 1))];
}

function targetedLookupTerms(task: string): string[] {
  return tokenize(task)
    .filter((token) => token.length > 2)
    .filter((token) => !lowSignalTaskTerms.has(token));
}

function compactReason(reasons: string[] | undefined): string {
  if (!reasons || reasons.length === 0) {
    return "";
  }

  return ` (${reasons.slice(0, 2).join("; ")})`;
}

function formatRecommendedFiles(startup: StartupContext): string[] {
  if (startup.likelySourceFiles.length === 0) {
    if (startup.readFirstDocs.length > 0) {
      return startup.readFirstDocs.map((file) => `- ${file}`);
    }

    const reason = startup.emptyRecommendationReasons.source
      ? ` ${startup.emptyRecommendationReasons.source}`
      : " Start from RCC context docs before broad search.";
    return [`- none.${reason}`];
  }

  return startup.likelySourceFiles.map((file) => {
    return `- ${file}${compactReason(startup.recommendationReasons[file])}`;
  });
}

function recommendationItems(paths: string[], startup: StartupContext): WorkRecommendation[] {
  return paths.map((file) => ({
    path: file,
    reasons: startup.recommendationReasons[file] ?? []
  }));
}

function formatRecommendedTests(startup: StartupContext): string[] {
  if (startup.likelyTests.length === 0) {
    const reason = startup.emptyRecommendationReasons.test
      ? ` ${startup.emptyRecommendationReasons.test}`
      : " Find nearby tests after inspecting source.";
    return [`- none.${reason}`];
  }

  return startup.likelyTests.map((file) => {
    return `- ${file}${compactReason(startup.recommendationReasons[file])}`;
  });
}

function formatTargetedLookupHints(hints: TargetedLookupHint[]): string[] {
  if (hints.length === 0) {
    return ['- none. use rcc find "<keyword>" for targeted lookup.'];
  }

  return hints.flatMap((hint, index) => [
    `${index + 1}. ${hint.path}`,
    `   reason: ${hint.reason}`,
    `   confidence: ${hint.confidence}`
  ]);
}

function basenameWithoutExtensions(filePath: string): string {
  const basename = path.posix.basename(filePath).toLowerCase();
  const firstDot = basename.indexOf(".");

  return firstDot === -1 ? basename : basename.slice(0, firstDot);
}

function pathParts(filePath: string): string[] {
  return filePath.toLowerCase().split(/[/.\\_-]+/).filter(Boolean);
}

function termPattern(term: string): RegExp {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "i");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hintConfidence(score: number): TargetedLookupHint["confidence"] {
  if (score >= 80) {
    return "high";
  }
  if (score >= 55) {
    return "medium";
  }

  return "low";
}

function makeLookupHint(path: string, term: string, score: number, reason: string, index: number): TargetedLookupHint {
  return {
    path,
    term,
    reason,
    confidence: hintConfidence(score),
    score,
    index
  };
}

function isCliCommandPath(filePath: string): boolean {
  return /^src\/cli\/commands\/[^/]+\.[^.]+$/i.test(filePath);
}

function isLockFile(filePath: string): boolean {
  return /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|composer\.lock|poetry\.lock|cargo\.lock)$/i.test(filePath);
}

function routingReferencedPaths(startup: StartupContext): Set<string> {
  return new Set([
    ...startup.likelySourceFiles,
    ...startup.likelyTests,
    ...startup.readFirstDocs.filter((file) => !file.startsWith("docs/ai-context/"))
  ]);
}

function sourceStemMap(files: string[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const file of files) {
    if (classifyRepoFile(file).role !== "source") {
      continue;
    }

    const stem = basenameWithoutExtensions(file);
    if (!map.has(stem)) {
      map.set(stem, file);
    }
  }

  return map;
}

function bestPathMatch(
  filePath: string,
  terms: string[],
  index: number,
  startupReferenced: Set<string>,
  sourceStems: Map<string, string>
): TargetedLookupHint | undefined {
  const lowerPath = filePath.toLowerCase();
  const basenameStem = basenameWithoutExtensions(filePath);
  const parts = pathParts(filePath);
  const parentParts = path.posix.dirname(lowerPath).split(/[/.\\_-]+/).filter(Boolean);
  let best: TargetedLookupHint | undefined;

  for (const term of terms) {
    let score = 0;
    let reason = "";

    if (path.posix.basename(lowerPath) === term) {
      score = 100;
      reason = `exact filename matched "${term}"`;
    } else if (isCliCommandPath(filePath) && basenameStem === term) {
      score = 94;
      reason = `matched command name "${term}"`;
    } else if (classifyRepoFile(filePath).role === "test" && sourceStems.has(basenameStem) && terms.includes(basenameStem)) {
      score = 88;
      reason = `paired test for ${basenameStem} source file`;
    } else if (basenameStem === term) {
      score = 90;
      reason = `matched filename stem "${term}"`;
    } else if (startupReferenced.has(filePath)) {
      score = 76;
      reason = "referenced by task routing guidance";
    } else if (parts.includes(term)) {
      score = parentParts.includes(term) ? 58 : 52;
      reason = parentParts.includes(term)
        ? `matched parent folder "${term}"`
        : `matched path segment "${term}"`;
    } else if (lowerPath.includes(term)) {
      score = 38;
      reason = `weak path match for "${term}"`;
    }

    if (score > (best?.score ?? 0)) {
      best = makeLookupHint(filePath, term, score, reason, index);
    }
  }

  return best;
}

async function contentMatch(
  cwd: string,
  filePath: string,
  terms: string[]
): Promise<{ term: string; matches: number } | undefined> {
  const fullPath = path.join(cwd, filePath);
  const fileStat = await stat(fullPath);
  if (fileStat.size > targetedContentReadLimit) {
    return undefined;
  }

  const content = await readTextFile(fullPath);
  let best: { term: string; matches: number } | undefined;

  for (const term of terms) {
    const matches = content.match(new RegExp(termPattern(term).source, "gi"))?.length ?? 0;
    if (matches > (best?.matches ?? 0)) {
      best = { term, matches };
    }
  }

  return best && best.matches > 0 ? best : undefined;
}

function shouldScanForTargetedLookup(filePath: string): boolean {
  const info = classifyRepoFile(filePath);

  if (info.isNoise || info.role === "asset" || info.role === "generated" || info.role === "snapshot") {
    return false;
  }

  if (
    filePath.startsWith(".git/")
    || filePath.startsWith(".repo-context-center/")
    || filePath.startsWith("docs/ai-context/")
    || isLockFile(filePath)
  ) {
    return false;
  }

  return ["source", "test", "workflow", "config", "package", "docs", "unknown"].includes(info.role);
}

async function targetedLookupHints(cwd: string, task: string, startup: StartupContext): Promise<TargetedLookupHint[]> {
  const terms = targetedLookupTerms(task);
  if (terms.length === 0) {
    return [];
  }

  const repoFiles = (await listFilesRecursive(cwd)).filter(shouldScanForTargetedLookup);
  const startupReferenced = routingReferencedPaths(startup);
  const sourceStems = sourceStemMap(repoFiles);
  const candidates: TargetedLookupHint[] = [];

  for (let index = 0; index < repoFiles.length; index += 1) {
    const filePath = repoFiles[index];
    let hint = bestPathMatch(filePath, terms, index, startupReferenced, sourceStems);

    try {
      const content = await contentMatch(cwd, filePath, terms);
      if (content) {
        const contentScore = Math.min(48, 24 + content.matches * 4);
        if (!hint || contentScore > hint.score) {
          hint = makeLookupHint(
            filePath,
            content.term,
            contentScore,
            `weak semantic match for "${content.term}"`,
            index
          );
        } else {
          hint.score += Math.min(4, content.matches);
          hint.confidence = hintConfidence(hint.score);
        }
      }
    } catch {
      // Ignore unreadable files; lookup hints are opportunistic.
    }

    if (!hint) {
      continue;
    }

    if (hint.score < 25) {
      continue;
    }

    candidates.push(hint);
  }

  const deduped = new Map<string, TargetedLookupHint>();
  for (const candidate of candidates) {
    const current = deduped.get(candidate.path);
    if (!current || candidate.score > current.score) {
      deduped.set(candidate.path, candidate);
    }
  }

  const sortedHints = [...deduped.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftRole = classifyRepoFile(left.path).role;
      const rightRole = classifyRepoFile(right.path).role;
      const roleOrder = ["source", "test", "workflow", "config", "docs", "unknown"];
      const roleDelta = roleOrder.indexOf(leftRole) - roleOrder.indexOf(rightRole);
      if (roleDelta !== 0) {
        return roleDelta;
      }

      return left.path.localeCompare(right.path);
    });
  const qualityHints = sortedHints.filter((hint) => hint.confidence !== "low");

  return (qualityHints.length >= 3 ? qualityHints : sortedHints).slice(0, targetedLookupLimit);
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [];
  }

  const cells: string[] = [];
  let cell = "";
  const inner = trimmed.slice(1, -1);

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === "|" && inner[index - 1] !== "\\") {
      cells.push(cell.replace(/\\\|/g, "|").replace(/`/g, "").trim());
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell.replace(/\\\|/g, "|").replace(/`/g, "").trim());
  return cells;
}

function recentTableRows(content: string, limit: number): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length >= 3 && cells[0] !== "Date" && !cells.every((cell) => /^-+$/.test(cell)))
    .slice(-limit)
    .reverse()
    .map((cells) => cells.slice(0, 4).filter(Boolean).join(" | "));
}

function recentBulletLines(content: string, limit: number): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") && !line.includes("repo-context-center:"))
    .slice(-limit)
    .reverse()
    .map((line) => line.replace(/^- /, ""));
}

function recentWorkSummaryLines(content: string, limit: number): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- Summary: "))
    .slice(-limit)
    .reverse()
    .map((line) => line.replace(/^- Summary: /, ""));
}

function normalizeEntry(entry: string): string {
  return entry
    .replace(/^[^:]+:\s*/, "")
    .replace(/^\d{4}-\d{2}-\d{2}(?:T[^\s|]+)?\s*\|\s*/, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function dedupeEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const entry of entries) {
    const key = normalizeEntry(entry);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

function decisionMatches(cells: string[], startup: StartupContext): boolean {
  const haystack = cells.slice(1).join(" ").toLowerCase();
  const taskTokens = tokenize(startup.task);
  const likelyFiles = [...startup.likelySourceFiles, ...startup.likelyTests];

  return taskTokens.some((token) => haystack.includes(token))
    || likelyFiles.some((file) => file && haystack.includes(file.toLowerCase()));
}

async function readRelevantDecisions(cwd: string, startup: StartupContext): Promise<string[]> {
  const fullPath = path.join(cwd, decisionsPath);
  if (!(await pathExists(fullPath))) {
    return [];
  }

  const content = await readTextFile(fullPath);
  const rows = content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length >= 5 && cells[0] !== "Date" && !cells.every((cell) => /^-+$/.test(cell)))
    .filter((cells) => decisionMatches(cells, startup))
    .slice(-decisionLimit)
    .reverse()
    .map((cells) => `${cells[0]} | ${cells[1]} | ${cells[2]} | ${cells[3]}`);

  return dedupeEntries(rows).slice(0, decisionLimit);
}

async function readRecentLogs(cwd: string): Promise<string[]> {
  const entries: string[] = [];
  const logFiles = [
    { label: "Work", path: workLogPath, reader: recentWorkSummaryLines },
    { label: "Change", path: changeLogPath, reader: recentTableRows },
    { label: "Lesson", path: lessonsPath, reader: recentBulletLines }
  ];

  for (const file of logFiles) {
    const fullPath = path.join(cwd, file.path);
    if (!(await pathExists(fullPath))) {
      continue;
    }

    const content = await readTextFile(fullPath);
    for (const entry of file.reader(content, logLimit * 2)) {
      entries.push(`${file.label}: ${entry}`);
    }
  }

  return dedupeEntries(entries).slice(0, logLimit);
}

async function fileMtimeMs(cwd: string, filePath: string): Promise<number | undefined> {
  try {
    return (await stat(path.join(cwd, filePath))).mtimeMs;
  } catch {
    return undefined;
  }
}

function isoFromMs(value: number | undefined): string | null {
  return typeof value === "number" ? new Date(value).toISOString() : null;
}

function statusMessage(freshness: Omit<WorkMapFreshness, "message">): string {
  return `${freshness.status}. ${freshness.reason}`;
}

function parsedMapGeneratedAt(content: string): number | undefined {
  const generatedRow = content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .find((cells) => cells.length >= 4 && cells[1] === "repo-context-center map --write");

  const date = generatedRow?.[0];
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return undefined;
  }

  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function contextFileUpdate(cwd: string, filePath: string): Promise<{ path: string; time: number } | undefined> {
  const mtime = await fileMtimeMs(cwd, filePath);
  if (mtime === undefined) {
    return undefined;
  }

  if (filePath !== changeLogPath) {
    return { path: filePath, time: mtime };
  }

  try {
    const metadataTime = parsedMapGeneratedAt(await readTextFile(path.join(cwd, filePath)));
    return { path: filePath, time: Math.max(mtime, metadataTime ?? 0) };
  } catch {
    return { path: filePath, time: mtime };
  }
}

function isFreshnessRelevantRepoFile(filePath: string): boolean {
  if (filePath.startsWith(".git/") || filePath.startsWith("docs/ai-context/archive/")) {
    return false;
  }

  const info = classifyRepoFile(filePath);
  return !info.isNoise && info.role !== "asset" && info.role !== "generated" && !contextFiles.includes(filePath as typeof contextFiles[number]);
}

function isImportantFreshnessFile(filePath: string): boolean {
  return freshnessImportantRoles.has(classifyRepoFile(filePath).role);
}

async function assessMapFreshness(cwd: string): Promise<WorkMapFreshness> {
  const contextUpdates = (await Promise.all(contextFiles.map((file) => contextFileUpdate(cwd, file))))
    .filter((value): value is { path: string; time: number } => value !== undefined);

  if (contextUpdates.length === 0) {
    const base = {
      status: "unknown" as const,
      score: 0,
      reason: "Run npx repo-context-center init to generate context.",
      latestContextUpdate: null,
      latestRelevantSourceChange: null,
      affectedFiles: [],
      affectedContextFiles: []
    };
    return { ...base, message: statusMessage(base) };
  }

  const latestContext = contextUpdates.reduce((latest, entry) => entry.time > latest.time ? entry : latest);
  const repoFiles = await listFilesRecursive(cwd);
  const relevantChanges = (await Promise.all(repoFiles
    .filter(isFreshnessRelevantRepoFile)
    .map(async (file) => {
      const time = await fileMtimeMs(cwd, file);
      return time === undefined ? undefined : { path: file, time };
    })))
    .filter((value): value is { path: string; time: number } => value !== undefined);
  const newerChanges = relevantChanges
    .filter((entry) => entry.time > latestContext.time + 1000)
    .sort((left, right) => right.time - left.time || left.path.localeCompare(right.path));
  const importantChanges = newerChanges.filter((entry) => isImportantFreshnessFile(entry.path));
  const latestRelevantSource = newerChanges[0] ?? relevantChanges
    .sort((left, right) => right.time - left.time || left.path.localeCompare(right.path))[0];

  if (importantChanges.length > 0) {
    const base = {
      status: "stale" as const,
      score: 35,
      reason: "Important source, config, workflow, package, or test files changed after the last context generation.",
      latestContextUpdate: isoFromMs(latestContext.time),
      latestRelevantSourceChange: isoFromMs(latestRelevantSource?.time),
      affectedFiles: importantChanges.slice(0, freshnessAffectedFileLimit).map((entry) => entry.path),
      affectedContextFiles: contextUpdates.map((entry) => entry.path)
    };
    return { ...base, message: statusMessage(base) };
  }

  if (newerChanges.length > 0) {
    const base = {
      status: "maybe_stale" as const,
      score: 68,
      reason: "Repository files changed after the last context generation, but their impact on context is unclear.",
      latestContextUpdate: isoFromMs(latestContext.time),
      latestRelevantSourceChange: isoFromMs(latestRelevantSource?.time),
      affectedFiles: newerChanges.slice(0, freshnessAffectedFileLimit).map((entry) => entry.path),
      affectedContextFiles: contextUpdates.map((entry) => entry.path)
    };
    return { ...base, message: statusMessage(base) };
  }

  const base = {
    status: "fresh" as const,
    score: 100,
    reason: "Context is newer than recent source, config, workflow, package, and test changes.",
    latestContextUpdate: isoFromMs(latestContext.time),
    latestRelevantSourceChange: isoFromMs(latestRelevantSource?.time),
    affectedFiles: [],
    affectedContextFiles: contextUpdates.map((entry) => entry.path)
  };
  return { ...base, message: statusMessage(base) };
}

function mapFreshnessLines(mapFreshness: WorkMapFreshness): string[] {
  const lines = [
    `Status: ${mapFreshness.status}`,
    `Score: ${mapFreshness.score}/100`,
    `Reason: ${mapFreshness.reason}`
  ];

  if (mapFreshness.status !== "fresh") {
    lines.push("", "Recommended:", "rcc map --write");
  }

  return lines;
}

function riskLines(startup: StartupContext): string[] {
  const lines = [`- ${startup.riskLevel}`];
  const riskReasons = startup.reasons.filter((reason) => (
    reason.includes("risk")
    || reason.includes("hotspot")
    || reason.includes("dependency")
    || reason.includes("insufficient")
  ));

  for (const reason of riskReasons.slice(0, 2)) {
    lines.push(`- ${reason}`);
  }

  if (startup.readFirstDocs.includes("docs/ai-context/RISK_REGISTER.md")) {
    lines.push("- Check docs/ai-context/RISK_REGISTER.md before editing.");
  }

  return lines;
}

function riskValues(startup: StartupContext): string[] {
  return riskLines(startup).map((line) => line.replace(/^- /, ""));
}

function includesTaskToken(tokens: string[], values: string[]): boolean {
  return values.some((value) => tokens.includes(value));
}

function hasStrongLookupHints(lookupHints: TargetedLookupHint[]): boolean {
  return lookupHints.filter((hint) => hint.confidence === "high" || hint.confidence === "medium").length >= 2;
}

function isBroadOrAmbiguousTask(task: string): boolean {
  const meaningfulTerms = targetedLookupTerms(task);
  return meaningfulTerms.length === 0 || /\b(clean\s*up|stuff|things)\b/i.test(task);
}

function hasWeakRouting(startup: StartupContext, lookupHints: TargetedLookupHint[]): boolean {
  return startup.likelySourceFiles.length === 0
    || startup.emptyRecommendationReasons.source !== undefined
    || !hasStrongLookupHints(lookupHints);
}

function guidanceItem(path: string, reason: string, priority: ReadFirstPriority): ReadFirstGuidanceItem {
  return { path, reason, priority };
}

function emptyReadFirstGuidance(): ReadFirstGuidance {
  return {
    required: [],
    taskSpecific: [],
    optional: [],
    skipped: []
  };
}

function addGuidanceItem(guidance: ReadFirstGuidance, item: ReadFirstGuidanceItem): void {
  if (item.priority === "task_specific") {
    guidance.taskSpecific.push(item);
  } else {
    guidance[item.priority].push(item);
  }
}

async function existingReadFirstContextFiles(cwd: string): Promise<string[]> {
  const candidates = [
    "AGENTS.md",
    "docs/ai-context/TASK_ROUTING.md",
    "docs/ai-context/MODULE_INDEX.md",
    "docs/ai-context/DEPENDENCY_MAP.md",
    "docs/ai-context/RISK_REGISTER.md"
  ];
  const existing = await Promise.all(candidates.map(async (file) => (
    await pathExists(path.join(cwd, file)) ? file : undefined
  )));

  return existing.filter((file): file is string => file !== undefined);
}

function priorityForBudget(priority: ReadFirstPriority, contextBudget: ContextBudget): ReadFirstPriority {
  if (contextBudget === "minimal") {
    if (priority === "required") {
      return "required";
    }
    return priority === "task_specific" ? "optional" : "skipped";
  }

  return priority;
}

function buildReadFirstGuidance(
  startup: StartupContext,
  lookupHints: TargetedLookupHint[],
  contextBudget: ContextBudget,
  existingFiles: string[]
): ReadFirstGuidance {
  const guidance = emptyReadFirstGuidance();
  const existing = new Set(existingFiles);
  const tokens = targetedLookupTerms(startup.task);
  const readFirstDocs = new Set(startup.readFirstDocs);
  const routingWeak = hasWeakRouting(startup, lookupHints);
  const broadTask = isBroadOrAmbiguousTask(startup.task);
  const architectureSignal = includesTaskToken(tokens, [
    "architecture",
    "architectural",
    "module",
    "modules",
    "refactor",
    "component",
    "components",
    "service",
    "services"
  ]);
  const dependencySignal = includesTaskToken(tokens, [
    "dependency",
    "dependencies",
    "import",
    "imports",
    "build",
    "package",
    "packages",
    "integration",
    "integrations"
  ]);
  const riskSignal = includesTaskToken(tokens, [
    "security",
    "risk",
    "risky",
    "release",
    "workflow",
    "workflows",
    "scanning",
    "scan",
    "freshness",
    "reporting",
    "report",
    "command",
    "commands",
    "behavior",
    "cli",
    "stdout",
    "stderr",
    "flag",
    "flags",
    "output"
  ]);

  if (existing.has("AGENTS.md")) {
    addGuidanceItem(guidance, guidanceItem("AGENTS.md", "repository agent workflow", "required"));
  }

  const docs: Array<{ path: string; signal: boolean; taskReason: string; optionalReason: string; skippedReason: string }> = [
    {
      path: "docs/ai-context/TASK_ROUTING.md",
      signal: routingWeak || broadTask,
      taskReason: routingWeak
        ? "routing confidence is low or targeted lookup hints are weak"
        : "task is broad or ambiguous",
      optionalReason: "routing appears strong, but use if targeted hints are insufficient",
      skippedReason: "routing appears strong and targeted lookup hints are available"
    },
    {
      path: "docs/ai-context/MODULE_INDEX.md",
      signal: architectureSignal,
      taskReason: "task has architecture/module/refactor signal",
      optionalReason: "use if the change crosses module boundaries",
      skippedReason: "task is not architecture/module related"
    },
    {
      path: "docs/ai-context/DEPENDENCY_MAP.md",
      signal: dependencySignal,
      taskReason: "task has dependency/import/build/package/integration signal",
      optionalReason: "use if imports, packages, or integration boundaries become unclear",
      skippedReason: "task is not dependency/build/package related"
    },
    {
      path: "docs/ai-context/RISK_REGISTER.md",
      signal: riskSignal,
      taskReason: "task has security/risk/release/workflow/scanning/freshness/reporting/command-behavior signal",
      optionalReason: "use if the change touches high-risk behavior",
      skippedReason: "task has no explicit risk/security/release signal"
    }
  ];

  for (const doc of docs) {
    if (!existing.has(doc.path)) {
      continue;
    }

    let priority: ReadFirstPriority = doc.signal ? "task_specific" : "skipped";
    let reason = doc.signal ? doc.taskReason : doc.skippedReason;

    if (contextBudget === "deep") {
      priority = doc.signal || readFirstDocs.has(doc.path) ? "task_specific" : "optional";
      reason = doc.signal
        ? doc.taskReason
        : readFirstDocs.has(doc.path)
          ? "recommended by existing startup routing"
          : doc.optionalReason;
    } else if (!doc.signal && doc.path === "docs/ai-context/TASK_ROUTING.md") {
      priority = "optional";
      reason = doc.optionalReason;
    }

    addGuidanceItem(guidance, guidanceItem(doc.path, reason, priorityForBudget(priority, contextBudget)));
  }

  return guidance;
}

function readFirstCompatibilityPaths(guidance: ReadFirstGuidance): string[] {
  return [...guidance.required, ...guidance.taskSpecific].map((item) => item.path);
}

function formatReadFirstGroup(title: string, items: ReadFirstGuidanceItem[]): string[] {
  if (items.length === 0) {
    return [title, "- none"];
  }

  return [
    title,
    ...items.flatMap((item) => [
      `- ${item.path}`,
      `  reason: ${item.reason}`
    ])
  ];
}

function formatReadFirstGuidance(guidance: ReadFirstGuidance): string[] {
  if (
    guidance.required.length === 0
    && guidance.taskSpecific.length === 0
    && guidance.optional.length === 0
    && guidance.skipped.length === 0
  ) {
    return ["- no RCC context files found; run npx repo-context-center init to install them"];
  }

  return [
    ...formatReadFirstGroup("Required:", guidance.required),
    "",
    ...formatReadFirstGroup("Task-specific:", guidance.taskSpecific),
    "",
    ...formatReadFirstGroup("Optional if unclear:", guidance.optional),
    "",
    ...formatReadFirstGroup("Skipped for now:", guidance.skipped)
  ];
}

function targetLookupHintForText(hint: Omit<TargetedLookupHint, "index">): TargetedLookupHint {
  return {
    ...hint,
    index: 0
  };
}

function renderWorkBriefLines(brief: WorkBrief): string[] {
  return [
    "repo-context-center work brief",
    "",
    "Task intent:",
    brief.task,
    "",
    "Map freshness:",
    ...mapFreshnessLines(brief.mapFreshness),
    "",
    "Recommended files to inspect first:",
    ...formatRecommendedFiles(brief.startupContext).slice(0, 8),
    "",
    "Relevant tests or test folders:",
    ...formatRecommendedTests(brief.startupContext).slice(0, 6),
    "",
    "Relevant decisions:",
    ...formatList(brief.relevantDecisions, "none. no matching decision was found."),
    "",
    "Recent logs:",
    ...formatList(brief.recentLogs, "none. no recent log was found."),
    "",
    "Token estimate:",
    `- ${brief.tokenEstimate.text}`,
    "",
    "Known risks:",
    ...brief.risks.map((risk) => `- ${risk}`),
    "",
    "Read-first guidance:",
    ...formatReadFirstGuidance(brief.readFirstGuidance),
    "",
    "Targeted lookup hints:",
    ...formatTargetedLookupHints(brief.targetedLookupHints.map(targetLookupHintForText)),
    "",
    "Fast lookup:",
    '- For targeted lookup, use: rcc find "<keyword>"',
    "- Prefer this before broad repo search when the target is unclear.",
    "",
    "Next command after meaningful work:",
    "```sh",
    brief.nextCommand,
    "```"
  ];
}

function formatWorkBrief(brief: WorkBrief): string {
  return `${renderWorkBriefLines(brief).join("\n")}\n`;
}

function buildBriefWithTokenEstimate(brief: WorkBrief): WorkBrief {
  const preliminary = renderWorkBriefLines({
    ...brief,
    tokenEstimate: {
      roughTokens: null,
      text: "calculating."
    }
  });
  const roughTokens = Math.ceil(preliminary.join("\n").length / 4);

  return {
    ...brief,
    tokenEstimate: {
      roughTokens,
      text: `roughly ${roughTokens} tokens for this brief.`
    }
  };
}

function buildWorkBrief(
  startup: StartupContext,
  mapFreshness: WorkMapFreshness,
  decisions: string[],
  logs: string[],
  lookupHints: TargetedLookupHint[],
  readFirstGuidance: ReadFirstGuidance
): WorkBrief {
  const brief: WorkBrief = {
    task: startup.task,
    mapFreshness,
    routingGuidance: startup.startupInstructions,
    startupContext: startup,
    recommendedFiles: recommendationItems(startup.likelySourceFiles, startup),
    relevantTests: recommendationItems(startup.likelyTests, startup),
    targetedLookupHints: lookupHints.map((hint) => ({
      path: hint.path,
      term: hint.term,
      reason: hint.reason,
      confidence: hint.confidence,
      score: hint.score
    })),
    relevantDecisions: decisions,
    recentLogs: logs,
    tokenEstimate: {
      roughTokens: null,
      text: "unknown"
    },
    risks: riskValues(startup),
    readFirst: readFirstCompatibilityPaths(readFirstGuidance),
    readFirstGuidance,
    nextCommand
  };

  return buildBriefWithTokenEstimate(brief);
}

export async function workCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseWorkOptions(args);
  if (!options) {
    io.stderr(`${usage}\n`);
    return 1;
  }

  const startupContext = await buildStartupContext(io.cwd, options.task, {
    maxFiles: options.maxFiles,
    genericFallbackMaxTests: 5
  });
  const focusedStartupContext = focusStartupContextForStart(startupContext, {
    maxSourceFiles: Math.min(options.maxFiles, 8),
    maxTestFiles: Math.min(options.maxFiles, 6)
  });
  const [mapFreshness, decisions, logs, lookupHints] = await Promise.all([
    assessMapFreshness(io.cwd),
    readRelevantDecisions(io.cwd, focusedStartupContext),
    readRecentLogs(io.cwd),
    targetedLookupHints(io.cwd, options.task, focusedStartupContext)
  ]);
  const existingContextFiles = await existingReadFirstContextFiles(io.cwd);
  const readFirstGuidance = buildReadFirstGuidance(
    focusedStartupContext,
    lookupHints,
    options.contextBudget,
    existingContextFiles
  );

  const brief = buildWorkBrief(focusedStartupContext, mapFreshness, decisions, logs, lookupHints, readFirstGuidance);

  if (options.json) {
    io.stdout(`${JSON.stringify(brief, null, 2)}\n`);
    return 0;
  }

  io.stdout(formatWorkBrief(brief));
  return 0;
}
