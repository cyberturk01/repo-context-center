import type { ImpactAnalysis, ImpactCommand, ImpactVerificationHint } from "../impact/impactTypes";
import { buildImpactAnalysis } from "../impact/buildImpact";
import type { VerificationPlan, VerificationPlanInput } from "./verifyTypes";

const contextOnlyConfidenceReason = "verify confidence reduced because only context files changed";

type VerificationDomain =
  | "auth"
  | "login"
  | "cache"
  | "redis"
  | "database"
  | "postgres"
  | "workflow"
  | "github-actions"
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

const domainDefinitions: DomainDefinition[] = [
  { domain: "auth", pattern: /\b(auth|authentication|authorization|authorize|oauth|jwt|session|sessions)\b/i },
  { domain: "login", pattern: /\b(log-?in|log-?out|signin|sign-in|signout|sign-out|credentials?)\b/i },
  { domain: "cache", pattern: /\b(cache|caches|cached|caching|cacheable)\b/i },
  { domain: "redis", pattern: /\b(redis|ioredis|redis-cli)\b/i },
  { domain: "database", pattern: /\b(database|db|schema|schemas|migration|migrations|sql|query|queries|orm)\b/i },
  { domain: "postgres", pattern: /\b(postgres|postgresql|pg|psql)\b/i },
  { domain: "workflow", pattern: /\b(workflow|workflows|ci|pipeline|pipelines|job|jobs)\b/i },
  { domain: "github-actions", pattern: /\b(github action|github actions|actionlint|\.github\/workflows)\b/i },
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

function commandsByType(commands: ImpactCommand[], type: ImpactCommand["type"]): ImpactCommand[] {
  return commands.filter((command) => command.type === type);
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

function commandWithPaths(command: string, paths: string[]): string {
  return paths.length > 0 ? `${command} ${paths.join(" ")}` : command;
}

function domainMatches(impact: ImpactAnalysis): DomainMatch[] {
  const task = impact.task;
  const affectedPaths = allAffectedPaths(impact);
  const contextPaths = impact.contextChanges.map((file) => file.path);

  return domainDefinitions.flatMap((definition) => {
    const signals: string[] = [];
    const paths = new Set<string>();

    if (definition.pattern.test(task)) {
      signals.push("task");
    }

    const affectedFileMatches = impact.affectedFiles
      .map((file) => file.path)
      .filter((filePath) => definition.pattern.test(filePath));

    if (affectedFileMatches.length > 0) {
      signals.push("affected files");
      affectedFileMatches.forEach((filePath) => paths.add(filePath));
    }

    const testMatches = impact.affectedTests
      .map((test) => test.path)
      .filter((filePath) => definition.pattern.test(filePath));

    if (testMatches.length > 0) {
      signals.push("test paths");
      testMatches.forEach((filePath) => paths.add(filePath));
    }

    if (definition.domain === "context") {
      const contextMatches = contextPaths.filter((filePath) => definition.pattern.test(filePath));

      if (contextMatches.length > 0) {
        signals.push("context changes");
        contextMatches.forEach((filePath) => paths.add(filePath));
      }
    }

    if (definition.domain === "github-actions") {
      const workflowPaths = affectedPaths.filter((filePath) => /^\.github\/workflows\//i.test(filePath));

      if (workflowPaths.length > 0) {
        signals.push("affected files");
        workflowPaths.forEach((filePath) => paths.add(filePath));
      }
    }

    if (signals.length === 0) {
      return [];
    }

    if (paths.size === 0) {
      affectedPaths.forEach((filePath) => paths.add(filePath));
    }

    return [{
      domain: definition.domain,
      paths: [...paths],
      signals: [...new Set(signals)]
    }];
  });
}

function hasDomain(matches: DomainMatch[], domain: VerificationDomain): boolean {
  return matches.some((match) => match.domain === domain);
}

function pathsForDomains(matches: DomainMatch[], domains: VerificationDomain[], fallback: string[]): string[] {
  const paths = matches
    .filter((match) => domains.includes(match.domain))
    .flatMap((match) => match.paths);
  const unique = [...new Set(paths)];

  return unique.length > 0 ? unique : fallback;
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
    checks.push(smokeCheck(
      "auth-flow",
      "Manually check the login/logout flow for the matched auth or login surface.",
      pathsForDomains(matches, ["auth", "login"], fallback)
    ));
  }

  if (hasDomain(matches, "cache") || hasDomain(matches, "redis")) {
    checks.push(smokeCheck(
      "cache-behavior",
      "Manually check cache miss and cache hit behavior for the matched cache surface.",
      pathsForDomains(matches, ["cache", "redis"], fallback)
    ));
  }

  if (hasDomain(matches, "workflow") || hasDomain(matches, "github-actions")) {
    checks.push(smokeCheck(
      "ci-workflow",
      "Manually review the relevant workflow path and confirm its trigger/job intent.",
      pathsForDomains(matches, ["workflow", "github-actions"], fallback)
    ));
  }

  if (hasDomain(matches, "database") || hasDomain(matches, "postgres")) {
    checks.push(smokeCheck(
      "database-behavior",
      "Manually check the affected database path with representative existing and new data.",
      pathsForDomains(matches, ["database", "postgres"], fallback)
    ));
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
  const workflowPaths = pathsForDomains(matches, ["workflow", "github-actions"], fallback);
  const yamlWorkflowPaths = yamlPaths(workflowPaths);

  if (hasDomain(matches, "auth") || hasDomain(matches, "login")) {
    const paths = pathsForDomains(matches, ["auth", "login"], fallback);

    checks.push(manualHint("invalid-credentials", "Check invalid credentials, logout, and session expiration behavior.", paths));
  }

  if (hasDomain(matches, "cache") || hasDomain(matches, "redis")) {
    const paths = pathsForDomains(matches, ["cache", "redis"], fallback);

    checks.push(manualHint("cache-hit-miss", "Check cache miss, cache hit, and cache invalidation behavior.", paths));
    checks.push(manualHint("cache-fallback", "Check fallback behavior when Redis or the cache backend is unavailable.", paths));
  }

  if (hasDomain(matches, "workflow") || hasDomain(matches, "github-actions")) {
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

  if (hasDomain(matches, "database") || hasDomain(matches, "postgres")) {
    const paths = pathsForDomains(matches, ["database", "postgres"], fallback);

    checks.push(manualHint("schema-compatibility", "Check migration and schema compatibility for existing deployments.", paths));
    checks.push(manualHint("data-rollback-impact", "Check rollback behavior and existing data impact.", paths));
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

  checklist.push("Record verification with `rcc done` only if the context change is meaningful.");

  return checklist;
}

function validationChecklistFromImpact(impact: ImpactAnalysis): string[] {
  if (isContextOnlyVerification(impact)) {
    return contextOnlyValidationChecklist(impact);
  }

  const checklist = ["Inspect affected files."];

  if (impact.affectedTests.length > 0) {
    checklist.push("Run targeted tests.");
  } else {
    checklist.push("No strongly related tests were found; do not add generic tests.");
  }

  if (impact.suggestedCommands.some((command) => command.type === "build")) {
    checklist.push("Run build command.");
  }

  if (smokeChecksFromImpact(impact).length > 0) {
    checklist.push("Perform smoke checks.");
  }

  if (impact.contextChanges.length > 0) {
    checklist.push("Confirm RCC context changes are intentional.");
  }

  checklist.push("Record verification with `rcc done`.");

  return checklist;
}

function notesFromImpact(impact: ImpactAnalysis): string[] {
  const notes = [...impact.notes];
  const docsOnly = impact.affectedFiles.length > 0 && impact.affectedFiles.every((file) => isDocsPath(file.path));
  const contextOnlyNote = "Context-only changes detected; verify focuses on RCC/context files and does not promote task-route estimates to targeted tests or smoke checks.";

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
  return {
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
  };
}

export function createVerificationPlanFromImpact(impact: ImpactAnalysis): VerificationPlan {
  const affectedFilePaths = impact.affectedFiles.map((file) => file.path);
  const contextChangePaths = impact.contextChanges.map((file) => file.path);
  const contextOnly = isContextOnlyVerification(impact);

  if (contextOnly) {
    return createVerificationPlan({
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
      validationChecklist: validationChecklistFromImpact(impact),
      confidence: "medium",
      confidenceExplanation: confidenceExplanationWithDomains(impact, confidenceExplanationForVerify(impact)),
      notes: notesFromImpact(impact)
    });
  }

  const targetedTestCommands = impact.affectedTests.length > 0
    ? commandsByType(impact.suggestedCommands, "test")
    : [];

  return createVerificationPlan({
    task: impact.task,
    mode: impact.mode,
    summary: impact.summary,
    targetedTests: impact.affectedTests,
    targetedTestCommands,
    buildCommands: commandsByType(impact.suggestedCommands, "build"),
    smokeChecks: smokeChecksFromImpact(impact),
    manualChecks: [
      ...impact.verificationHints,
      ...domainManualChecks(impact),
      ...compactChecks([
        manualCheck("affected-files", "Manually inspect affected files for behavior-specific validation.", affectedFilePaths),
        manualCheck("context-changes", "Manually review context changes for workflow and routing impact.", contextChangePaths)
      ])
    ],
    validationChecklist: validationChecklistFromImpact(impact),
    confidence: impact.confidence,
    confidenceExplanation: confidenceExplanationWithDomains(impact, impact.confidenceExplanation),
    notes: notesFromImpact(impact)
  });
}

export function createPlannedVerificationPlanFromImpact(impact: ImpactAnalysis): VerificationPlan {
  const plannedImpact: ImpactAnalysis = {
    ...impact,
    mode: "planned-task"
  };
  const affectedFilePaths = plannedImpact.affectedFiles.map((file) => file.path);
  const contextChangePaths = plannedImpact.contextChanges.map((file) => file.path);
  const targetedTestCommands = plannedImpact.affectedTests.length > 0
    ? commandsByType(plannedImpact.suggestedCommands, "test")
    : [];
  const notes = notesFromImpact(plannedImpact).filter((note) => (
    note !== "Context-only changes detected; verify focuses on RCC/context files and does not promote task-route estimates to targeted tests or smoke checks."
  ));
  const plannedNote = "Planned verification mode: promoted task-route estimates even though no non-context changed files were present.";

  if (plannedImpact.confidenceExplanation.evidence.nonContextChangedFiles === 0 && !notes.includes(plannedNote)) {
    notes.push(plannedNote);
  }

  return createVerificationPlan({
    task: plannedImpact.task,
    mode: plannedImpact.mode,
    summary: plannedImpact.summary,
    targetedTests: plannedImpact.affectedTests,
    targetedTestCommands,
    buildCommands: commandsByType(plannedImpact.suggestedCommands, "build"),
    smokeChecks: smokeChecksFromImpact(plannedImpact),
    manualChecks: [
      ...plannedImpact.verificationHints,
      ...domainManualChecks(plannedImpact),
      ...compactChecks([
        manualCheck("affected-files", "Manually inspect planned affected files for behavior-specific validation.", affectedFilePaths),
        manualCheck("context-changes", "Manually review context changes for workflow and routing impact.", contextChangePaths)
      ])
    ],
    validationChecklist: validationChecklistFromImpact(plannedImpact),
    confidence: plannedImpact.confidence,
    confidenceExplanation: confidenceExplanationWithDomains(plannedImpact, plannedImpact.confidenceExplanation),
    notes
  });
}

export async function buildVerificationPlan(
  cwd: string,
  task: string,
  options: { planned?: boolean; taskOnly?: boolean } = {}
): Promise<VerificationPlan> {
  const impact = await buildImpactAnalysis(cwd, task, {
    taskOnly: options.taskOnly ?? false
  });

  if (options.planned) {
    return createPlannedVerificationPlanFromImpact(impact);
  }

  return createVerificationPlanFromImpact(impact);
}
