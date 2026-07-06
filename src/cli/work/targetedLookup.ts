import { stat } from "node:fs/promises";
import path from "node:path";
import { classifyRepoFile, type RepoFileRole } from "../../core/repoFileClassifier";
import { listFilesRecursive, readTextFile } from "../../core/fileSystem";
import type { StartupContext } from "../../core/suggester";
import { weightedScore, type TaskIntentAnalysis } from "../../core/taskIntent";
import { lookupMemorySignals } from "./memorySignals";
import {
  defaultLookupRoleOrder,
  documentationTaskLookupRoleOrder,
  localGlobalDoctorRoutes,
  packageTaskLookupRoleOrder,
  releaseTaskRoutes,
  routingImplementationRoutes,
  strongLookupScoreThreshold,
  targetedContentReadLimit,
  targetedLookupLimit,
  tokenMeasurementRoutes,
  workflowTaskLookupRoleOrder,
  workOutputAssemblyPatterns,
  workOutputAssemblyRoutes
} from "./workConstants";
import type { TargetedLookupHint, TargetedLookupSignal } from "./workTypes";

function basenameWithoutExtensions(filePath: string): string {
  const basename = path.posix.basename(filePath).toLowerCase();
  const firstDot = basename.indexOf(".");

  return firstDot === -1 ? basename : basename.slice(0, firstDot);
}

function identifierTokens(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function basenameIdentifierTokens(filePath: string): string[] {
  const basename = path.posix.basename(filePath);
  const firstDot = basename.indexOf(".");
  const stem = firstDot === -1 ? basename : basename.slice(0, firstDot);

  return identifierTokens(stem);
}

function pathParts(filePath: string): string[] {
  return filePath
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[/.\\_\-\s]+/)
    .filter(Boolean);
}

function isAuthMiddlewareTask(taskIntent: TaskIntentAnalysis): boolean {
  const terms = new Set(taskIntent.lookupTerms);

  return terms.has("auth") && terms.has("middleware");
}

function isStrongAuthMiddlewareLookupPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();

  return (
    /(^|\/)packages\/backend-core\/src\/auth\//i.test(normalized)
    || /(^|\/)packages\/backend-core\/src\/middleware\//i.test(normalized)
    || /(^|\/)packages\/server\/src\/api\/routes\/.+\/middleware\//i.test(normalized)
    || /(^|\/)src\/auth\/middleware\.[cm]?[jt]sx?$/i.test(normalized)
    || /(^|\/)src\/middleware\//i.test(normalized)
  );
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function termPattern(term: string): RegExp {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "i");
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

