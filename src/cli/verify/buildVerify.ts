import type { ImpactAnalysis, ImpactCommand, ImpactVerificationHint } from "../impact/impactTypes";
import { buildImpactAnalysis } from "../impact/buildImpact";
import type { VerificationPlan, VerificationPlanInput } from "./verifyTypes";

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

function commandsByType(commands: ImpactCommand[], type: ImpactCommand["type"]): ImpactCommand[] {
  return commands.filter((command) => command.type === type);
}

function textMatches(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

function impactText(impact: ImpactAnalysis): string {
  return [
    impact.task,
    ...impact.affectedFiles.map((file) => file.path),
    ...impact.contextChanges.map((file) => file.path)
  ].join(" ");
}

function matchingPaths(impact: ImpactAnalysis, pattern: RegExp): string[] {
  return [
    ...impact.affectedFiles,
    ...impact.contextChanges
  ].map((file) => file.path).filter((filePath) => pattern.test(filePath));
}

function fallbackPaths(impact: ImpactAnalysis): string[] {
  return [
    ...impact.affectedFiles,
    ...impact.contextChanges
  ].map((file) => file.path);
}

function smokeCheck(type: string, reason: string, paths: string[]): ImpactVerificationHint {
  return paths.length > 0 ? { type, reason, paths } : { type, reason };
}

function smokeChecksFromImpact(impact: ImpactAnalysis): ImpactVerificationHint[] {
  const checks: ImpactVerificationHint[] = [];
  const text = impactText(impact).toLowerCase();
  const docsOnly = impact.affectedFiles.length > 0 && impact.affectedFiles.every((file) => isDocsPath(file.path));

  if (textMatches(text, /\b(auth|login|sign-?in|session)\b/)) {
    checks.push(smokeCheck(
      "auth-flow",
      "Manually check the affected login/auth flow at the changed entry point.",
      matchingPaths(impact, /\b(auth|login|session|signin|sign-in)\b/i)
    ));
  }

  if (textMatches(text, /\b(workflow|ci|github action|github actions|action)\b/) || matchingPaths(impact, /^\.github\/workflows\//i).length > 0) {
    const workflowPaths = matchingPaths(impact, /^\.github\/workflows\//i);

    checks.push(smokeCheck(
      "ci-workflow",
      "Manually review the relevant GitHub Action or CI workflow path and confirm its trigger/job intent.",
      workflowPaths.length > 0 ? workflowPaths : fallbackPaths(impact)
    ));
  }

  if (textMatches(text, /\b(translation|translate|i18n|locale|localization|copy)\b/)) {
    checks.push(smokeCheck(
      "ui-text",
      "Manually check the affected UI text or location where the translation appears.",
      matchingPaths(impact, /\b(i18n|locale|translation|translations|copy|ui)\b/i)
    ));
  }

  if (textMatches(text, /\b(redis|cache|caching|cached)\b/)) {
    checks.push(smokeCheck(
      "cache-behavior",
      "Manually check cache behavior and fallback behavior for the affected path.",
      matchingPaths(impact, /\b(redis|cache|caching|cached)\b/i)
    ));
  }

  if (docsOnly) {
    checks.push(smokeCheck(
      "docs-rendering",
      "Review rendered Markdown or published docs for formatting, links, and expected wording.",
      impact.affectedFiles.map((file) => file.path)
    ));
  }

  return checks;
}

function validationChecklistFromImpact(impact: ImpactAnalysis): string[] {
  const checklist: string[] = [];

  if (impact.affectedTests.length > 0) {
    checklist.push("Run targeted tests from Impact affectedTests.");
  }

  if (impact.suggestedCommands.some((command) => command.type === "build")) {
    checklist.push("Run build commands from Impact suggestedCommands.");
  }

  if (impact.affectedFiles.length > 0) {
    checklist.push("Review affected files for behavior-specific manual checks.");
  }

  if (impact.contextChanges.length > 0) {
    checklist.push("Review context changes for workflow or routing drift.");
  }

  return checklist;
}

function notesFromImpact(impact: ImpactAnalysis): string[] {
  const notes = [...impact.notes];
  const docsOnly = impact.affectedFiles.length > 0 && impact.affectedFiles.every((file) => isDocsPath(file.path));

  if (docsOnly && !notes.includes("Docs-only impact detected; verify documentation changes manually.")) {
    notes.push("Docs-only impact detected; verify documentation changes manually.");
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
      ...compactChecks([
        manualCheck("affected-files", "Manually inspect affected files for behavior-specific validation.", affectedFilePaths),
        manualCheck("context-changes", "Manually review context changes for workflow and routing impact.", contextChangePaths)
      ])
    ],
    validationChecklist: validationChecklistFromImpact(impact),
    confidence: impact.confidence,
    confidenceExplanation: impact.confidenceExplanation,
    notes: notesFromImpact(impact)
  });
}

export async function buildVerificationPlan(
  cwd: string,
  task: string,
  options: { taskOnly?: boolean } = {}
): Promise<VerificationPlan> {
  const impact = await buildImpactAnalysis(cwd, task, {
    taskOnly: options.taskOnly ?? false
  });

  return createVerificationPlanFromImpact(impact);
}
