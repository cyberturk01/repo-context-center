import { stat } from "node:fs/promises";
import path from "node:path";
import { classifyRepoFile } from "../../core/repoFileClassifier";
import { listFilesRecursive, pathExists, readTextFile } from "../../core/fileSystem";
import { buildStartupContext, focusStartupContextForStart, type StartupContext } from "../../core/suggester";
import type { CliIO } from "../index";

interface WorkOptions {
  json: boolean;
  maxFiles: number;
  task: string;
}

interface TargetedLookupHint {
  path: string;
  term: string;
  score: number;
  index: number;
}

interface WorkRecommendation {
  path: string;
  reasons: string[];
}

interface WorkMapFreshness {
  status: "fresh" | "stale" | "unknown";
  message: string;
}

interface WorkBrief {
  task: string;
  mapFreshness: WorkMapFreshness;
  routingGuidance: string[];
  startupContext: StartupContext;
  recommendedFiles: WorkRecommendation[];
  relevantTests: WorkRecommendation[];
  targetedLookupHints: Array<Pick<TargetedLookupHint, "path" | "term">>;
  relevantDecisions: string[];
  recentLogs: string[];
  tokenEstimate: {
    roughTokens: number | null;
    text: string;
  };
  risks: string[];
  readFirst: string[];
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
const usage = 'Usage: rcc work "<task>" [--json] [--max-files <number>]';
const nextCommand = 'rcc done --summary "<summary>" --files auto --verify "<check>"';
const contextFiles = [
  "AGENTS.md",
  "docs/ai-context/TASK_ROUTING.md",
  "docs/ai-context/MODULE_INDEX.md",
  "docs/ai-context/PROJECT_MAP.md",
  "docs/ai-context/RISK_REGISTER.md",
  "docs/ai-context/DEPENDENCY_MAP.md",
  "docs/ai-context/SYMBOL_MAP.md",
  "docs/ai-context/TOKEN_BUDGET.md",
  "docs/ai-context/DO_NOT_READ.md",
  "docs/ai-context/HOTSPOTS.md"
];
const lowSignalTaskTerms = new Set([
  "add",
  "bug",
  "change",
  "changes",
  "fix",
  "issue",
  "issues",
  "make",
  "task",
  "update",
  "instructions"
]);

function parseWorkOptions(args: string[]): WorkOptions | undefined {
  let json = false;
  let maxFiles = 50;
  const taskParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
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

  return hints.map((hint) => `- ${hint.path} — matched "${hint.term}"`);
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

function bestPathMatch(filePath: string, terms: string[]): TargetedLookupHint | undefined {
  const lowerPath = filePath.toLowerCase();
  const basenameStem = basenameWithoutExtensions(filePath);
  const parts = pathParts(filePath);
  let best: TargetedLookupHint | undefined;

  for (const term of terms) {
    let score = 0;

    if (basenameStem === term || path.posix.basename(lowerPath) === term) {
      score = 120;
    } else if (parts.includes(term)) {
      score = 95;
    } else if (lowerPath.includes(term)) {
      score = 70;
    }

    if (score > (best?.score ?? 0)) {
      best = { path: filePath, term, score, index: 0 };
    }
  }

  return best;
}

function relatedLookupScore(filePath: string, terms: string[], role: string): number {
  const lowerPath = filePath.toLowerCase();
  let score = 0;

  if (role === "source") {
    score += 40;
  } else if (role === "test") {
    score += 12;
  } else if (role === "workflow") {
    score += 10;
  }

  if (lowerPath.startsWith("src/templates/")) {
    score += 18;
  }
  if (lowerPath === "agents.md" || lowerPath.endsWith("/agents.md")) {
    score += 16;
  }
  if (role === "test" && terms.some((term) => term === "agents" || term === "workflow")) {
    if (/tests\/(init|templates|agent-startup-adoption)\.test\./.test(lowerPath)) {
      score += 24;
    }
  }
  if (role === "source" && terms.some((term) => term === "agents" || term === "workflow")) {
    if (lowerPath.includes("templateinstaller")) {
      score += 40;
    }
  }

  return score;
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

  if (filePath.startsWith(".git/") || filePath.startsWith("docs/ai-context/archive/")) {
    return false;
  }

  return ["source", "test", "workflow", "config", "docs", "unknown"].includes(info.role);
}

async function targetedLookupHints(cwd: string, task: string): Promise<TargetedLookupHint[]> {
  const terms = targetedLookupTerms(task);
  if (terms.length === 0) {
    return [];
  }

  const repoFiles = (await listFilesRecursive(cwd)).filter(shouldScanForTargetedLookup);
  const candidates: TargetedLookupHint[] = [];

  for (let index = 0; index < repoFiles.length; index += 1) {
    const filePath = repoFiles[index];
    const info = classifyRepoFile(filePath);
    const pathMatch = bestPathMatch(filePath, terms);
    let hint: TargetedLookupHint | undefined = pathMatch
      ? { ...pathMatch, index }
      : undefined;

    try {
      const content = await contentMatch(cwd, filePath, terms);
      if (content) {
        const contentScore = Math.min(60, 25 + content.matches * 5);
        if (!hint || contentScore > hint.score) {
          hint = { path: filePath, term: content.term, score: contentScore, index };
        } else {
          hint.score += Math.min(20, content.matches * 3);
        }
      }
    } catch {
      // Ignore unreadable files; lookup hints are opportunistic.
    }

    if (!hint) {
      continue;
    }

    hint.score += relatedLookupScore(filePath, terms, info.role);
    candidates.push(hint);
  }

  return candidates
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
    })
    .slice(0, targetedLookupLimit);
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

async function mapFreshnessLine(cwd: string): Promise<string> {
  const existingContextTimes = (await Promise.all(contextFiles.map((file) => fileMtimeMs(cwd, file))))
    .filter((value): value is number => typeof value === "number");

  if (existingContextTimes.length === 0) {
    return "unknown. run npx repo-context-center init to generate context.";
  }

  const contextTime = Math.max(...existingContextTimes);
  const repoFiles = await listFilesRecursive(cwd);
  const sourceTimes = (await Promise.all(repoFiles
    .filter((file) => {
      const role = classifyRepoFile(file).role;
      return role === "source" || role === "test";
    })
    .map((file) => fileMtimeMs(cwd, file))))
    .filter((value): value is number => typeof value === "number");
  const latestSourceTime = sourceTimes.length > 0 ? Math.max(...sourceTimes) : 0;

  if (latestSourceTime > contextTime + 1000) {
    return "stale. source files changed after context generation.";
  }

  return "fresh. generated context is available.";
}

function normalizeMapFreshness(value: string): WorkMapFreshness {
  if (value.startsWith("fresh.")) {
    return { status: "fresh", message: value };
  }
  if (value.startsWith("stale.")) {
    return { status: "stale", message: value };
  }

  return { status: "unknown", message: value || "unknown" };
}

function formatMapFreshness(mapFreshness: WorkMapFreshness): string {
  return mapFreshness.message || mapFreshness.status || "unknown";
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

function targetLookupHintForText(hint: Pick<TargetedLookupHint, "path" | "term">): TargetedLookupHint {
  return {
    ...hint,
    score: 0,
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
    `- ${formatMapFreshness(brief.mapFreshness)}`,
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
    "Read first:",
    ...formatList(brief.readFirst, "no RCC context files found; run npx repo-context-center init to install them"),
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
  mapFreshness: string,
  decisions: string[],
  logs: string[],
  lookupHints: TargetedLookupHint[]
): WorkBrief {
  const brief: WorkBrief = {
    task: startup.task,
    mapFreshness: normalizeMapFreshness(mapFreshness),
    routingGuidance: startup.startupInstructions,
    startupContext: startup,
    recommendedFiles: recommendationItems(startup.likelySourceFiles, startup),
    relevantTests: recommendationItems(startup.likelyTests, startup),
    targetedLookupHints: lookupHints.map((hint) => ({
      path: hint.path,
      term: hint.term
    })),
    relevantDecisions: decisions,
    recentLogs: logs,
    tokenEstimate: {
      roughTokens: null,
      text: "unknown"
    },
    risks: riskValues(startup),
    readFirst: startup.readFirstDocs.slice(0, 4),
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
    mapFreshnessLine(io.cwd),
    readRelevantDecisions(io.cwd, focusedStartupContext),
    readRecentLogs(io.cwd),
    targetedLookupHints(io.cwd, options.task)
  ]);

  const brief = buildWorkBrief(focusedStartupContext, mapFreshness, decisions, logs, lookupHints);

  if (options.json) {
    io.stdout(`${JSON.stringify(brief, null, 2)}\n`);
    return 0;
  }

  io.stdout(formatWorkBrief(brief));
  return 0;
}