function taskAllowsLockFile(taskIntent: TaskIntentAnalysis): boolean {
  if (taskIntent.hasDocumentationIntent && !taskIntent.hasReleaseIntent) {
    return false;
  }

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

function lookupRoleOrder(taskIntent: TaskIntentAnalysis): RepoFileRole[] {
  if (taskIntent.hasDocumentationIntent) {
    return documentationTaskLookupRoleOrder;
  }

  if (taskIntent.hasCiWorkflowIntent) {
    return workflowTaskLookupRoleOrder;
  }

  return taskAllowsLockFile(taskIntent) ? packageTaskLookupRoleOrder : defaultLookupRoleOrder;
}

function lookupRoleRank(role: RepoFileRole, taskIntent: TaskIntentAnalysis): number {
  const order = lookupRoleOrder(taskIntent);
  const index = order.indexOf(role);

  return index === -1 ? order.length : index;
}

export function isWorkOutputAssemblyTask(taskIntent: TaskIntentAnalysis): boolean {
  return workOutputAssemblyPatterns.some((pattern) => pattern.test(taskIntent.normalizedTask));
}

function isTokenMeasurementTask(taskIntent: TaskIntentAnalysis): boolean {
  return /\b(token|tokens)\b/.test(taskIntent.normalizedTask)
    && /\b(measure|measurement|mode|estimate|estimator)\b/.test(taskIntent.normalizedTask);
}

function isLocalGlobalDoctorTask(taskIntent: TaskIntentAnalysis): boolean {
  return (
    /\b(local|global)\b/.test(taskIntent.normalizedTask)
    && /\b(rcc|doctor|warning|warn|version|binary|cli)\b/.test(taskIntent.normalizedTask)
  ) || (
    /\bdoctor\b/.test(taskIntent.normalizedTask)
    && /\b(rcc|local|global|version|warning|warn|cli)\b/.test(taskIntent.normalizedTask)
  );
}

function isOutputContractLookupTask(taskIntent: TaskIntentAnalysis): boolean {
  return taskIntent.lookupTerms.some((term) => [
    "contract",
    "contracts",
    "evidence",
    "markdown",
    "qa",
    "report",
    "reports",
    "sarif",
    "severity"
  ].includes(term));
}

export function shouldSuppressWeakSemanticTaskFiles(taskIntent: TaskIntentAnalysis): boolean {
  return taskIntent.hasCiWorkflowIntent
    || taskIntent.hasRoutingImplementationIntent
    || taskIntent.hasDocumentationIntent
    || isTokenMeasurementTask(taskIntent)
    || isLocalGlobalDoctorTask(taskIntent);
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

export function isAgentRulePath(filePath: string): boolean {
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

const workspaceRootNames = new Set(["apps", "packages", "services", "libs", "modules"]);

function workspacePackageRoot(filePath: string): string | null {
  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);

  if (workspaceRootNames.has(parts[0] ?? "") && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  return null;
}

function taskWorkspaceTerms(taskIntent: TaskIntentAnalysis, files: string[]): Set<string> {
  const packageNames = new Set(files
    .map(workspacePackageRoot)
    .filter((root): root is string => root !== null)
    .map((root) => root.split("/")[1]));
  return new Set(taskIntent.lookupTerms.filter((term) => packageNames.has(term)));
}

function applyWorkspaceScopeScore(
  hint: TargetedLookupHint,
  taskIntent: TaskIntentAnalysis,
  workspaceTerms: Set<string>
): TargetedLookupHint {
  if (workspaceTerms.size === 0) {
    return hint;
  }

  const root = workspacePackageRoot(hint.path);
  if (!root) {
    return hint;
  }

  const packageName = root.split("/")[1];
  const score = workspaceTerms.has(packageName)
    ? hint.score + 28
    : Math.max(0, hint.score - 12);

  return {
    ...hint,
    score,
    confidence: hintConfidence(score),
    reason: workspaceTerms.has(packageName)
      ? `${hint.reason}; same workspace package`
      : hint.reason
  };
}

export type ApplicationLayerAffinity = "frontend" | "backend" | "neutral";

const frontendPathSegments = new Set([
  "client",
  "component",
  "components",
  "dashboard",
  "frontend",
  "page",
  "pages",
  "screen",
  "screens",
  "ui",
  "web"
]);
const backendPathSegments = new Set([
  "api",
  "backend",
  "controller",
  "controllers",
  "migration",
  "migrations",
  "repository",
  "repositories",
  "server",
  "service",
  "services"
]);

export function applicationLayerAffinity(filePath: string): ApplicationLayerAffinity {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const segments = normalized.split(/[\/.\-_]+/).filter(Boolean);
  const basenameStem = path.posix.basename(normalized).replace(/\.[^.]+$/, "");
  const frontendMatches = segments.filter((segment) => frontendPathSegments.has(segment)).length;
  const backendMatches = segments.filter((segment) => backendPathSegments.has(segment)).length
    + (/(?:service|repository|controller|migration)s?$/i.test(basenameStem) ? 1 : 0);

  if (frontendMatches === backendMatches) {
    return "neutral";
  }

  return frontendMatches > backendMatches ? "frontend" : "backend";
}

function taskExplicitlyTargetsPath(hint: TargetedLookupHint, taskIntent: TaskIntentAnalysis): boolean {
  const normalizedPath = hint.path.replace(/\\/g, "/").toLowerCase();
  const basename = path.posix.basename(normalizedPath);

  return extractRepoPaths(taskIntent.normalizedTask)
    .map((candidate) => candidate.replace(/\\/g, "/").toLowerCase())
    .some((candidate) => candidate === normalizedPath || candidate === basename);
}

function applyApplicationLayerScore(
  hint: TargetedLookupHint,
  taskIntent: TaskIntentAnalysis
): TargetedLookupHint {
  const affinity = applicationLayerAffinity(hint.path);
  if (affinity === "neutral") {
    return hint;
  }

  const explicitlyTargeted = taskExplicitlyTargetsPath(hint, taskIntent)
    || hint.signal === "exact-filename-match";
  const matchesPositiveIntent = affinity === "frontend"
    ? taskIntent.hasFrontendIntent
    : taskIntent.hasBackendIntent;
  const oppositeIntent = affinity === "frontend"
    ? taskIntent.hasBackendIntent
    : taskIntent.hasFrontendIntent;
  const explicitlyExcluded = taskIntent.excludedApplicationLayers.includes(affinity);
  let adjustment = 0;
  let reason: string | null = null;

  if (matchesPositiveIntent) {
    adjustment = 36;
    reason = `${affinity} layer affinity`;
  } else if (!explicitlyTargeted && explicitlyExcluded) {
    adjustment = -44;
    reason = `${affinity} layer explicitly excluded`;
  } else if (!explicitlyTargeted && oppositeIntent) {
    adjustment = -22;
    reason = `${affinity} layer outside task intent`;
  }

  if (adjustment === 0 || !reason) {
    return hint;
  }

  const score = Math.max(0, hint.score + adjustment);
  return {
    ...hint,
    score,
    confidence: hintConfidence(score),
    reason: `${hint.reason}; ${reason} (${adjustment > 0 ? "+" : ""}${adjustment})`
  };
}

function isPromotableLookupHint(hint: TargetedLookupHint, taskIntent: TaskIntentAnalysis): boolean {
  const info = classifyRepoFile(hint.path);
  const promotableRoles = new Set(["source", "test", "config", "workflow", "package"]);

  if (!(promotableRoles.has(info.role) || (info.role === "docs" && isDirectDocumentationHint(hint, taskIntent))) || info.isNoise || info.role === "asset") {
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

function isDirectDocumentationHint(hint: TargetedLookupHint, taskIntent: TaskIntentAnalysis): boolean {
  if (classifyRepoFile(hint.path).role !== "docs" || hint.signal === "semantic-match") {
    return false;
  }

  return taskIntent.hasDocumentationIntent
    || (taskIntent.hasReleaseIntent && hint.signal === "task-routing");
}

export function isWeakSemanticSourceHint(hint: TargetedLookupHint): boolean {
  return classifyRepoFile(hint.path).role === "source"
    && hint.signal === "semantic-match"
    && hint.reason.includes("weak semantic match");
}

export function isWorkflowConfigOrPackageHint(hint: TargetedLookupHint): boolean {
  return ["workflow", "config", "package"].includes(classifyRepoFile(hint.path).role);
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

export function promotedLookupHints(lookupHints: TargetedLookupHint[], taskIntent: TaskIntentAnalysis): TargetedLookupHint[] {
  return lookupHints
    .filter((hint) => isPromotableLookupHint(hint, taskIntent))
    .sort((left, right) => {
      if (taskIntent.hasCiWorkflowIntent) {
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

function chooseBetterHint(left: TargetedLookupHint | undefined, right: TargetedLookupHint): TargetedLookupHint {
  if (!left || right.score > left.score) {
    return right;
  }

  return left;
}

const cumulativeSignalBonusCap = 34;
const cumulativeSignalBonuses = [18, 10, 6] as const;
const genericCumulativeTerms = new Set([
  "app",
  "client",
  "code",
  "component",
  "file",
  "files",
  "frontend",
  "helper",
  "page",
  "source",
  "task",
  "tasks",
  "ui"
]);

function meaningfulCumulativeTerms(taskIntent: TaskIntentAnalysis): Set<string> {
  return new Set(taskIntent.lookupTerms.filter((term) => (
    !taskIntent.actionTerms.includes(term)
    && !taskIntent.lowSignalTerms.includes(term)
    && !genericCumulativeTerms.has(term)
  )));
}

function prefersTaskRoutingGuidance(taskIntent: TaskIntentAnalysis): boolean {
  return taskIntent.hasRoutingImplementationIntent
    || taskIntent.hasCiWorkflowIntent
    || taskIntent.hasDocumentationIntent
    || taskIntent.hasReleaseIntent
    || taskIntent.isExplicitCommandTask
    || (taskIntent.lookupTerms.includes("token") && /\b(measure|measurement|estimate|estimator)\b/.test(taskIntent.normalizedTask));
}

function compoundFilenameHint(
  filePath: string,
  index: number,
  taskIntent: TaskIntentAnalysis
): TargetedLookupHint | undefined {
  if (prefersTaskRoutingGuidance(taskIntent)) {
    return undefined;
  }

  const filenameTokens = basenameIdentifierTokens(filePath);
  if (filenameTokens.length < 2) {
    return undefined;
  }

  const meaningfulTerms = meaningfulCumulativeTerms(taskIntent);
  if (!filenameTokens.every((term) => meaningfulTerms.has(term))) {
    return undefined;
  }

  const taskTokens = identifierTokens(taskIntent.normalizedTask);
  const phrase = filenameTokens.join(" ");
  const taskText = taskTokens.join(" ");
  if (!taskText.includes(phrase)) {
    return undefined;
  }

  return makeLookupHint(
    filePath,
    phrase,
    98,
    `matched normalized compound filename "${phrase}"`,
    "filename-match",
    index
  );
}

function addBoundedCumulativeSignals(
  best: TargetedLookupHint,
  candidates: TargetedLookupHint[],
  taskIntent: TaskIntentAnalysis
): TargetedLookupHint {
  if (
    best.signal === "exact-filename-match"
    || best.signal === "command-name-match"
    || best.signal === "paired-test"
    || best.reason.startsWith("matched normalized compound filename")
  ) {
    return best;
  }

  const meaningfulTerms = meaningfulCumulativeTerms(taskIntent);
  const filenameTerms = new Set(basenameIdentifierTokens(best.path));
  const pathCandidates = candidates.filter((candidate) => (
    meaningfulTerms.has(candidate.term)
    && filenameTerms.has(candidate.term)
    && ["filename-match", "path-match"].includes(candidate.signal)
  ));
  const strongestPathCandidate = pathCandidates.reduce<TargetedLookupHint | undefined>(chooseBetterHint, undefined);
  if (!strongestPathCandidate) {
    return best;
  }

  const additionalTerms = [...new Set(pathCandidates
    .filter((candidate) => (
      candidate.term !== strongestPathCandidate.term
    ))
    .sort((left, right) => right.score - left.score)
    .map((candidate) => candidate.term))];
  const bonus = Math.min(
    cumulativeSignalBonusCap,
    additionalTerms.reduce((total, _term, bonusIndex) => (
      total + (cumulativeSignalBonuses[bonusIndex] ?? 0)
    ), 0)
  );

  if (bonus === 0) {
    return best;
  }

  const cumulativeScore = strongestPathCandidate.score + bonus;
  return cumulativeScore > best.score
    ? {
      ...strongestPathCandidate,
      score: cumulativeScore,
      confidence: hintConfidence(cumulativeScore),
      reason: `${strongestPathCandidate.reason}; additional matches: ${additionalTerms.slice(0, cumulativeSignalBonuses.length).join(", ")}`
    }
    : best;
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
  const candidates: TargetedLookupHint[] = [];

  const compoundHint = compoundFilenameHint(filePath, index, taskIntent);
  if (compoundHint) {
    candidates.push(compoundHint);
  }

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
      candidates.push(makeLookupHint(filePath, term, weightedScore(score, term), reason, signal, index));

      if (signal === "task-routing" && !prefersTaskRoutingGuidance(taskIntent) && parts.includes(term)) {
        const pathScore = parentParts.includes(term) ? 58 : 52;
        candidates.push(makeLookupHint(
          filePath,
          term,
          weightedScore(pathScore, term),
          parentParts.includes(term)
            ? `matched parent folder "${term}"`
            : `matched path segment "${term}"`,
          "path-match",
          index
        ));
      }
    }
  }

  const best = candidates.reduce<TargetedLookupHint | undefined>(chooseBetterHint, undefined);
  if (!best) {
    return undefined;
  }

  let combined = addBoundedCumulativeSignals(best, candidates, taskIntent);
  if (isAuthMiddlewareTask(taskIntent) && isStrongAuthMiddlewareLookupPath(filePath)) {
    combined = {
      ...combined,
      score: combined.score + 80,
      confidence: hintConfidence(combined.score + 80)
    };
  }

  return applyLookupPenalty(combined, taskIntent);
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

export function extractRepoPaths(value: string): string[] {
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

export async function targetedLookupHints(cwd: string, taskIntent: TaskIntentAnalysis, startup: StartupContext): Promise<TargetedLookupHint[]> {
  const terms = taskIntent.lookupTerms;
  if (terms.length === 0) {
    return [];
  }

  const repoFiles = (await listFilesRecursive(cwd)).filter((file) => shouldScanForTargetedLookup(file, taskIntent));
  const workspaceTerms = taskWorkspaceTerms(taskIntent, repoFiles);
  const startupReferenced = routingReferencedPaths(startup);
  const pairedTestStems = sourceToPairedTestStems(repoFiles);
  const memorySignals = await lookupMemorySignals(cwd, terms, { extractRepoPaths, termPattern });
  const candidates: TargetedLookupHint[] = [];

  if (isWorkOutputAssemblyTask(taskIntent)) {
    const routeTerm = terms.find((term) => ["work", "task", "files", "lookup", "output"].includes(term)) ?? terms[0] ?? "work";
    for (const routePath of workOutputAssemblyRoutes) {
      const routeIndex = repoFiles.indexOf(routePath);
      if (routeIndex === -1) {
        continue;
      }
      candidates.push(makeLookupHint(
        routePath,
        routeTerm,
        routePath.endsWith("work.ts") ? 86 : 84,
        "routed by RCC work output assembly guidance",
        "task-routing",
        routeIndex
      ));
    }
  }

  if (taskIntent.hasRoutingImplementationIntent) {
    const routeTerm = terms.find((term) => ["routing", "intent", "turkish", "turkce", "task", "tasks"].includes(term)) ?? terms[0] ?? "routing";
    for (const routePath of routingImplementationRoutes) {
      const routeIndex = repoFiles.indexOf(routePath);
      if (routeIndex === -1) {
        continue;
      }
      const score = routePath.endsWith("taskFileRecommendations.ts")
        ? 124
        : routePath.endsWith("taskIntent.ts")
          ? 122
          : routePath.endsWith("taskSize.ts")
            ? 120
            : 116;
      candidates.push(makeLookupHint(
        routePath,
        routeTerm,
        score,
        "routed by RCC task routing implementation guidance",
        "task-routing",
        routeIndex
      ));
    }
  }

  if (isTokenMeasurementTask(taskIntent)) {
    const routeTerm = terms.find((term) => ["measure", "measurement", "token", "tokens", "estimate"].includes(term)) ?? terms[0] ?? "token";
    for (const routePath of tokenMeasurementRoutes) {
      const routeIndex = repoFiles.indexOf(routePath);
      if (routeIndex === -1) {
        continue;
      }
      candidates.push(makeLookupHint(
        routePath,
        routeTerm,
        routePath.endsWith("measure.ts") ? 88 : 84,
        "routed by RCC token measurement guidance",
        "task-routing",
        routeIndex
      ));
    }
  }

  if (taskIntent.hasReleaseIntent) {
    const routeTerm = terms.find((term) => ["release", "publish", "npm", "package", "changelog", "tag"].includes(term)) ?? terms[0] ?? "release";
    for (const routePath of releaseTaskRoutes) {
      const routeIndex = repoFiles.indexOf(routePath);
      if (routeIndex === -1) {
        continue;
      }
      candidates.push(makeLookupHint(
        routePath,
        routeTerm,
        routePath === "package.json" ? 88 : 82,
        "routed by release task guidance",
        "task-routing",
        routeIndex
      ));
    }
  }

  if (isLocalGlobalDoctorTask(taskIntent)) {
    const routeTerm = terms.find((term) => ["doctor", "local", "global", "rcc", "warning", "version"].includes(term)) ?? terms[0] ?? "doctor";
    for (const routePath of localGlobalDoctorRoutes) {
      const routeIndex = repoFiles.indexOf(routePath);
      if (routeIndex === -1) {
        continue;
      }
      candidates.push(makeLookupHint(
        routePath,
        routeTerm,
        routePath.endsWith("doctor.ts") ? 88 : 84,
        "routed by RCC local/global doctor guidance",
        "task-routing",
        routeIndex
      ));
    }
  }

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

    candidates.push(applyApplicationLayerScore(
      applyWorkspaceScopeScore(hint, taskIntent, workspaceTerms),
      taskIntent
    ));
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
        if (!isOutputContractLookupTask(taskIntent)) {
          return right.score - left.score;
        }
      }

      const leftRole = classifyRepoFile(left.path).role;
      const rightRole = classifyRepoFile(right.path).role;
      const roleDelta = lookupRoleRank(leftRole, taskIntent) - lookupRoleRank(rightRole, taskIntent);
      if (roleDelta !== 0) {
        return roleDelta;
      }

      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.path.localeCompare(right.path);
    });
  const qualityHints = sortedHints.filter((hint) => hint.confidence !== "low");

  return (qualityHints.length >= targetedLookupLimit ? qualityHints : sortedHints).slice(0, targetedLookupLimit);
}
