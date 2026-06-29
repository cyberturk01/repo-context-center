import type { ImpactAnalysis, ImpactCommand, ImpactVerificationHint } from "../impact/impactTypes";
import { buildImpactAnalysis } from "../impact/buildImpact";
import { classifyTaskSize, type TaskSize } from "../work/taskSize";
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
const runnableNodeTestPattern = /\.(test|spec)\.[cm]?[jt]sx?$/i;
const maximumTargetedTestCommandLength = 300;
const defaultVerificationLevel: VerificationLevel = "balanced";
const priorityRank: Record<VerificationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

type VerificationDomain =
  | "auth"
  | "login"
  | "cache"
  | "redis"
  | "database"
  | "postgres"
  | "workflow"
  | "github-integration"
  | "frontend"
  | "backend"
  | "config"
  | "context";

interface DomainDefinition {
  domain: VerificationDomain;
  pattern: RegExp;
}

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

const domainDefinitions: DomainDefinition[] = [
  { domain: "auth", pattern: /\b(auth|authentication|authorization|authorize|oauth|jwt|session|sessions)\b/i },
  { domain: "login", pattern: /\b(log-?in|log-?out|signin|sign-in|signout|sign-out|credentials?)\b/i },
  { domain: "cache", pattern: /\b(cache|caches|cached|caching|cacheable)\b/i },
  { domain: "redis", pattern: /\b(redis|ioredis|redis-cli)\b/i },
  { domain: "database", pattern: /\b(database|db|schema|schemas|migration|migrations|sql|query|queries|orm)\b/i },
  { domain: "postgres", pattern: /\b(postgres|postgresql|pg|psql)\b/i },
  { domain: "workflow", pattern: /\b(github workflow|github workflows|github action|github actions|ci|workflow|workflows|pipeline|pipelines)\b/i },
  { domain: "github-integration", pattern: /\b(github api|github integration|github app|github webhook|github controller|github route|octokit)\b/i },
  { domain: "frontend", pattern: /\b(frontend|front-end|ui|browser|component|components|page|pages|react|vue|svelte|css|tsx|jsx)\b/i },
  { domain: "backend", pattern: /\b(backend|back-end|api|server|service|services|controller|controllers|route|routes|endpoint|endpoints|worker|workers)\b/i },
  { domain: "config", pattern: /\b(config|configuration|settings|env|environment|feature flag|feature flags|package\.json|tsconfig|vite|webpack|eslint)\b/i },
  { domain: "context", pattern: /\b(context|repo context|rcc|agents\.md|docs\/ai-context)\b/i }
];

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

function allAffectedPaths(impact: ImpactAnalysis): string[] {
  return [
    ...impact.affectedFiles.map((file) => file.path),
    ...impact.affectedTests.map((test) => test.path)
  ];
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

function normalizedPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function isWorkflowPath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);

  return (
    /^\.github\/workflows\/.+\.ya?ml$/i.test(normalized)
    || /^\.github\/actions\//i.test(normalized)
    || /(^|\/)(ci|workflow|workflows|pipeline|pipelines)[^/]*\.ya?ml$/i.test(normalized)
  );
}

function isGithubIntegrationPath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);

  if (/^\.github\/(workflows|actions)\//i.test(normalized)) {
    return false;
  }

  return (
    /\bgithub\b/i.test(normalized)
    && /\b(api|app|apps|client|clients|controller|controllers|integration|integrations|route|routes|service|services|webhook|webhooks)\b/i.test(normalized)
  ) || /(^|\/)(api|controllers?|integrations?|routes?|services?|webhooks?)\/github[^/]*\.[cm]?[jt]sx?$/i.test(normalized);
}

function isFrontendPath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);

  return (
    /(^|\/)(app|builder|browser|components?|frontend|pages?|ui|views?)\//i.test(normalized)
    || /\.(css|scss|sass|less|tsx|jsx)$/i.test(normalized)
  );
}

