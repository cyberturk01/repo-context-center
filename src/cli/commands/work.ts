import { stat } from "node:fs/promises";
import path from "node:path";
import { requiredContextFiles } from "../../core/contextFiles";
import { classifyRepoFile, type RepoFileRole } from "../../core/repoFileClassifier";
import { listFilesRecursive, pathExists, readTextFile } from "../../core/fileSystem";
import { buildStartupContext, focusStartupContextForStart, type StartupContext } from "../../core/suggester";
import { analyzeTaskIntent, weightedScore, type TaskIntentAnalysis } from "../../core/taskIntent";
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
  signal: TargetedLookupSignal;
  confidence: "high" | "medium" | "low";
  score: number;
  index: number;
}

type TargetedLookupSignal =
  | "exact-filename-match"
  | "command-name-match"
  | "filename-match"
  | "paired-test"
  | "task-routing"
  | "decision-memory"
  | "work-log"
  | "path-match"
  | "semantic-match";

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
  command: "work";
  task: string;
  contextBudget: ContextBudget;
  mapFreshness: WorkMapFreshness;
  routingGuidance: string[];
  startupContext: StartupContext;
  taskFiles: WorkRecommendation[];
  supportingTests: WorkRecommendation[];
  workflowDocs: WorkRecommendation[];
  contextDocs: WorkRecommendation[];
  recommendedFiles: WorkRecommendation[];
  relevantTests: WorkRecommendation[];
  targetedLookupHints: Array<Omit<TargetedLookupHint, "index">>;
  promotedFromTargetedLookup: Array<Omit<TargetedLookupHint, "index">>;
  relevantDecisions: string[];
  recentLogs: string[];
  tokenEstimate: {
    roughTokens: number | null;
    text: string;
  };
  risks: string[];
  cheapestPath: string[];
  avoid: string[];
  readFirst: string[];
  readFirstGuidance: ReadFirstGuidance;
  nextCheapestCommand: string;
  nextCommand: string;
}

interface PublicWorkBrief {
  schemaVersion: 1;
  command: "work";
  task: string;
  contextBudget: ContextBudget;
  mapFreshness: {
    status: WorkMapFreshness["status"];
    score: number;
    reason: string;
    latestContextUpdate: string | null;
    latestRelevantSourceChange: string | null;
    affectedFiles: string[];
    affectedContextFiles: string[];
  };
  recommendedFiles: PublicWorkFile[];
  relevantTests: PublicWorkFile[];
  taskFiles: PublicWorkFile[];
  supportingTests: PublicWorkFile[];
  workflowDocs: PublicWorkFile[];
  contextDocs: PublicWorkFile[];
  cheapestPath: string[];
  avoid: string[];
  nextCheapestCommand: string;
  promotedFromTargetedLookup: PublicTargetedLookupHint[];
  relevantDecisions: string[];
  recentLogs: string[];
  risks: PublicWorkRisk[];
  readFirstGuidance: {
    required: PublicReadFirstGuidanceItem[];
    taskSpecific: PublicReadFirstGuidanceItem[];
    optionalIfUnclear: PublicReadFirstGuidanceItem[];
    skippedForNow: PublicReadFirstGuidanceItem[];
  };
  readFirst: string[];
  targetedLookupHints: PublicTargetedLookupHint[];
  tokenEstimate: {
    briefTokens: number | null;
  };
  fastLookup: {
    command: string;
    guidance: string;
  };
  nextCommand: {
    command: string;
    when: string;
  };
}

interface PublicWorkFile {
  path: string;
  reason: string | null;
  confidence: TargetedLookupHint["confidence"] | null;
  score: number | null;
}

interface PublicReadFirstGuidanceItem {
  path: string;
  reason: string;
}

interface PublicTargetedLookupHint extends PublicWorkFile {
  signal: TargetedLookupSignal;
}

interface PublicWorkRisk {
  level: string;
  reason: string | null;
}

