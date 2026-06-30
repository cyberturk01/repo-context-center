import type { ImpactAnalysis, ImpactCommand, ImpactVerificationHint } from "../impact/impactTypes";
import { buildImpactAnalysis } from "../impact/buildImpact";
import { classifyTaskSize, type TaskSize } from "../work/taskSize";
import {
  isBackendDatabasePath,
  isContextPath,
  isFrontendPath,
  isFrontendVisiblePath,
  isWorkflowPath,
  normalizedPath,
  type Domain as VerificationDomain,
  type DomainMatch as CoreDomainMatch
} from "../../core/domainEngine";
import {
  detectRepositoryEcosystems,
  type EcosystemDetection,
  type EcosystemDetectionReport,
  type EcosystemId
} from "../../core/ecosystemDetector";
import type {
  VerificationCheck,
  VerificationCommand,
  VerificationLevel,
  VerificationPlan,
  VerificationPlanInput,
  VerificationPriority,
  VerificationTargetedTest
} from "./verifyTypes";

const contextOnlyConfidenceReason = "verify confidence reduced because only context files changed";
const contextOnlyVerificationNote = "Context-only changes detected; verify focuses on RCC/context files and does not promote task-route estimates to targeted tests or smoke checks.";
const contextOnlyImpactNote = "Context-only impact detected; verify context changes manually.";
const plannedModeNote = "Planned verification mode: plan uses task routing, impact analysis, and repository learning without requiring source code changes.";
const runnableNodeTestPattern = /\.(test|spec)\.[cm]?[jt]sx?$/i;
const maximumTargetedTestCommandLength = 300;
const defaultVerificationLevel: VerificationLevel = "balanced";
type VerifyEcosystemId = Exclude<EcosystemId, "monorepo">;
const priorityRank: Record<VerificationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

interface DomainMatch {
  domain: VerificationDomain;
  paths: string[];
  signals: string[];
}

type VerificationPlanWithoutExecution = Omit<
  VerificationPlan,
  "targetedTests" | "targetedTestCommands" | "buildCommands" | "smokeChecks" | "manualChecks"
> & {
  targetedTests: ImpactAnalysis["affectedTests"];
  targetedTestCommands: ImpactCommand[];
  buildCommands: ImpactCommand[];
  smokeChecks: ImpactVerificationHint[];
  manualChecks: ImpactVerificationHint[];
};

function isDocsPath(filePath: string): boolean {
  return (
    filePath === "README.md"
    || filePath.startsWith("docs/")
    || filePath.endsWith(".md")
    || filePath.endsWith(".mdx")
  );
}

function manualCheck(type: string, reason: string, paths: string[]): ImpactVerificationHint | null {
  if (paths.length === 0) {
    return null;
  }

  return { type, reason, paths };
}

function compactChecks(checks: Array<ImpactVerificationHint | null>): ImpactVerificationHint[] {
  return checks.filter((check): check is ImpactVerificationHint => check !== null);
}