function isBackendDatabasePath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);

  if (isFrontendPath(normalized)) {
    return false;
  }

  return (
    /(^|\/)(db|database|migrations?|schema|schemas|sql)\//i.test(normalized)
    || /(^|\/)(postgres|postgresql|pg|database|schema|migration|query|queries)[^/]*\.(sql|[cm]?[jt]sx?)$/i.test(normalized)
  );
}

function isUiOnlyDatabasePath(filePath: string): boolean {
  return isFrontendPath(filePath) && !isBackendDatabasePath(filePath);
}

function isAuthSecurityPath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);

  return /\b(middleware|security|session|sessions|csrf|permission|permissions|policy|policies)\b/i.test(normalized);
}

function taskEvidence(task: string, pattern: RegExp): string[] {
  const match = task.match(pattern);

  return match ? [`task:${match[0]}`] : [];
}

function pathEvidence(label: string, paths: string[]): string[] {
  return paths.map((filePath) => `${label}:${filePath}`);
}

function addDomainMatch(
  matches: DomainMatch[],
  domain: VerificationDomain,
  paths: string[],
  signals: string[]
): void {
  const uniqueSignals = uniqueStrings(signals);

  if (uniqueSignals.length === 0) {
    return;
  }

  matches.push({
    domain,
    paths: uniqueStrings(paths),
    signals: uniqueSignals
  });
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
  const task = impact.task;
  const affectedPaths = allAffectedPaths(impact);
  const contextPaths = impact.contextChanges.map((file) => file.path);
  const matches: DomainMatch[] = [];

  for (const definition of domainDefinitions) {
    if (definition.domain === "workflow") {
      const workflowPaths = affectedPaths.filter(isWorkflowPath);
      const workflowTaskEvidence = taskEvidence(task, definition.pattern);
      const integrationOnly = affectedPaths.length > 0 && affectedPaths.every((filePath) => (
        isGithubIntegrationPath(filePath) || definition.pattern.test(filePath)
      ));

      addDomainMatch(
        matches,
        definition.domain,
        workflowPaths,
        [
          ...pathEvidence("workflow path", workflowPaths),
          ...(workflowPaths.length > 0 || affectedPaths.length === 0 || !integrationOnly ? workflowTaskEvidence : [])
        ]
      );
      continue;
    }

    if (definition.domain === "github-integration") {
      const integrationPaths = affectedPaths.filter(isGithubIntegrationPath);

      addDomainMatch(
        matches,
        definition.domain,
        integrationPaths,
        [
          ...taskEvidence(task, definition.pattern),
          ...pathEvidence("github integration path", integrationPaths)
        ]
      );
      continue;
    }

    const signals: string[] = [];
    const paths = new Set<string>();

    signals.push(...taskEvidence(task, definition.pattern));

    const affectedFileMatches = impact.affectedFiles
      .map((file) => file.path)
      .filter((filePath) => definition.pattern.test(filePath));

    if (affectedFileMatches.length > 0) {
      signals.push(...pathEvidence("affected file", affectedFileMatches));
      affectedFileMatches.forEach((filePath) => paths.add(filePath));
    }

    const testMatches = impact.affectedTests
      .map((test) => test.path)
      .filter((filePath) => definition.pattern.test(filePath));

    if (testMatches.length > 0) {
      signals.push(...pathEvidence("test path", testMatches));
      testMatches.forEach((filePath) => paths.add(filePath));
    }

    if (definition.domain === "context") {
      const contextMatches = contextPaths.filter((filePath) => definition.pattern.test(filePath));

      if (contextMatches.length > 0) {
        signals.push(...pathEvidence("context change", contextMatches));
        contextMatches.forEach((filePath) => paths.add(filePath));
      }
    }

    if (
      signals.length > 0
      && signals.every((signal) => signal.startsWith("test path:"))
    ) {
      continue;
    }

    if (signals.length === 0) {
      continue;
    }

    if (paths.size === 0) {
      affectedPaths.forEach((filePath) => paths.add(filePath));
    }

    addDomainMatch(matches, definition.domain, [...paths], signals);
  }

  return matches;
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
  return paths.filter(isFrontendPath);
}