const decisionsPath = "docs/ai-context/DECISIONS.md";
const workLogPath = "docs/ai-context/WORK_LOG.md";
const lessonsPath = "docs/ai-context/LESSONS_LEARNED.md";
const changeLogPath = "docs/ai-context/CHANGE_LOG.md";
const logLimit = 3;
const decisionLimit = 3;
const targetedLookupLimit = 5;
const targetedContentReadLimit = 64 * 1024;
const strongLookupScoreThreshold = 70;
const usage = 'Usage: rcc work "<task>" [--json] [--context-budget minimal|balanced|deep] [--max-files <number>]';
const nextCommand = 'rcc done --summary "<summary>" --files auto --verify "<check>"';
const freshnessAffectedFileLimit = 5;
const freshnessImportantRoles = new Set(["source", "test", "workflow", "config", "package"]);
const defaultLookupRoleOrder: RepoFileRole[] = [
  "source",
  "test",
  "workflow",
  "config",
  "package",
  "docs",
  "fixture",
  "snapshot",
  "asset",
  "generated",
  "unknown"
];
const packageTaskLookupRoleOrder: RepoFileRole[] = [
  "source",
  "test",
  "package",
  "workflow",
  "config",
  "docs",
  "fixture",
  "snapshot",
  "asset",
  "generated",
  "unknown"
];
const workflowTaskLookupRoleOrder: RepoFileRole[] = [
  "workflow",
  "config",
  "package",
  "source",
  "test",
  "docs",
  "fixture",
  "snapshot",
  "asset",
  "generated",
  "unknown"
];
const contextFiles = requiredContextFiles;

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

function compactReason(reasons: string[] | undefined): string {
  if (!reasons || reasons.length === 0) {
    return "";
  }

  return ` (${reasons.slice(0, 2).join("; ")})`;
}

