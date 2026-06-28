import type { ImpactAnalysis, ImpactCommand, ImpactVerificationHint } from "../impact/impactTypes";
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
    smokeChecks: commandsByType(impact.suggestedCommands, "verification"),
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