function compactAllChecks(checks: ImpactVerificationHint[]): ImpactVerificationHint[] {
  const seen = new Set<string>();

  return checks.filter((check) => {
    const key = JSON.stringify({
      type: check.type,
      reason: check.reason,
      command: check.command ?? "",
      paths: check.paths ?? []
    });

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function checkGroup(type: string): string {
  const groups: Record<string, string> = {
    "frontend-regression": "frontend-ui",
    "backend-contract": "backend-behavior",
    "cache-hit-miss": "cache-behavior",
    "context-changes": "context-review",
    "context-routing": "context-review"
  };

  return groups[type] ?? type;
}

function canonicalCheckType(type: string): string {
  const canonicalTypes: Record<string, string> = {
    "frontend-regression": "frontend-ui",
    "backend-contract": "backend-behavior",
    "cache-hit-miss": "cache-behavior",
    "context-changes": "context-routing",
    "context-routing": "context-routing"
  };

  return canonicalTypes[type] ?? type;
}

function canonicalReason(group: string): string | undefined {
  const reasons: Record<string, string> = {
    "frontend-ui": "Check the affected UI in a browser for rendering, interaction, responsive layout, loading state, and visible regressions.",
    "backend-behavior": "Check the affected backend path with a representative request or worker invocation, including contract behavior, errors, and side effects.",
    "cache-behavior": "Check cache miss and cache hit behavior, plus cache invalidation, for the matched cache surface.",
    "context-review": "Review RCC context changes for workflow and routing impact after primary verification."
  };

  return reasons[group];
}

function reasonScore(check: ImpactVerificationHint): number {
  const reason = check.reason.toLowerCase();
  const strongTerms = [
    "fallback",
    "contract",
    "credentials",
    "secrets",
    "rollback",
    "compatibility",
    "responsive",
    "invalidation",
    "side effects",
    "workflow",
    "routing"
  ];
  const termScore = strongTerms.filter((term) => reason.includes(term)).length * 10;
  const commandScore = check.command ? 15 : 0;

  return termScore + commandScore + Math.min(check.reason.length, 140) / 10;
}

function mergeCheck(left: ImpactVerificationHint, right: ImpactVerificationHint): ImpactVerificationHint {
  const group = checkGroup(left.type);
  const stronger = reasonScore(right) > reasonScore(left) ? right : left;
  const command = left.command ?? right.command;
  const paths = uniqueStrings([...(left.paths ?? []), ...(right.paths ?? [])]);
  const reason = canonicalReason(group) ?? stronger.reason;
  const type = canonicalCheckType(stronger.type);

  return {
    type,
    reason,
    ...(paths.length > 0 ? { paths } : {}),
    ...(command ? { command } : {})
  };
}

function normalizeCheckList(checks: ImpactVerificationHint[]): ImpactVerificationHint[] {
  const merged = new Map<string, ImpactVerificationHint>();

  for (const check of checks) {
    const key = check.command ? `${checkGroup(check.type)}:${check.command}` : checkGroup(check.type);
    const existing = merged.get(key);

    merged.set(key, existing ? mergeCheck(existing, check) : check);
  }

  return [...merged.values()];
}

function checkPriority(check: ImpactVerificationHint): number {
  const priorities: Record<string, number> = {
    "auth-flow": 10,
    "cache-behavior": 20,
    "ci-workflow": 30,
    "database-behavior": 40,
    "frontend-ui": 50,
    "backend-behavior": 60,
    "github-integration": 61,
    "ui-text": 70,
    "docs-rendering": 80,
    "environment": 5,
    "invalid-credentials": 10,
    "security-session": 11,
    "cache-fallback": 20,
    "workflow-lint": 30,
    "yaml-syntax": 31,
    "workflow-triggers-secrets": 32,
    "schema-compatibility": 40,
    "data-rollback-impact": 41,
    "github-api-integration": 42,
    "config-load": 50,
    "affected-files": 70,
    "context-routing": 95,
    "postgres-ui-reference": 90
  };

  return priorities[check.type] ?? 100;
}

function highestPriority(priorities: VerificationPriority[]): VerificationPriority {
  return priorities.sort((left, right) => priorityRank[left] - priorityRank[right])[0] ?? "medium";
}

function priorityFromText(text: string): VerificationPriority | null {
  if (/\b(auth|authentication|authorization|authorize|oauth|jwt|session|sessions|login|logout|signin|signout|credentials?|secrets?|security|permissions?)\b/i.test(text)) {
    return "critical";
  }

  if (/\b(schema|schemas|migration|migrations|sql|database compatibility|backward compatibility)\b/i.test(text)) {
    return "critical";
  }

  if (/\b(database|db|postgres|postgresql|query|queries|rollback|data impact)\b/i.test(text)) {
    return "high";
  }

  if (/\b(cache|redis|api|backend|worker|frontend|ui|workflow|ci|pipeline)\b/i.test(text)) {
    return "high";
  }

  if (/\b(context|repo context|rcc|docs\/ai-context|agents\.md|routing)\b/i.test(text)) {
    return "low";
  }

  return null;
}

function priorityForTargetedTest(test: ImpactAnalysis["affectedTests"][number], task: string): VerificationPriority {
  return priorityFromText(`${task} ${test.path} ${test.reason} ${test.signals.join(" ")}`) ?? "high";
}

function compactTargetedTestReason(test: ImpactAnalysis["affectedTests"][number]): string {
  const signals = new Set(test.signals.map((signal) => signal.toLowerCase()));
  const reason = test.reason.toLowerCase();

  if (
    signals.has("imports affected source")
    || signals.has("same directory")
    || signals.has("task/test name match")
  ) {
    return "exact source/test relationship";
  }

  if (signals.has("specific routed test name") || signals.has("task routing evidence") || /\btask[- ]routed|task routing\b/i.test(reason)) {
    return "task-routed test";
  }

  if (signals.has("repository learning") || signals.has("co-change history") || /\blearned|repository learning|co-change\b/i.test(reason)) {
    return "learned test relationship";
  }

  if (
    signals.has("same module")
    || signals.has("same package/module")
    || signals.has("same package/module with task token")
    || signals.has("filename similarity")
  ) {
    return "same-module test";
  }

  return "domain-matched test";
}

function priorityForBuildCommand(): VerificationPriority {
  return "high";
}

function priorityForSmokeCheck(check: ImpactVerificationHint): VerificationPriority {
  const text = `${check.type} ${check.reason} ${(check.paths ?? []).join(" ")} ${check.command ?? ""}`;

  if (/\b(postgres-ui-reference)\b/i.test(text)) {
    return "low";
  }

  if (/\b(auth-flow|security|schema|database|postgres|backend-contract)\b/i.test(text)) {
    return "high";
  }

  if (/\b(context-routing|context-changes)\b/i.test(text)) {
    return "low";
  }

  return priorityFromText(text) === "high" ? "high" : "medium";
}

function priorityForManualCheck(check: ImpactVerificationHint, contextOnly: boolean): VerificationPriority {
  const text = `${check.type} ${check.reason} ${(check.paths ?? []).join(" ")} ${check.command ?? ""}`;

  if (/\b(schema-compatibility)\b/i.test(text)) {
    return "critical";
  }

  if (/\b(postgres-ui-reference)\b/i.test(text)) {
    return "low";
  }

  if (/\b(invalid-credentials|workflow-triggers-secrets|data-rollback-impact|security|secrets?|permissions?)\b/i.test(text)) {
    return "high";
  }

  if (/\b(github-api-integration|backend-contract)\b/i.test(text)) {
    return "high";
  }

  if (/\b(context-routing|context-changes)\b/i.test(text)) {
    return contextOnly ? "medium" : "low";
  }

  return priorityFromText(text) ?? "medium";
}

function prioritizeTargetedTests(
  tests: ImpactAnalysis["affectedTests"],
  task: string
): VerificationTargetedTest[] {
  return tests.map((test) => {
    const { score: _score, signals: _signals, ...publicTest } = test;

    return {
      ...publicTest,
      reason: compactTargetedTestReason(test),
      priority: priorityForTargetedTest(test, task)
    };
  });
}

function prioritizeBuildCommands(commands: ImpactCommand[]): VerificationCommand[] {
  return commands.map((command) => ({
    ...command,
    priority: priorityForBuildCommand()
  }));
}

function prioritizeTargetedTestCommands(
  commands: ImpactCommand[],
  targetedTests: VerificationTargetedTest[]
): VerificationCommand[] {
  const priority = highestPriority(targetedTests.map((test) => test.priority));

  return commands.map((command) => ({
    ...command,
    priority
  }));
}

function prioritizeChecks(
  checks: ImpactVerificationHint[],
  kind: "smoke" | "manual",
  contextOnly: boolean
): VerificationCheck[] {
  return checks.map((check) => ({
    ...check,
    priority: kind === "smoke"
      ? priorityForSmokeCheck(check)
      : priorityForManualCheck(check, contextOnly)
  }));
}

function capChecks(
  checks: ImpactVerificationHint[],
  level: VerificationLevel,
  kind: "smoke" | "manual"
): ImpactVerificationHint[] {
  if (level === "deep") {
    return checks;
  }

  const limits = {
    minimal: { smoke: 1, manual: 2 },
    balanced: { smoke: 2, manual: 4 }
  };
  const limit = limits[level][kind];

  return checks
    .map((check, index) => ({ check, index }))
    .sort((left, right) => (
      checkPriority(left.check) - checkPriority(right.check)
      || (right.check.command ? 1 : 0) - (left.check.command ? 1 : 0)
      || left.index - right.index
    ))
    .slice(0, limit)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.check);
}

function trimCheckPaths(checks: ImpactVerificationHint[], level: VerificationLevel): ImpactVerificationHint[] {
  if (level === "deep") {
    return checks;
  }

  const maxPaths = level === "minimal" ? 3 : 5;

  return checks.map((check) => {
    if (!check.paths || check.paths.length <= maxPaths) {
      return check;
    }

    return {
      ...check,
      paths: check.paths.slice(0, maxPaths)
    };
  });
}

function retainSecondaryContextReview(
  checks: ImpactVerificationHint[],
  sourceChecks: ImpactVerificationHint[]
): ImpactVerificationHint[] {
  if (checks.some((check) => checkGroup(check.type) === "context-review")) {
    return checks;
  }

  const contextReview = sourceChecks.find((check) => checkGroup(check.type) === "context-review");

  return contextReview ? [...checks, contextReview] : checks;
}

function isContextOnlyPlan(plan: Pick<VerificationPlan, "mode" | "confidenceExplanation">): boolean {
  return (
    plan.mode !== "planned-task"
    && plan.confidenceExplanation.evidence.contextOnlyChanges
    && plan.confidenceExplanation.evidence.nonContextChangedFiles === 0
  );
}

function finalizeVerificationPlan(plan: VerificationPlanWithoutExecution): VerificationPlan {
  const contextOnly = isContextOnlyPlan(plan);
  const targetedTests = prioritizeTargetedTests(plan.targetedTests, plan.task);
  const targetedTestCommands = prioritizeTargetedTestCommands(plan.targetedTestCommands, targetedTests);
  const buildCommands = prioritizeBuildCommands(plan.buildCommands);
  const smokeChecks = prioritizeChecks(plan.smokeChecks, "smoke", contextOnly);
  const manualChecks = prioritizeChecks(plan.manualChecks, "manual", contextOnly);
  return {
    ...plan,
    targetedTests,
    targetedTestCommands,
    buildCommands,
    smokeChecks,
    manualChecks
  };
}

function normalizeVerificationPlan(plan: VerificationPlan, level: VerificationLevel): VerificationPlan {
  let smokeChecks = normalizeCheckList(plan.smokeChecks);
  let manualChecks = normalizeCheckList(plan.manualChecks);
  const mergeIntoSmokeGroups = new Set(["frontend-ui", "backend-behavior", "cache-behavior"]);
  const contextOnly = isContextOnlyPlan(plan);

  manualChecks = manualChecks.filter((manualCheckItem) => {
    const manualGroup = checkGroup(manualCheckItem.type);
    const smokeIndex = smokeChecks.findIndex((smokeCheckItem) => checkGroup(smokeCheckItem.type) === manualGroup);

    if (smokeIndex === -1 || !mergeIntoSmokeGroups.has(manualGroup)) {
      return true;
    }

    smokeChecks[smokeIndex] = mergeCheck(smokeChecks[smokeIndex], manualCheckItem);
    return false;
  });

  const trimmedSmokeChecks = trimCheckPaths(capChecks(smokeChecks, level, "smoke"), level);
  const trimmedManualChecks = retainSecondaryContextReview(
    trimCheckPaths(capChecks(manualChecks, level, "manual"), level),
    trimCheckPaths(manualChecks, level)
  );

  return {
    ...plan,
    smokeChecks: prioritizeChecks(trimmedSmokeChecks, "smoke", contextOnly),
    manualChecks: prioritizeChecks(trimmedManualChecks, "manual", contextOnly)
  };
}

function commandsByType(commands: ImpactCommand[], type: ImpactCommand["type"]): ImpactCommand[] {
  return commands.filter((command) => command.type === type);
}

function ecosystemPathMatches(rootPath: string, filePath: string): boolean {
  return rootPath === "." || filePath === rootPath || filePath.startsWith(`${rootPath}/`);
}

function ecosystemMatchScore(detection: EcosystemDetection, filePaths: string[]): number {
  if (detection.id === "monorepo") {
    return -1;
  }

  if (filePaths.length === 0) {
    return detection.rootPath === "." ? 1 : 0;
  }

  const matchingPaths = filePaths.filter((filePath) => ecosystemPathMatches(detection.rootPath, filePath));
  if (matchingPaths.length === 0) {
    return -1;
  }

  return (detection.rootPath === "." ? 1 : 10 + detection.rootPath.length) + matchingPaths.length;
}

function ecosystemForImpact(impact: ImpactAnalysis, ecosystem?: EcosystemDetectionReport): EcosystemDetection | null {
  if (!ecosystem) {
    return null;
  }

  const filePaths = uniqueStrings([
    ...impact.changedFiles.map((file) => file.path),
    ...impact.affectedFiles.map((file) => file.path),
    ...impact.affectedTests.map((file) => file.path)
  ]);
  const ranked = ecosystem.detections
    .filter((detection) => detection.id !== "monorepo")
    .map((detection, index) => ({
      detection,
      index,
      score: ecosystemMatchScore(detection, filePaths)
    }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => (
      right.score - left.score
      || confidenceSortScore(right.detection.confidence) - confidenceSortScore(left.detection.confidence)
      || left.index - right.index
    ));

  return ranked[0]?.detection ?? ecosystem.primary;
}

function confidenceSortScore(confidence: EcosystemDetection["confidence"]): number {
  return confidence === "high" ? 2 : confidence === "medium" ? 1 : 0;
}

function gradleCommand(detection: EcosystemDetection, task: "test" | "build"): string {
  return detection.matchedSignals.some((signal) => signal.endsWith("gradlew"))
    ? `./gradlew ${task}`
    : `gradle ${task}`;
}

function ecosystemTestCommand(detection: EcosystemDetection): ImpactCommand | null {
  const id = detection.id as VerifyEcosystemId;
  const commands: Partial<Record<VerifyEcosystemId, string>> = {
    maven: "mvn test",
    gradle: gradleCommand(detection, "test"),
    python: detection.matchedSignals.some((signal) => /(?:^|\/)(pytest\.ini|pyproject\.toml|requirements\.txt)$/.test(signal))
      ? "pytest"
      : "python -m pytest",
    go: "go test ./...",
    dotnet: "dotnet test"
  };
  const command = commands[id];

  if (!command) {
    return null;
  }

  return {
    command,
    type: "test",
    scope: "project",
    confidence: "medium",
    reason: `${id} ecosystem default when no stronger affected test command exists`
  };
}

function ecosystemBuildCommand(detection: EcosystemDetection): ImpactCommand | null {
  const id = detection.id as VerifyEcosystemId;

  if (id === "maven") {
    return {
      command: "mvn verify",
      type: "verification",
      scope: "project",
      confidence: "medium",
      reason: "maven ecosystem broader verification default"
    };
  }

  if (id === "gradle") {
    return {
      command: gradleCommand(detection, "build"),
      type: "build",
      scope: "project",
      confidence: "medium",
      reason: "gradle ecosystem build default"
    };
  }

  return null;
}

function ecosystemFallbackCommands(
  impact: ImpactAnalysis,
  ecosystem: EcosystemDetectionReport | undefined,
  targetedTestCommands: ImpactCommand[],
  buildCommands: ImpactCommand[]
): { targetedTestCommands: ImpactCommand[]; buildCommands: ImpactCommand[] } {
  const detection = ecosystemForImpact(impact, ecosystem);

  if (!detection || detection.id === "node" || detection.id === "monorepo") {
    return { targetedTestCommands, buildCommands };
  }

  const fallbackTest = targetedTestCommands.length === 0 ? ecosystemTestCommand(detection) : null;
  const fallbackBuild = buildCommands.length === 0 ? ecosystemBuildCommand(detection) : null;

  return {
    targetedTestCommands: fallbackTest ? [...targetedTestCommands, fallbackTest] : targetedTestCommands,
    buildCommands: fallbackBuild ? [...buildCommands, fallbackBuild] : buildCommands
  };
}

function shouldSuppressFrontendChecks(impact: ImpactAnalysis, ecosystem?: EcosystemDetectionReport): boolean {
  const detection = ecosystemForImpact(impact, ecosystem);

  return Boolean(
    detection
    && !["node", "monorepo"].includes(detection.id)
    && !impact.affectedFiles.some((file) => isFrontendVisiblePath(file.path))
  );
}

function targetedTestLimit(task: string): number {
  const limits: Record<TaskSize, number> = {
    tiny: 3,
    small: 3,
    medium: 5,
    large: 8
  };

  return limits[classifyTaskSize(task).size];
}

function isStrongAffectedTest(test: ImpactAnalysis["affectedTests"][number]): boolean {
  return test.confidence === "strong";
}

function promotedTargetedTests(impact: ImpactAnalysis): ImpactAnalysis["affectedTests"] {
  return impact.affectedTests
    .map((test, index) => ({ test, index }))
    .filter((item) => isStrongAffectedTest(item.test))
    .sort((left, right) => right.test.score - left.test.score || left.index - right.index)
    .slice(0, targetedTestLimit(impact.task))
    .map((item) => item.test);
}

function textMatches(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

function taskMentionsContext(impact: ImpactAnalysis): boolean {
  return impact.taskMentionsContext ?? impact.taskContext?.taskMentionsContext ?? false;
}

function shouldIncludeContextReview(impact: ImpactAnalysis): boolean {
  if (impact.contextChanges.length === 0) {
    return false;
  }

  if (impact.mode !== "planned-task") {
    return true;
  }

  const contextChangePaths = new Set(impact.contextChanges.map((file) => file.path));

  return (
    taskMentionsContext(impact)
    || impact.affectedFiles.some((file) => isContextPath(file.path) || contextChangePaths.has(file.path))
    || impact.verificationHints.some((hint) => checkGroup(hint.type) === "context-review")
  );
}

function isContextOnlyVerification(impact: ImpactAnalysis): boolean {
  return (
    impact.mode !== "planned-task" &&
    impact.confidenceExplanation.evidence.contextOnlyChanges
    && impact.confidenceExplanation.evidence.nonContextChangedFiles === 0
  );
}

function confidenceExplanationForVerify(impact: ImpactAnalysis): ImpactAnalysis["confidenceExplanation"] {
  if (!isContextOnlyVerification(impact)) {
    return impact.confidenceExplanation;
  }

  return {
    ...impact.confidenceExplanation,
    level: "medium",
    reasons: impact.confidenceExplanation.reasons.includes(contextOnlyConfidenceReason)
      ? impact.confidenceExplanation.reasons
      : [...impact.confidenceExplanation.reasons, contextOnlyConfidenceReason]
  };
}

function impactText(impact: ImpactAnalysis): string {
  return impact.affectedFiles.map((file) => file.path).join(" ");
}

function matchingPaths(impact: ImpactAnalysis, pattern: RegExp): string[] {
  return impact.affectedFiles.map((file) => file.path).filter((filePath) => pattern.test(filePath));
}

function fallbackPaths(impact: ImpactAnalysis): string[] {
  return impact.affectedFiles.map((file) => file.path);
}

function smokeCheck(type: string, reason: string, paths: string[]): ImpactVerificationHint {
  return paths.length > 0 ? { type, reason, paths } : { type, reason };
}

function manualHint(type: string, reason: string, paths: string[] = [], command?: string): ImpactVerificationHint {
  return {
    type,
    reason,
    ...(paths.length > 0 ? { paths } : {}),
    ...(command ? { command } : {})
  };
}

function yamlPaths(paths: string[]): string[] {
  return paths.filter((filePath) => /\.ya?ml$/i.test(filePath));
}

function isUiOnlyDatabasePath(filePath: string): boolean {
  return isFrontendPath(filePath) && !isBackendDatabasePath(filePath);
}

function isAuthSecurityPath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);

  return /\b(middleware|security|session|sessions|csrf|permission|permissions|policy|policies)\b/i.test(normalized);
}

function commandWithPaths(command: string, paths: string[]): string {
  return paths.length > 0 ? `${command} ${paths.join(" ")}` : command;
}

function commandPathArgs(filePaths: string[]): string {
  return filePaths
    .flatMap(splitConcatenatedCommandPaths)
    .filter(Boolean)
    .join(" ");
}

function splitConcatenatedCommandPaths(filePath: string): string[] {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/g, "")
    .replace(
      /(\.(?:test|spec)\.(?:tsx|jsx|mjs|cjs|ts|js)|\.(?:tsx|jsx|mjs|cjs|ts|js))(?=(?:[A-Za-z0-9_.-]+\/|[A-Za-z0-9_.-]+\.(?:test|spec)\.|[A-Za-z0-9_.-]+\.(?:tsx|jsx|mjs|cjs|ts|js)))/g,
      "$1 "
    )
    .split(/\s+/)
    .map((item) => item.trim());
}

function targetedTestCommandsFromTests(tests: ImpactAnalysis["affectedTests"]): ImpactCommand[] {
  const runnablePaths: string[] = [];

  for (const test of tests) {
    if (!runnableNodeTestPattern.test(test.path)) {
      continue;
    }

    const candidatePaths = [...runnablePaths, test.path];
    const candidateCommand = `node --test ${commandPathArgs(candidatePaths)}`;

    if (candidateCommand.length <= maximumTargetedTestCommandLength) {
      runnablePaths.push(test.path);
    }
  }

  if (runnablePaths.length === 0) {
    return [];
  }

  return [{
    command: `node --test ${commandPathArgs(runnablePaths)}`,
    type: "test",
    scope: "focused",
    confidence: "high",
    reason: "run strong affected tests directly"
  }];
}

function domainMatches(impact: ImpactAnalysis): DomainMatch[] {
  const matches = impact.domainMatches ?? impact.taskContext?.domains ?? [];

  return matches
    .filter((match) => match.domain !== "context" || shouldIncludeContextReview(impact))
    .filter((match) => match.domain !== "api")
    .map(verificationDomainMatch);
}

function verificationDomainMatch(match: CoreDomainMatch): DomainMatch {
  return {
    domain: match.domain,
    paths: match.matchedPaths,
    signals: match.signals.map((signal) => (
      signal.path
        ? `${signal.source}:${signal.path}`
        : `${signal.source}:${signal.value}`
    ))
  };
}

function copyImpactInternalContext(source: ImpactAnalysis, target: ImpactAnalysis): ImpactAnalysis {
  const descriptors: PropertyDescriptorMap = {};

  if (source.taskContext) {
    descriptors.taskContext = {
      value: source.taskContext,
      enumerable: false,
      configurable: true
    };
  }

  if (source.domainMatches) {
    descriptors.domainMatches = {
      value: source.domainMatches,
      enumerable: false,
      configurable: true
    };
  }

  if (source.taskMentionsContext !== undefined) {
    descriptors.taskMentionsContext = {
      value: source.taskMentionsContext,
      enumerable: false,
      configurable: true
    };
  }

  if (Object.keys(descriptors).length > 0) {
    Object.defineProperties(target, descriptors);
  }

  return target;
}

function hasDomain(matches: DomainMatch[], domain: VerificationDomain): boolean {
  return matches.some((match) => match.domain === domain);
}

function pathsForDomains(matches: DomainMatch[], domains: VerificationDomain[], fallback: string[]): string[] {
  const paths = matches
    .filter((match) => domains.includes(match.domain))
    .flatMap((match) => match.paths);
  const unique = [...new Set(paths)];

  if (unique.length === 0) {
    return fallback;
  }

  const nonTestPaths = unique.filter((filePath) => !runnableNodeTestPattern.test(filePath));

  return nonTestPaths.length > 0 ? nonTestPaths : unique;
}

function prioritizedDatabasePaths(paths: string[]): string[] {
  const actual = paths.filter(isBackendDatabasePath);
  const other = paths.filter((filePath) => !isBackendDatabasePath(filePath) && !isUiOnlyDatabasePath(filePath));
  const uiOnly = paths.filter(isUiOnlyDatabasePath);

  return uniqueStrings([...actual, ...other, ...uiOnly]);
}

function actualDatabasePaths(paths: string[]): string[] {
  return paths.filter((filePath) => !isUiOnlyDatabasePath(filePath));
}

function frontendAuthPaths(paths: string[]): string[] {
  return paths.filter(isFrontendVisiblePath);
}

function securityAuthPaths(paths: string[]): string[] {
  return paths.filter(isAuthSecurityPath);
}

function confidenceExplanationWithDomains(
  impact: ImpactAnalysis,
  explanation: ImpactAnalysis["confidenceExplanation"]
): ImpactAnalysis["confidenceExplanation"] {
  const matches = preferredDomainMatches(impact);
  const reasons = uniqueStrings(explanation.reasons.map((reason) => (
    reason.replace(/^domain matched: ([^(]+)\s+\(.+\)$/i, "domain matched: $1").trim()
  )));

  for (const match of matches) {
    const reason = `domain matched: ${match.domain}`;

    if (!reasons.includes(reason)) {
      reasons.push(reason);
    }
  }

  return {
    ...explanation,
    reasons
  };
}

function preferredDomainMatches(impact: ImpactAnalysis): DomainMatch[] {
  const matches = domainMatches(impact);
  const domains = new Set(matches.map((match) => match.domain));

  const specificMatches = matches.filter((match) => !["frontend", "backend", "config", "context"].includes(match.domain));

  if (specificMatches.length === 0) {
    return matches.slice(0, 3);
  }

  return uniqueDomainMatches([
    ...specificMatches,
    ...(domains.has("context") ? matches.filter((match) => match.domain === "context") : []),
    ...matches.filter((match) => match.domain === "backend" && specificMatches.length < 2)
  ]).slice(0, 3);
}

function uniqueDomainMatches(matches: DomainMatch[]): DomainMatch[] {
  const seen = new Set<VerificationDomain>();
  const unique: DomainMatch[] = [];

  for (const match of matches) {
    if (seen.has(match.domain)) {
      continue;
    }

    seen.add(match.domain);
    unique.push(match);
  }

  return unique;
}

function compactConfidenceReason(reason: string): string | null {
  if (/^(routing confidence|change confidence):/i.test(reason)) {
    return null;
  }

  if (/^filename stem matched$/i.test(reason)) {
    return null;
  }

  if (/^routing evidence not strong enough/i.test(reason)) {
    return null;
  }

  if (/^(weak test relationship|no test relationship)$/i.test(reason)) {
    return "no strong test relationship";
  }

  return reason;
}

function compactConfidenceExplanation(
  explanation: ImpactAnalysis["confidenceExplanation"]
): ImpactAnalysis["confidenceExplanation"] {
  return {
    ...explanation,
    reasons: uniqueStrings(explanation.reasons
      .map(compactConfidenceReason)
      .filter((reason): reason is string => reason !== null))
  };
}

function domainSmokeChecks(impact: ImpactAnalysis): ImpactVerificationHint[] {
  const matches = domainMatches(impact);
  const checks: ImpactVerificationHint[] = [];
  const fallback = fallbackPaths(impact);

  if (hasDomain(matches, "auth") || hasDomain(matches, "login")) {
    const paths = pathsForDomains(matches, ["auth", "login"], fallback);
    const frontendPaths = frontendAuthPaths(paths);

    checks.push(smokeCheck(
      "auth-flow",
      "Manually check the login/logout flow for the matched auth or login surface.",
      frontendPaths.length > 0 ? frontendPaths : paths
    ));
  }

  if (hasDomain(matches, "cache") || hasDomain(matches, "redis")) {
    checks.push(smokeCheck(
      "cache-behavior",
      "Manually check cache miss and cache hit behavior for the matched cache surface.",
      pathsForDomains(matches, ["cache", "redis"], fallback)
    ));
  }

  if (hasDomain(matches, "workflow")) {
    const workflowPaths = pathsForDomains(matches, ["workflow"], fallback).filter(isWorkflowPath);

    if (workflowPaths.length > 0) {
      checks.push(smokeCheck(
        "ci-workflow",
        "Manually review the relevant workflow path and confirm its trigger/job intent.",
        workflowPaths
      ));
    }
  }

  if (hasDomain(matches, "github-integration")) {
    checks.push(smokeCheck(
      "github-integration",
      "Manually check the affected GitHub integration path with a representative API, webhook, or controller request.",
      pathsForDomains(matches, ["github-integration"], fallback)
    ));
  }

  if (hasDomain(matches, "database") || hasDomain(matches, "postgres")) {
    const paths = prioritizedDatabasePaths(pathsForDomains(matches, ["database", "postgres"], fallback));
    const actualPaths = actualDatabasePaths(paths);

    if (actualPaths.length > 0) {
      checks.push(smokeCheck(
        "database-behavior",
        "Manually check the affected database path with representative existing and new data.",
        actualPaths
      ));
    } else {
      checks.push(smokeCheck(
        "postgres-ui-reference",
        "Manually check the UI-only Postgres reference for display or copy regressions.",
        paths
      ));
    }
  }

  if (hasDomain(matches, "frontend")) {
    checks.push(smokeCheck(
      "frontend-ui",
      "Manually check the affected UI in a browser for rendering, interaction, and visible regressions.",
      pathsForDomains(matches, ["frontend"], fallback)
    ));
  }

  if (hasDomain(matches, "backend")) {
    checks.push(smokeCheck(
      "backend-behavior",
      "Manually check the affected backend path with a representative request or worker invocation.",
      pathsForDomains(matches, ["backend"], fallback)
    ));
  }

  return compactAllChecks(checks);
}

function domainManualChecks(impact: ImpactAnalysis): ImpactVerificationHint[] {
  const matches = domainMatches(impact);
  const checks: ImpactVerificationHint[] = [];
  const fallback = fallbackPaths(impact);
  const workflowPaths = pathsForDomains(matches, ["workflow"], fallback).filter(isWorkflowPath);
  const yamlWorkflowPaths = yamlPaths(workflowPaths);

  if (hasDomain(matches, "auth") || hasDomain(matches, "login")) {
    const paths = pathsForDomains(matches, ["auth", "login"], fallback);
    const securityPaths = securityAuthPaths(paths);

    checks.push(manualHint("invalid-credentials", "Check invalid credentials, logout, and session expiration behavior.", paths));
    if (securityPaths.length > 0) {
      checks.push(manualHint("security-session", "Check middleware/security handling for session boundaries, authorization failures, and expired sessions.", securityPaths));
    }
  }

  if (hasDomain(matches, "cache") || hasDomain(matches, "redis")) {
    const paths = pathsForDomains(matches, ["cache", "redis"], fallback);

    checks.push(manualHint("cache-hit-miss", "Check cache miss, cache hit, and cache invalidation behavior.", paths));
    checks.push(manualHint("cache-fallback", "Check fallback behavior when Redis or the cache backend is unavailable.", paths));
  }

  if (hasDomain(matches, "workflow") && workflowPaths.length > 0) {
    checks.push(manualHint(
      "yaml-syntax",
      "Check workflow YAML syntax if YAML files are affected.",
      yamlWorkflowPaths,
      yamlWorkflowPaths.length > 0 ? commandWithPaths("yamllint", yamlWorkflowPaths) : undefined
    ));
    checks.push(manualHint(
      "workflow-lint",
      "Run a workflow dry-run or lint tool if available for this repository.",
      workflowPaths,
      workflowPaths.length > 0 ? commandWithPaths("actionlint", workflowPaths) : undefined
    ));
    checks.push(manualHint("workflow-triggers-secrets", "Check workflow trigger conditions, permissions, and required secrets.", workflowPaths));
  }

  if (hasDomain(matches, "github-integration")) {
    const paths = pathsForDomains(matches, ["github-integration"], fallback);

    checks.push(manualHint("github-api-integration", "Check GitHub API, webhook, route, or controller integration behavior, including request/response contracts and error handling.", paths));
    checks.push(manualHint("backend-contract", "Check API or worker contract behavior, errors, and side effects.", paths));
  }

  if (hasDomain(matches, "database") || hasDomain(matches, "postgres")) {
    const paths = prioritizedDatabasePaths(pathsForDomains(matches, ["database", "postgres"], fallback));
    const actualPaths = actualDatabasePaths(paths);

    if (actualPaths.length > 0) {
      checks.push(manualHint("schema-compatibility", "Check migration and schema compatibility for existing deployments.", actualPaths));
      checks.push(manualHint("data-rollback-impact", "Check rollback behavior and existing data impact.", actualPaths));
    } else {
      checks.push(manualHint("postgres-ui-reference", "Check the UI-only Postgres reference for display/copy regressions; no schema or database contract check is implied.", paths));
    }
  }

  if (hasDomain(matches, "frontend")) {
    const paths = pathsForDomains(matches, ["frontend"], fallback);

    checks.push(manualHint("frontend-regression", "Check responsive layout, loading state, and primary interaction behavior.", paths));
  }

  if (hasDomain(matches, "backend")) {
    const paths = pathsForDomains(matches, ["backend"], fallback);

    checks.push(manualHint("backend-contract", "Check API or worker contract behavior, errors, and side effects.", paths));
  }

  if (hasDomain(matches, "config")) {
    const paths = pathsForDomains(matches, ["config"], fallback);

    checks.push(manualHint("config-load", "Check configuration loading, defaults, and missing environment variable behavior.", paths));
  }

  if (hasDomain(matches, "context")) {
    const paths = pathsForDomains(matches, ["context"], impact.contextChanges.map((file) => file.path));

    checks.push(manualHint("context-routing", "Check context and routing docs remain accurate for agent workflow.", paths));
  }

  return compactAllChecks(checks);
}

function smokeChecksFromImpact(impact: ImpactAnalysis, ecosystem?: EcosystemDetectionReport): ImpactVerificationHint[] {
  if (isContextOnlyVerification(impact)) {
    return [];
  }

  const checks: ImpactVerificationHint[] = domainSmokeChecks(impact)
    .filter((check) => !shouldSuppressFrontendChecks(impact, ecosystem) || checkGroup(check.type) !== "frontend-ui");
  const text = impactText(impact).toLowerCase();
  const docsOnly = impact.affectedFiles.length > 0 && impact.affectedFiles.every((file) => isDocsPath(file.path));

  if (textMatches(text, /\b(translation|translate|i18n|locale|localization|copy)\b/)) {
    checks.push(smokeCheck(
      "ui-text",
      "Manually check the affected UI text or location where the translation appears.",
      matchingPaths(impact, /\b(i18n|locale|translation|translations|copy|ui)\b/i)
    ));
  }

  if (docsOnly) {
    checks.push(smokeCheck(
      "docs-rendering",
      "Review rendered Markdown or published docs for formatting, links, and expected wording.",
      impact.affectedFiles.map((file) => file.path)
    ));
  }

  return compactAllChecks(checks);
}

function contextOnlyValidationChecklist(impact: ImpactAnalysis): string[] {
  const checklist = ["Inspect context changes."];

  if (impact.contextChanges.length > 0) {
    checklist.push("Confirm RCC workflow/context changes are intentional.");
    checklist.push("Run `rcc validate` if context files changed.");
  }

  return checklist;
}

function domainValidationChecklistItems(impact: ImpactAnalysis): string[] {
  const matches = domainMatches(impact);
  const checklist: string[] = [];
  const hasAuth = hasDomain(matches, "auth") || hasDomain(matches, "login");
  const hasCache = hasDomain(matches, "cache") || hasDomain(matches, "redis");
  const hasWorkflow = hasDomain(matches, "workflow");
  const hasGithubIntegration = hasDomain(matches, "github-integration");
  const hasDatabase = hasDomain(matches, "database") || hasDomain(matches, "postgres");

  if (hasAuth) {
    checklist.push(
      "Verify login flow.",
      "Verify logout flow.",
      "Verify invalid credentials behavior.",
      "Verify session expiration behavior."
    );
  }

  if (hasCache) {
    checklist.push(
      "Verify cache miss behavior.",
      "Verify cache hit behavior.",
      "Verify cache invalidation behavior.",
      "Verify Redis/cache backend unavailable fallback."
    );
  }

  if (hasWorkflow) {
    checklist.push(
      "Verify workflow syntax.",
      "Verify workflow trigger conditions.",
      "Verify workflow permissions.",
      "Verify required secrets."
    );
  }

  if (hasGithubIntegration) {
    checklist.push(
      "Verify GitHub API/webhook contract behavior.",
      "Verify GitHub integration error handling."
    );
  }

  if (hasDatabase) {
    const paths = prioritizedDatabasePaths(pathsForDomains(matches, ["database", "postgres"], fallbackPaths(impact)));
    const actualPaths = actualDatabasePaths(paths);

    if (actualPaths.length > 0) {
      checklist.push(
        "Verify migration compatibility.",
        "Verify rollback behavior.",
        "Verify existing data compatibility."
      );
    } else {
      checklist.push("Verify UI-only Postgres reference display/copy behavior.");
    }
  }

  return uniqueStrings(checklist);
}

function validationChecklistFromImpact(
  impact: ImpactAnalysis,
  targetedTests: ImpactAnalysis["affectedTests"] = promotedTargetedTests(impact)
): string[] {
  if (isContextOnlyVerification(impact)) {
    return contextOnlyValidationChecklist(impact);
  }

  const domainItems = domainValidationChecklistItems(impact);
  const checklist: string[] = domainItems.length === 0 ? ["Inspect affected files."] : [];

  if (targetedTests.length === 0 && domainItems.length === 0) {
    checklist.push("No strongly related tests were found; do not add generic tests.");
  }

  if (domainItems.length > 0) {
    checklist.push(...domainItems);
  }

  if (shouldIncludeContextReview(impact)) {
    checklist.push("Confirm RCC context changes are intentional.");
  }

  return checklist;
}

function notesFromImpact(impact: ImpactAnalysis): string[] {
  const notes = [...impact.notes];
  const docsOnly = impact.affectedFiles.length > 0 && impact.affectedFiles.every((file) => isDocsPath(file.path));
  const workingTreeNote = "Working-tree verification mode: plan is based on actual repository changes.";

  if (impact.mode === "working-tree" && !notes.includes(workingTreeNote)) {
    notes.push(workingTreeNote);
  }

  if (impact.mode === "planned-task" && !notes.includes(plannedModeNote)) {
    notes.push(plannedModeNote);
  }

  if (docsOnly && !notes.includes("Docs-only impact detected; verify documentation changes manually.")) {
    notes.push("Docs-only impact detected; verify documentation changes manually.");
  }

  if (isContextOnlyVerification(impact) && !notes.includes(contextOnlyVerificationNote)) {
    notes.push(contextOnlyVerificationNote);
  }

  if (
    impact.confidenceExplanation.evidence.contextOnlyChanges
    && !notes.includes(contextOnlyImpactNote)
  ) {
    notes.push(contextOnlyImpactNote);
  }

  return notes;
}

function plannedNotesFromImpact(impact: ImpactAnalysis): string[] {
  const notes = notesFromImpact(impact).filter((note) => (
    note !== contextOnlyVerificationNote
    && note !== contextOnlyImpactNote
    && !/^Planned verification mode: promoted task-route estimates/i.test(note)
  ));

  return notes.includes(plannedModeNote) ? notes : [...notes, plannedModeNote];
}

function plannedConfidenceExplanation(impact: ImpactAnalysis): ImpactAnalysis["confidenceExplanation"] {
  const evidence = {
    ...impact.confidenceExplanation.evidence,
    contextOnlyChanges: false
  };
  const reasons = impact.confidenceExplanation.reasons.filter((reason) => (
    reason !== "context-only changes detected"
    && reason !== contextOnlyConfidenceReason
    && !/^context changes do not raise confidence/i.test(reason)
  ));
  const taskReasons: string[] = [];

  if (evidence.taskRoutingMatched || impact.affectedFiles.some((file) => /\btask routing matched\b/i.test(file.reason))) {
    taskReasons.push("task routing matched");
  }

  if (evidence.testRelationship === "strong" || impact.affectedTests.some((test) => test.confidence === "strong")) {
    taskReasons.push("strong test relationship");
  }

  const contextReasons = reasons.filter((reason) => /\bcontext\b/i.test(reason));
  const nonContextReasons = reasons.filter((reason) => !/\bcontext\b/i.test(reason));

  return {
    ...impact.confidenceExplanation,
    reasons: uniqueStrings([
      ...taskReasons,
      ...nonContextReasons,
      ...contextReasons
    ]),
    evidence
  };
}

export function createVerificationPlan(input: VerificationPlanInput): VerificationPlan {
  return finalizeVerificationPlan({
    schemaVersion: 1,
    command: "verify",
    task: input.task,
    mode: input.mode,
    summary: input.summary,
    targetedTests: input.targetedTests ?? [],
    targetedTestCommands: input.targetedTestCommands ?? [],
    buildCommands: input.buildCommands ?? [],
    smokeChecks: input.smokeChecks ?? [],
    manualChecks: input.manualChecks ?? [],
    validationChecklist: input.validationChecklist ?? [],
    confidence: input.confidence,
    confidenceExplanation: input.confidenceExplanation,
    notes: input.notes ?? []
  });
}

export function createVerificationPlanFromImpact(
  impact: ImpactAnalysis,
  level: VerificationLevel = defaultVerificationLevel,
  ecosystem?: EcosystemDetectionReport
): VerificationPlan {
  const contextChangePaths = impact.contextChanges.map((file) => file.path);
  const contextOnly = isContextOnlyVerification(impact);
  const targetedTests = promotedTargetedTests(impact);
  const targetedTestCommands = targetedTestCommandsFromTests(targetedTests);
  const suggestedBuildCommands = commandsByType(impact.suggestedCommands, "build");
  const fallbackCommands = ecosystemFallbackCommands(impact, ecosystem, targetedTestCommands, suggestedBuildCommands);

  if (contextOnly) {
    return normalizeVerificationPlan(createVerificationPlan({
      task: impact.task,
      mode: impact.mode,
      summary: impact.summary,
      targetedTests: [],
      targetedTestCommands: [],
      buildCommands: fallbackCommands.buildCommands,
      smokeChecks: [],
      manualChecks: compactChecks([
        manualCheck("context-changes", "Manually review context changes for workflow and routing impact.", contextChangePaths)
      ]),
      validationChecklist: validationChecklistFromImpact(impact, []),
      confidence: "medium",
      confidenceExplanation: compactConfidenceExplanation(confidenceExplanationWithDomains(impact, confidenceExplanationForVerify(impact))),
      notes: notesFromImpact(impact)
    }), level);
  }

  return normalizeVerificationPlan(createVerificationPlan({
    task: impact.task,
    mode: impact.mode,
    summary: impact.summary,
    targetedTests,
    targetedTestCommands: fallbackCommands.targetedTestCommands,
    buildCommands: fallbackCommands.buildCommands,
    smokeChecks: smokeChecksFromImpact(impact, ecosystem),
    manualChecks: [
      ...impact.verificationHints,
      ...domainManualChecks(impact),
      ...compactChecks([
        manualCheck("context-changes", "Secondarily review RCC context changes for workflow and routing impact.", contextChangePaths)
      ])
    ],
    validationChecklist: validationChecklistFromImpact(impact, targetedTests),
    confidence: impact.confidence,
    confidenceExplanation: compactConfidenceExplanation(confidenceExplanationWithDomains(impact, impact.confidenceExplanation)),
    notes: notesFromImpact(impact)
  }), level);
}

export function createPlannedVerificationPlanFromImpact(
  impact: ImpactAnalysis,
  level: VerificationLevel = defaultVerificationLevel,
  ecosystem?: EcosystemDetectionReport
): VerificationPlan {
  const plannedImpact: ImpactAnalysis = {
    ...impact,
    mode: "planned-task"
  };
  copyImpactInternalContext(impact, plannedImpact);
  const includeContextReview = shouldIncludeContextReview(plannedImpact);
  const contextChangePaths = includeContextReview ? plannedImpact.contextChanges.map((file) => file.path) : [];
  const targetedTests = promotedTargetedTests(plannedImpact);
  const targetedTestCommands = targetedTestCommandsFromTests(targetedTests);
  const suggestedBuildCommands = commandsByType(plannedImpact.suggestedCommands, "build");
  const fallbackCommands = ecosystemFallbackCommands(plannedImpact, ecosystem, targetedTestCommands, suggestedBuildCommands);
  const notes = plannedNotesFromImpact(plannedImpact);

  return normalizeVerificationPlan(createVerificationPlan({
    task: plannedImpact.task,
    mode: plannedImpact.mode,
    summary: plannedImpact.summary,
    targetedTests,
    targetedTestCommands: fallbackCommands.targetedTestCommands,
    buildCommands: fallbackCommands.buildCommands,
    smokeChecks: smokeChecksFromImpact(plannedImpact, ecosystem),
    manualChecks: [
      ...plannedImpact.verificationHints,
      ...domainManualChecks(plannedImpact),
      ...compactChecks([
        manualCheck("context-changes", "Secondarily review RCC context changes for workflow and routing impact.", contextChangePaths)
      ])
    ],
    validationChecklist: validationChecklistFromImpact(plannedImpact, targetedTests),
    confidence: plannedImpact.confidence,
    confidenceExplanation: compactConfidenceExplanation(confidenceExplanationWithDomains(plannedImpact, plannedConfidenceExplanation(plannedImpact))),
    notes
  }), level);
}

export function buildVerificationPlanFromImpact(
  impact: ImpactAnalysis,
  options: { level?: VerificationLevel; planned?: boolean; ecosystem?: EcosystemDetectionReport } = {}
): VerificationPlan {
  const level = options.level ?? defaultVerificationLevel;

  if (options.planned) {
    return createPlannedVerificationPlanFromImpact(impact, level, options.ecosystem);
  }

  return createVerificationPlanFromImpact(impact, level, options.ecosystem);
}

export async function buildVerificationPlan(
  cwd: string,
  task: string,
  options: { level?: VerificationLevel; planned?: boolean; taskOnly?: boolean } = {}
): Promise<VerificationPlan> {
  const impact = await buildImpactAnalysis(cwd, task, {
    taskOnly: options.taskOnly ?? false
  });
  const ecosystem = await detectRepositoryEcosystems(cwd);

  return buildVerificationPlanFromImpact(impact, { ...options, ecosystem });
}