function recommendedInspectionFiles(startup: StartupContext): string[] {
  if (startup.likelySourceFiles.length === 0) {
    return [...new Set(startup.readFirstDocs)];
  }

  return [...new Set([
    ...startup.likelySourceFiles,
    ...startup.readFirstDocs.slice(0, 2)
  ])];
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

function recommendationFromPath(filePath: string, startup: StartupContext, hints: TargetedLookupHint[]): WorkRecommendation {
  const hint = hints.find((candidate) => candidate.path === filePath);
  const reasons = [
    ...(hint ? [hint.reason] : []),
    ...(startup.recommendationReasons[filePath] ?? [])
  ].filter(Boolean);

  return {
    path: filePath,
    reasons: uniquePaths(reasons)
  };
}

function recommendationItemsWithHints(
  paths: string[],
  startup: StartupContext,
  hints: TargetedLookupHint[]
): WorkRecommendation[] {
  return uniquePaths(paths).map((file) => recommendationFromPath(file, startup, hints));
}

function formatRecommendationSection(items: WorkRecommendation[], fallback: string): string[] {
  if (items.length === 0) {
    return [`- none. ${fallback}`];
  }

  return items.map((item) => `- ${item.path}${compactReason(item.reasons)}`);
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

function isMediumHighLookupHint(hint: TargetedLookupHint | Omit<TargetedLookupHint, "index">): boolean {
  return hint.confidence === "high" || hint.score >= strongLookupScoreThreshold;
}

function lookupRoleOrder(taskIntent: TaskIntentAnalysis): RepoFileRole[] {
  if (taskIntent.hasWorkflowDomain) {
    return workflowTaskLookupRoleOrder;
  }

  return taskAllowsLockFile(taskIntent) ? packageTaskLookupRoleOrder : defaultLookupRoleOrder;
}

function lookupRoleRank(role: RepoFileRole, taskIntent: TaskIntentAnalysis): number {
  const order = lookupRoleOrder(taskIntent);
  const index = order.indexOf(role);

  return index === -1 ? order.length : index;
}

function makeLookupHint(
  path: string,
  term: string,
  score: number,
  reason: string,
  signal: TargetedLookupSignal,
  index: number
): TargetedLookupHint {
  return {
    path,
    term,
    reason,
    signal,
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

function isAgentRulePath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  const basename = path.posix.basename(normalized);

  return basename === "agents.md"
    || basename === "agent.md"
    || basename === "instructions.md"
    || normalized.includes("/agents/")
    || normalized.includes("/agent-rules/");
}

function isAgentOrContextLookupPath(filePath: string): boolean {
  return isAgentRulePath(filePath) || filePath.startsWith("docs/ai-context/");
}

function taskTargetsAgentRules(taskIntent: TaskIntentAnalysis): boolean {
  return taskIntent.lookupTerms.some((term) => [
    "agent",
    "agents",
    "instruction",
    "instructions"
  ].includes(term));
}

function shouldDemoteAgentAndContextHints(taskIntent: TaskIntentAnalysis): boolean {
  return taskIntent.isCodeInvestigation && !taskTargetsAgentRules(taskIntent);
}

function sourceToPairedTestStems(files: string[]): Set<string> {
  const sourceStems = sourceStemMap(files);
  const stems = new Set<string>();

  for (const file of files) {
    if (classifyRepoFile(file).role !== "test") {
      continue;
    }

    const stem = basenameWithoutExtensions(file);
    if (sourceStems.has(stem)) {
      stems.add(stem);
    }
  }

  return stems;
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

function taskAllowsLockFile(taskIntent: TaskIntentAnalysis): boolean {
  return taskIntent.lookupTerms.some((term) => [
    "dependency",
    "dependencies",
    "install",
    "lock",
    "lockfile",
    "package",
    "packages",
    "script",
    "scripts",
    "npm",
    "pnpm",
    "yarn",
    "bun"
  ].includes(term));
}

function lookupPenalty(filePath: string, taskIntent: TaskIntentAnalysis): number {
  const info = classifyRepoFile(filePath);
  let penalty = 0;

  if (filePath.startsWith("docs/ai-context/")) {
    penalty += 70;
  }
  if (filePath.startsWith(".repo-context-center/")) {
    penalty += 70;
  }
  if (info.role === "fixture") {
    penalty += 70;
  }
  if (info.role === "snapshot") {
    penalty += 70;
  }
  if (info.role === "generated") {
    penalty += 70;
  }
  if (info.role === "asset") {
    penalty += 70;
  }
  if (/\/archive\//i.test(filePath) || filePath.startsWith("archive/") || filePath.startsWith("archives/")) {
    penalty += 60;
  }
  if (isLockFile(filePath) && !taskAllowsLockFile(taskIntent)) {
    penalty += 70;
  }

  return penalty;
}

function applyLookupPenalty(hint: TargetedLookupHint, taskIntent: TaskIntentAnalysis): TargetedLookupHint {
  const penalty = lookupPenalty(hint.path, taskIntent);
  if (penalty === 0) {
    return hint;
  }

  const score = Math.max(0, hint.score - penalty);
  return {
    ...hint,
    score,
    confidence: hintConfidence(score)
  };
}

function isPromotableLookupHint(hint: TargetedLookupHint, taskIntent: TaskIntentAnalysis): boolean {
  const info = classifyRepoFile(hint.path);
  const promotableRoles = new Set(["source", "test", "config", "workflow", "package"]);

  if (!promotableRoles.has(info.role) || info.isNoise || info.role === "asset") {
    return false;
  }
  if (isLockFile(hint.path) && !taskAllowsLockFile(taskIntent)) {
    return false;
  }
  if (!isMediumHighLookupHint(hint)) {
    return false;
  }

  const directSignals = new Set<TargetedLookupSignal>([
    "exact-filename-match",
    "command-name-match",
    "filename-match",
    "paired-test",
    "task-routing",
    "path-match"
  ]);

  if (directSignals.has(hint.signal)) {
    return true;
  }

  return hint.signal === "semantic-match" && hint.score >= strongLookupScoreThreshold;
}

function isWeakSemanticSourceHint(hint: TargetedLookupHint): boolean {
  return classifyRepoFile(hint.path).role === "source"
    && hint.signal === "semantic-match"
    && hint.reason.includes("weak semantic match");
}

function workflowPromotedHintRank(hint: TargetedLookupHint): number {
  const role = classifyRepoFile(hint.path).role;

  if (role === "workflow") {
    return 0;
  }
  if (role === "config") {
    return 1;
  }
  if (role === "package") {
    return 2;
  }
  if (role === "source" && !isWeakSemanticSourceHint(hint)) {
    return 3;
  }
  if (role === "test") {
    return 4;
  }
  if (role === "source") {
    return 5;
  }

  return 6;
}

function promotedLookupHints(lookupHints: TargetedLookupHint[], taskIntent: TaskIntentAnalysis): TargetedLookupHint[] {
  return lookupHints
    .filter((hint) => isPromotableLookupHint(hint, taskIntent))
    .sort((left, right) => {
      if (taskIntent.hasWorkflowDomain) {
        const workflowRankDelta = workflowPromotedHintRank(left) - workflowPromotedHintRank(right);
        if (workflowRankDelta !== 0) {
          return workflowRankDelta;
        }
      }

      const roleDelta = lookupRoleRank(classifyRepoFile(left.path).role, taskIntent) - lookupRoleRank(classifyRepoFile(right.path).role, taskIntent);
      if (roleDelta !== 0) {
        return roleDelta;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.path.localeCompare(right.path);
    });
}

function nextCheapestLookupCommand(taskIntent: TaskIntentAnalysis): string {
  return taskIntent.nextLookupKeyword ? `rcc find "${taskIntent.nextLookupKeyword}"` : 'rcc find "<keyword>"';
}

function contextDocPaths(startup: StartupContext, guidance: ReadFirstGuidance): string[] {
  return uniquePaths([
    ...guidance.taskSpecific.map((item) => item.path),
    ...guidance.optional.map((item) => item.path),
    ...startup.readFirstDocs
  ]).filter((file) => file.startsWith("docs/ai-context/"));
}

function buildTaskFileRecommendations(
  startup: StartupContext,
  lookupHints: TargetedLookupHint[],
  readFirstGuidance: ReadFirstGuidance,
  taskIntent: TaskIntentAnalysis
): {
  taskFiles: WorkRecommendation[];
  supportingTests: WorkRecommendation[];
  workflowDocs: WorkRecommendation[];
  contextDocs: WorkRecommendation[];
  recommendedFiles: WorkRecommendation[];
  relevantTests: WorkRecommendation[];
  promoted: TargetedLookupHint[];
} {
  const promoted = promotedLookupHints(lookupHints, taskIntent);
  const codeInvestigationTask = taskIntent.isCodeInvestigation;
  const promotedByRole = (roles: string[]): string[] => promoted
    .filter((hint) => roles.includes(classifyRepoFile(hint.path).role))
    .map((hint) => hint.path);
  const startupTaskFiles = startup.likelySourceFiles.filter((file) => classifyRepoFile(file).role === "source");
  const workflowTaskPaths = promotedByRole(["config", "workflow", "package"]);
  const promotedTaskPaths = taskIntent.hasWorkflowDomain
    ? promoted
      .filter((hint) => ["source", "config", "workflow", "package"].includes(classifyRepoFile(hint.path).role))
      .map((hint) => hint.path)
    : [
      ...promotedByRole(["source"]),
      ...workflowTaskPaths
    ];
  const taskFilePaths = uniquePaths([
    ...promotedTaskPaths,
    ...startupTaskFiles
  ]);
  const testHintPaths = promotedByRole(["test"]);
  const directTestSignals = new Set<TargetedLookupSignal>([
    "exact-filename-match",
    "command-name-match",
    "filename-match",
    "paired-test",
    "task-routing"
  ]);
  const directTestHintPaths = promoted
    .filter((hint) => classifyRepoFile(hint.path).role === "test" && directTestSignals.has(hint.signal))
    .map((hint) => hint.path);
  const filteredTestHintPaths = directTestHintPaths.length > 0
    ? directTestHintPaths
    : testHintPaths;
  const supportingTestPaths = uniquePaths([...filteredTestHintPaths, ...startup.likelyTests]);
  const agentRulePaths = uniquePaths(readFirstGuidance.required
    .map((item) => item.path)
    .filter(isAgentRulePath));
  const contextDocs = contextDocPaths(startup, readFirstGuidance);
  const fallbackRecommended = recommendedInspectionFiles(startup);
  const taskCandidatePaths = uniquePaths([
    ...taskFilePaths,
    ...supportingTestPaths,
    ...workflowTaskPaths
  ]);
  const recommendedPaths = codeInvestigationTask && taskCandidatePaths.length > 0
    ? taskCandidatePaths
    : uniquePaths([
      ...taskFilePaths,
      ...agentRulePaths,
      ...contextDocs,
      ...fallbackRecommended
    ]);

  return {
    taskFiles: recommendationItemsWithHints(taskFilePaths, startup, lookupHints),
    supportingTests: recommendationItemsWithHints(supportingTestPaths, startup, lookupHints),
    workflowDocs: recommendationItemsWithHints(agentRulePaths, startup, lookupHints),
    contextDocs: recommendationItemsWithHints(contextDocs, startup, lookupHints),
    recommendedFiles: recommendationItemsWithHints(recommendedPaths, startup, lookupHints),
    relevantTests: recommendationItemsWithHints(supportingTestPaths, startup, lookupHints),
    promoted
  };
}

function chooseBetterHint(left: TargetedLookupHint | undefined, right: TargetedLookupHint): TargetedLookupHint {
  if (!left || right.score > left.score) {
    return right;
  }

  return left;
}

function bestPathMatch(
  filePath: string,
  terms: string[],
  index: number,
  startupReferenced: Set<string>,
  pairedTestStems: Set<string>,
  taskIntent: TaskIntentAnalysis
): TargetedLookupHint | undefined {
  const lowerPath = filePath.toLowerCase();
  const basenameStem = basenameWithoutExtensions(filePath);
  const parts = pathParts(filePath);
  const parentParts = path.posix.dirname(lowerPath).split(/[/.\\_-]+/).filter(Boolean);
  let best: TargetedLookupHint | undefined;

  for (const term of terms) {
    let score = 0;
    let reason = "";
    let signal: TargetedLookupSignal | undefined;

    if (path.posix.basename(lowerPath) === term) {
      score = 100;
      signal = "exact-filename-match";
      reason = `exact filename matched "${term}"`;
    } else if (isCliCommandPath(filePath) && basenameStem === term) {
      score = 94;
      signal = "command-name-match";
      reason = `matched command name "${term}"`;
    } else if (classifyRepoFile(filePath).role === "test" && pairedTestStems.has(basenameStem) && terms.includes(basenameStem)) {
      score = 88;
      signal = "paired-test";
      reason = `paired test for ${basenameStem} source file`;
    } else if (basenameStem === term) {
      score = 90;
      signal = "filename-match";
      reason = `matched filename stem "${term}"`;
    } else if (startupReferenced.has(filePath)) {
      score = 76;
      signal = "task-routing";
      reason = "referenced by task routing guidance";
    } else if (parts.includes(term)) {
      score = parentParts.includes(term) ? 58 : 52;
      signal = "path-match";
      reason = parentParts.includes(term)
        ? `matched parent folder "${term}"`
        : `matched path segment "${term}"`;
    } else if (lowerPath.includes(term)) {
      score = 38;
      signal = "path-match";
      reason = `weak path match for "${term}"`;
    }

    if (score > 0 && signal) {
      best = chooseBetterHint(best, applyLookupPenalty(
        makeLookupHint(filePath, term, weightedScore(score, term), reason, signal, index),
        taskIntent
      ));
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

function extractRepoPaths(value: string): string[] {
  const paths = new Set<string>();
  const patterns = [
    /`([^`]+\.[a-z0-9][a-z0-9.-]*)`/gi,
    /\b((?:src|app|lib|tests?|docs|\.github|\.repo-context-center|fixtures|dist|build|coverage|packages|libs)\/[^\s,;|)]+|package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|tsconfig\.json)\b/gi
  ];

  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const candidate = (match[1] ?? "").replace(/[.,;:)]+$/g, "");
      if (candidate && !candidate.includes("*")) {
        paths.add(candidate);
      }
    }
  }

  return [...paths];
}

async function lookupMemorySignals(cwd: string, terms: string[]): Promise<Map<string, TargetedLookupSignal>> {
  const signals = new Map<string, TargetedLookupSignal>();
  const files = [
    { path: decisionsPath, signal: "decision-memory" as const },
    { path: workLogPath, signal: "work-log" as const },
    { path: changeLogPath, signal: "work-log" as const },
    { path: lessonsPath, signal: "work-log" as const }
  ];

  for (const file of files) {
    const fullPath = path.join(cwd, file.path);
    if (!(await pathExists(fullPath))) {
      continue;
    }

    const content = await readTextFile(fullPath);
    const relevantLines = content
      .split(/\r?\n/)
      .filter((line) => terms.some((term) => termPattern(term).test(line)))
      .slice(-10);

    for (const line of relevantLines) {
      for (const repoPath of extractRepoPaths(line)) {
        if (!(await pathExists(path.join(cwd, repoPath)))) {
          continue;
        }
        if (!signals.has(repoPath) || file.signal === "decision-memory") {
          signals.set(repoPath, file.signal);
        }
      }
    }
  }

  return signals;
}

function memoryHint(
  filePath: string,
  signal: TargetedLookupSignal,
  terms: string[],
  index: number,
  taskIntent: TaskIntentAnalysis
): TargetedLookupHint | undefined {
  const term = terms.find((candidate) => termPattern(candidate).test(filePath)) ?? terms[0];
  if (!term) {
    return undefined;
  }

  return applyLookupPenalty(makeLookupHint(
    filePath,
    term,
    signal === "decision-memory" ? 70 : 64,
    signal === "decision-memory"
      ? "matched recent decision memory"
      : "matched recent work log",
    signal,
    index
  ), taskIntent);
}

function shouldScanForTargetedLookup(filePath: string, taskIntent: TaskIntentAnalysis): boolean {
  const info = classifyRepoFile(filePath);

  if (info.role === "asset" || filePath.startsWith(".git/") || filePath.includes("/node_modules/") || filePath.startsWith("node_modules/")) {
    return false;
  }

  if (isLockFile(filePath) && !taskAllowsLockFile(taskIntent)) {
    return true;
  }

  if (info.isNoise) {
    return true;
  }

  if (filePath.startsWith(".repo-context-center/") || filePath.startsWith("docs/ai-context/")) {
    return true;
  }

  return ["source", "test", "workflow", "config", "package", "docs", "unknown"].includes(info.role);
}

async function targetedLookupHints(cwd: string, taskIntent: TaskIntentAnalysis, startup: StartupContext): Promise<TargetedLookupHint[]> {
  const terms = taskIntent.lookupTerms;
  if (terms.length === 0) {
    return [];
  }

  const repoFiles = (await listFilesRecursive(cwd)).filter((file) => shouldScanForTargetedLookup(file, taskIntent));
  const startupReferenced = routingReferencedPaths(startup);
  const pairedTestStems = sourceToPairedTestStems(repoFiles);
  const memorySignals = await lookupMemorySignals(cwd, terms);
  const candidates: TargetedLookupHint[] = [];

  for (let index = 0; index < repoFiles.length; index += 1) {
    const filePath = repoFiles[index];
    let hint = bestPathMatch(filePath, terms, index, startupReferenced, pairedTestStems, taskIntent);
    const memorySignal = memorySignals.get(filePath);
    if (memorySignal) {
      const candidate = memoryHint(filePath, memorySignal, terms, index, taskIntent);
      if (candidate) {
        hint = chooseBetterHint(hint, candidate);
      }
    }

    try {
      const content = await contentMatch(cwd, filePath, terms);
      if (content) {
        const role = classifyRepoFile(filePath).role;
        const contentScore = ["source", "test", "config", "workflow", "package"].includes(role)
          ? Math.min(72, 28 + content.matches * 6)
          : Math.min(48, 24 + content.matches * 4);
        const contentHint = applyLookupPenalty(
          makeLookupHint(
            filePath,
            content.term,
            weightedScore(contentScore, content.term),
            `weak semantic match for "${content.term}"`,
            "semantic-match",
            index
          ),
          taskIntent
        );
        if (!hint || contentHint.score > hint.score) {
          hint = contentHint;
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
      if (left.confidence !== right.confidence) {
        const confidenceRank = { high: 0, medium: 1, low: 2 };
        return confidenceRank[left.confidence] - confidenceRank[right.confidence];
      }

      if (shouldDemoteAgentAndContextHints(taskIntent)) {
        const leftInstructionRank = isAgentOrContextLookupPath(left.path) ? 1 : 0;
        const rightInstructionRank = isAgentOrContextLookupPath(right.path) ? 1 : 0;
        if (leftInstructionRank !== rightInstructionRank) {
          return leftInstructionRank - rightInstructionRank;
        }
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftRole = classifyRepoFile(left.path).role;
      const rightRole = classifyRepoFile(right.path).role;
      const roleDelta = lookupRoleRank(leftRole, taskIntent) - lookupRoleRank(rightRole, taskIntent);
      if (roleDelta !== 0) {
        return roleDelta;
      }

      return left.path.localeCompare(right.path);
    });
  const qualityHints = sortedHints.filter((hint) => hint.confidence !== "low");

  return (qualityHints.length >= targetedLookupLimit ? qualityHints : sortedHints).slice(0, targetedLookupLimit);
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

function decisionMatches(cells: string[], startup: StartupContext, taskIntent: TaskIntentAnalysis): boolean {
  const haystack = cells.slice(1).join(" ").toLowerCase();
  const taskTokens = taskIntent.rawTokens;
  const likelyFiles = [...startup.likelySourceFiles, ...startup.likelyTests];

  return taskTokens.some((token) => haystack.includes(token))
    || likelyFiles.some((file) => file && haystack.includes(file.toLowerCase()));
}

async function readRelevantDecisions(cwd: string, startup: StartupContext, taskIntent: TaskIntentAnalysis): Promise<string[]> {
  const fullPath = path.join(cwd, decisionsPath);
  if (!(await pathExists(fullPath))) {
    return [];
  }

  const content = await readTextFile(fullPath);
  const rows = content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length >= 5 && cells[0] !== "Date" && !cells.every((cell) => /^-+$/.test(cell)))
    .filter((cells) => decisionMatches(cells, startup, taskIntent))
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
    lines.push(
      "",
      "Note: context may be stale; continue with task files below, then run `rcc map --write` after investigation if needed."
    );
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

function isBroadOrAmbiguousTask(task: string, taskIntent: TaskIntentAnalysis): boolean {
  return taskIntent.lookupTerms.length === 0 || /\b(clean\s*up|stuff|things)\b/i.test(task);
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
  existingFiles: string[],
  taskIntent: TaskIntentAnalysis
): ReadFirstGuidance {
  const guidance = emptyReadFirstGuidance();
  const existing = new Set(existingFiles);
  const tokens = taskIntent.lookupTerms;
  const readFirstDocs = new Set(startup.readFirstDocs);
  const routingWeak = hasWeakRouting(startup, lookupHints);
  const broadTask = isBroadOrAmbiguousTask(startup.task, taskIntent);
  const focusedCodeInvestigation = taskIntent.isCodeInvestigation && hasStrongLookupHints(lookupHints);
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
  const riskSignal = !focusedCodeInvestigation && includesTaskToken(tokens, [
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
      signal: (routingWeak || broadTask) && !focusedCodeInvestigation,
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
    ...formatReadFirstGroup("Agent rule file:", guidance.required),
    "",
    ...formatReadFirstGroup("Task-specific:", guidance.taskSpecific),
    "",
    ...formatReadFirstGroup("Optional if unclear:", guidance.optional)
  ];
}

function targetLookupHintForText(hint: Omit<TargetedLookupHint, "index">): TargetedLookupHint {
  return {
    ...hint,
    index: 0
  };
}

function formatNumberedList(values: string[]): string[] {
  if (values.length === 0) {
    return ["- none"];
  }

  return values.map((value, index) => `${index + 1}. ${value}`);
}

function renderWorkBriefLines(brief: WorkBrief): string[] {
  const taskFileFallback = analyzeTaskIntent(brief.task).isCodeInvestigation
    ? "No focused task files were identified. Use the next cheapest command before broad search."
    : "Start with workflow/context docs before broad search.";

  return [
    "repo-context-center work brief",
    "",
    "Task intent:",
    brief.task,
    "",
    "Map freshness:",
    ...mapFreshnessLines(brief.mapFreshness),
    "",
    "Cheapest path:",
    ...formatNumberedList(brief.cheapestPath),
    "",
    "Task files to inspect first:",
    ...formatRecommendationSection(brief.taskFiles, taskFileFallback).slice(0, 8),
    "",
    "Supporting tests:",
    ...formatRecommendationSection(brief.supportingTests, "Find nearby tests after inspecting source.").slice(0, 6),
    "",
    "Agent rules:",
    ...formatRecommendationSection(brief.workflowDocs, "No agent rule files were detected.").slice(0, 6),
    "",
    "Context docs:",
    ...formatRecommendationSection(brief.contextDocs, "Use only if task files are insufficient.").slice(0, 6),
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
    "Avoid:",
    ...brief.avoid.map((item) => `- ${item}`),
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
    "Next cheapest command:",
    brief.nextCheapestCommand,
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
  readFirstGuidance: ReadFirstGuidance,
  contextBudget: ContextBudget,
  taskIntent: TaskIntentAnalysis
): WorkBrief {
  const categorized = buildTaskFileRecommendations(startup, lookupHints, readFirstGuidance, taskIntent);
  const nextCheapest = nextCheapestLookupCommand(taskIntent);
  const brief: WorkBrief = {
    command: "work",
    task: startup.task,
    contextBudget,
    mapFreshness,
    routingGuidance: startup.startupInstructions,
    startupContext: startup,
    taskFiles: categorized.taskFiles,
    supportingTests: categorized.supportingTests,
    workflowDocs: categorized.workflowDocs,
    contextDocs: categorized.contextDocs,
    recommendedFiles: categorized.recommendedFiles,
    relevantTests: categorized.relevantTests,
    targetedLookupHints: lookupHints.map((hint) => ({
      path: hint.path,
      term: hint.term,
      reason: hint.reason,
      signal: hint.signal,
      confidence: hint.confidence,
      score: hint.score
    })),
    promotedFromTargetedLookup: categorized.promoted.map((hint) => ({
      path: hint.path,
      term: hint.term,
      reason: hint.reason,
      signal: hint.signal,
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
    cheapestPath: [
      "Inspect the task files listed below.",
      "Check supporting tests.",
      `If more search is needed, run: ${nextCheapest}`,
      "Avoid broad rg/find until targeted lookup is exhausted."
    ],
    avoid: [
      "broad rg/find before checking task files",
      "reading all docs/ai-context before task files",
      "generated/assets/fixtures unless explicitly relevant",
      "full repository scans for narrow bug investigation tasks"
    ],
    readFirst: readFirstCompatibilityPaths(readFirstGuidance),
    readFirstGuidance,
    nextCheapestCommand: nextCheapest,
    nextCommand
  };

  return buildBriefWithTokenEstimate(brief);
}

function publicGuidanceItems(items: ReadFirstGuidanceItem[]): PublicReadFirstGuidanceItem[] {
  return items.map((item) => ({
    path: item.path,
    reason: item.reason
  }));
}

function publicLookupHints(hints: Array<Omit<TargetedLookupHint, "index">>): PublicTargetedLookupHint[] {
  return hints.map((hint) => ({
    path: hint.path,
    reason: hint.reason || null,
    confidence: hint.confidence,
    score: hint.score,
    signal: hint.signal
  }));
}

function recommendationSignal(
  recommendation: WorkRecommendation,
  lookupHints: PublicTargetedLookupHint[]
): PublicWorkFile {
  const matchingHint = lookupHints.find((hint) => hint.path === recommendation.path);
  if (matchingHint) {
    return {
      path: recommendation.path,
      reason: matchingHint.reason,
      confidence: matchingHint.confidence,
      score: matchingHint.score
    };
  }

  return {
    path: recommendation.path,
    reason: recommendation.reasons.length > 0 ? recommendation.reasons.join("; ") : null,
    confidence: recommendation.reasons.length > 0 ? "medium" : null,
    score: recommendation.reasons.length > 0 ? 50 : null
  };
}

function publicRisks(risks: string[]): PublicWorkRisk[] {
  if (risks.length === 0) {
    return [];
  }

  const [level, ...reasons] = risks;
  return [
    {
      level,
      reason: reasons.length > 0 ? reasons.join("; ") : null
    }
  ];
}

function renderWorkBriefJson(brief: WorkBrief): string {
  const lookupHints = publicLookupHints(brief.targetedLookupHints);
  const publicBrief: PublicWorkBrief = {
    schemaVersion: 1,
    command: brief.command,
    task: brief.task,
    contextBudget: brief.contextBudget,
    mapFreshness: {
      status: brief.mapFreshness.status,
      score: brief.mapFreshness.score,
      reason: brief.mapFreshness.reason,
      latestContextUpdate: brief.mapFreshness.latestContextUpdate,
      latestRelevantSourceChange: brief.mapFreshness.latestRelevantSourceChange,
      affectedFiles: brief.mapFreshness.affectedFiles,
      affectedContextFiles: brief.mapFreshness.affectedContextFiles
    },
    recommendedFiles: brief.recommendedFiles.map((file) => recommendationSignal(file, lookupHints)),
    relevantTests: brief.relevantTests.map((file) => recommendationSignal(file, lookupHints)),
    taskFiles: brief.taskFiles.map((file) => recommendationSignal(file, lookupHints)),
    supportingTests: brief.supportingTests.map((file) => recommendationSignal(file, lookupHints)),
    workflowDocs: brief.workflowDocs.map((file) => recommendationSignal(file, lookupHints)),
    contextDocs: brief.contextDocs.map((file) => recommendationSignal(file, lookupHints)),
    cheapestPath: brief.cheapestPath,
    avoid: brief.avoid,
    nextCheapestCommand: brief.nextCheapestCommand,
    promotedFromTargetedLookup: publicLookupHints(brief.promotedFromTargetedLookup),
    relevantDecisions: brief.relevantDecisions,
    recentLogs: brief.recentLogs,
    risks: publicRisks(brief.risks),
    readFirstGuidance: {
      required: publicGuidanceItems(brief.readFirstGuidance.required),
      taskSpecific: publicGuidanceItems(brief.readFirstGuidance.taskSpecific),
      optionalIfUnclear: publicGuidanceItems(brief.readFirstGuidance.optional),
      skippedForNow: publicGuidanceItems(brief.readFirstGuidance.skipped)
    },
    readFirst: brief.readFirst,
    targetedLookupHints: lookupHints,
    tokenEstimate: {
      briefTokens: brief.tokenEstimate.roughTokens
    },
    fastLookup: {
      command: 'rcc find "<keyword>"',
      guidance: "Prefer this before broad repo search when the target is unclear."
    },
    nextCommand: {
      command: brief.nextCommand,
      when: "after meaningful work"
    }
  };

  return `${JSON.stringify(publicBrief, null, 2)}\n`;
}

export async function workCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseWorkOptions(args);
  if (!options) {
    io.stderr(`${usage}\n`);
    return 1;
  }

  const taskIntent = analyzeTaskIntent(options.task);
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
    readRelevantDecisions(io.cwd, focusedStartupContext, taskIntent),
    readRecentLogs(io.cwd),
    targetedLookupHints(io.cwd, taskIntent, focusedStartupContext)
  ]);
  const existingContextFiles = await existingReadFirstContextFiles(io.cwd);
  const readFirstGuidance = buildReadFirstGuidance(
    focusedStartupContext,
    lookupHints,
    options.contextBudget,
    existingContextFiles,
    taskIntent
  );

  const brief = buildWorkBrief(
    focusedStartupContext,
    mapFreshness,
    decisions,
    logs,
    lookupHints,
    readFirstGuidance,
    options.contextBudget,
    taskIntent
  );

  if (options.json) {
    io.stdout(renderWorkBriefJson(brief));
    return 0;
  }

  io.stdout(formatWorkBrief(brief));
  return 0;
}