function securityAuthPaths(paths: string[]): string[] {
  return paths.filter(isAuthSecurityPath);
}

function confidenceExplanationWithDomains(
  impact: ImpactAnalysis,
  explanation: ImpactAnalysis["confidenceExplanation"]
): ImpactAnalysis["confidenceExplanation"] {
  const reasons = [...explanation.reasons];

  for (const match of domainMatches(impact)) {
    const reason = `domain matched: ${match.domain} (${match.signals.join(", ")})`;

    if (!reasons.includes(reason)) {
      reasons.push(reason);
    }
  }

  return {
    ...explanation,
    reasons
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
    checks.push(smokeCheck(
      "ci-workflow",
      "Manually review the relevant workflow path and confirm its trigger/job intent.",
      pathsForDomains(matches, ["workflow"], fallback)
    ));
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

  if (hasDomain(matches, "workflow")) {
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

function smokeChecksFromImpact(impact: ImpactAnalysis): ImpactVerificationHint[] {
  if (isContextOnlyVerification(impact)) {
    return [];
  }

  const checks: ImpactVerificationHint[] = [...domainSmokeChecks(impact)];
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

  if (impact.contextChanges.length > 0) {
    checklist.push("Confirm RCC context changes are intentional.");
  }

  return checklist;
}

function notesFromImpact(impact: ImpactAnalysis): string[] {
  const notes = [...impact.notes];
  const docsOnly = impact.affectedFiles.length > 0 && impact.affectedFiles.every((file) => isDocsPath(file.path));
  const contextOnlyNote = "Context-only changes detected; verify focuses on RCC/context files and does not promote task-route estimates to targeted tests or smoke checks.";
  const workingTreeNote = "Working-tree verification mode: plan is based on actual repository changes.";
  const plannedModeNote = "Planned verification mode: plan uses task routing, impact analysis, and repository learning without requiring source code changes.";

  if (impact.mode === "working-tree" && !notes.includes(workingTreeNote)) {
    notes.push(workingTreeNote);
  }

  if (impact.mode === "planned-task" && !notes.includes(plannedModeNote)) {
    notes.push(plannedModeNote);
  }

  if (docsOnly && !notes.includes("Docs-only impact detected; verify documentation changes manually.")) {
    notes.push("Docs-only impact detected; verify documentation changes manually.");
  }

  if (isContextOnlyVerification(impact) && !notes.includes(contextOnlyNote)) {
    notes.push(contextOnlyNote);
  }

  if (
    impact.confidenceExplanation.evidence.contextOnlyChanges
    && !notes.includes("Context-only impact detected; verify context changes manually.")
  ) {
    notes.push("Context-only impact detected; verify context changes manually.");
  }

  return notes;
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
  level: VerificationLevel = defaultVerificationLevel
): VerificationPlan {
  const affectedFilePaths = impact.affectedFiles.map((file) => file.path);
  const contextChangePaths = impact.contextChanges.map((file) => file.path);
  const contextOnly = isContextOnlyVerification(impact);
  const targetedTests = promotedTargetedTests(impact);
  const targetedTestCommands = targetedTestCommandsFromTests(targetedTests);

  if (contextOnly) {
    return normalizeVerificationPlan(createVerificationPlan({
      task: impact.task,
      mode: impact.mode,
      summary: impact.summary,
      targetedTests: [],
      targetedTestCommands: [],
      buildCommands: [],
      smokeChecks: [],
      manualChecks: compactChecks([
        manualCheck("context-changes", "Manually review context changes for workflow and routing impact.", contextChangePaths)
      ]),
      validationChecklist: validationChecklistFromImpact(impact, []),
      confidence: "medium",
      confidenceExplanation: confidenceExplanationWithDomains(impact, confidenceExplanationForVerify(impact)),
      notes: notesFromImpact(impact)
    }), level);
  }

  return normalizeVerificationPlan(createVerificationPlan({
    task: impact.task,
    mode: impact.mode,
    summary: impact.summary,
    targetedTests,
    targetedTestCommands,
    buildCommands: commandsByType(impact.suggestedCommands, "build"),
    smokeChecks: smokeChecksFromImpact(impact),
    manualChecks: [
      ...compactChecks([
        manualCheck("affected-files", "Manually inspect changed/affected files before secondary verification.", affectedFilePaths)
      ]),
      ...impact.verificationHints,
      ...domainManualChecks(impact),
      ...compactChecks([
        manualCheck("context-changes", "Secondarily review RCC context changes for workflow and routing impact.", contextChangePaths)
      ])
    ],
    validationChecklist: validationChecklistFromImpact(impact, targetedTests),
    confidence: impact.confidence,
    confidenceExplanation: confidenceExplanationWithDomains(impact, impact.confidenceExplanation),
    notes: notesFromImpact(impact)
  }), level);
}

export function createPlannedVerificationPlanFromImpact(
  impact: ImpactAnalysis,
  level: VerificationLevel = defaultVerificationLevel
): VerificationPlan {
  const plannedImpact: ImpactAnalysis = {
    ...impact,
    mode: "planned-task"
  };
  const affectedFilePaths = plannedImpact.affectedFiles.map((file) => file.path);
  const contextChangePaths = plannedImpact.contextChanges.map((file) => file.path);
  const targetedTests = promotedTargetedTests(plannedImpact);
  const targetedTestCommands = targetedTestCommandsFromTests(targetedTests);
  const notes = notesFromImpact(plannedImpact).filter((note) => (
    note !== "Context-only changes detected; verify focuses on RCC/context files and does not promote task-route estimates to targeted tests or smoke checks."
  ));
  const plannedNote = "Planned verification mode: promoted task-route estimates even though no non-context changed files were present.";

  if (plannedImpact.confidenceExplanation.evidence.nonContextChangedFiles === 0 && !notes.includes(plannedNote)) {
    notes.push(plannedNote);
  }

  return normalizeVerificationPlan(createVerificationPlan({
    task: plannedImpact.task,
    mode: plannedImpact.mode,
    summary: plannedImpact.summary,
    targetedTests,
    targetedTestCommands,
    buildCommands: commandsByType(plannedImpact.suggestedCommands, "build"),
    smokeChecks: smokeChecksFromImpact(plannedImpact),
    manualChecks: [
      ...compactChecks([
        manualCheck("affected-files", "Manually inspect planned affected files for behavior-specific validation.", affectedFilePaths)
      ]),
      ...plannedImpact.verificationHints,
      ...domainManualChecks(plannedImpact),
      ...compactChecks([
        manualCheck("context-changes", "Secondarily review RCC context changes for workflow and routing impact.", contextChangePaths)
      ])
    ],
    validationChecklist: validationChecklistFromImpact(plannedImpact, targetedTests),
    confidence: plannedImpact.confidence,
    confidenceExplanation: confidenceExplanationWithDomains(plannedImpact, plannedImpact.confidenceExplanation),
    notes
  }), level);
}

export async function buildVerificationPlan(
  cwd: string,
  task: string,
  options: { level?: VerificationLevel; planned?: boolean; taskOnly?: boolean } = {}
): Promise<VerificationPlan> {
  const impact = await buildImpactAnalysis(cwd, task, {
    taskOnly: options.taskOnly ?? false
  });
  const level = options.level ?? defaultVerificationLevel;

  if (options.planned) {
    return createPlannedVerificationPlanFromImpact(impact, level);
  }

  return createVerificationPlanFromImpact(impact, level);
}
