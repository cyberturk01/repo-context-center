import type { ImpactAffectedTest, ImpactCommand, ImpactVerificationHint } from "../impact/impactTypes";
import type { VerificationExecutionStep, VerificationPlan } from "./verifyTypes";

function formatTests(tests: ImpactAffectedTest[]): string[] {
  if (tests.length === 0) {
    return ["- none"];
  }

  return tests.map((test) => {
    const priority = "priority" in test ? ` [${test.priority}]` : "";

    return `- ${test.path}${priority} (${test.reason})`;
  });
}

function formatCommands(commands: ImpactCommand[]): string[] {
  if (commands.length === 0) {
    return ["- none"];
  }

  return commands.map((command) => {
    const priority = "priority" in command ? ` [${command.priority}]` : "";

    return `- ${command.command}${priority} (${command.reason})`;
  });
}

function formatManualChecks(checks: ImpactVerificationHint[]): string[] {
  if (checks.length === 0) {
    return ["- none"];
  }

  return checks.map((check) => {
    const paths = check.paths && check.paths.length > 0 ? ` [${check.paths.join(", ")}]` : "";
    const command = check.command ? `: ${check.command}` : "";

    const priority = "priority" in check ? ` [${check.priority}]` : "";

    return `- ${check.type}${priority}: ${check.reason}${paths}${command}`;
  });
}

function formatExecutionPlan(steps: VerificationExecutionStep[]): string[] {
  if (steps.length === 0) {
    return ["- none"];
  }

  return steps.map((step, index) => {
    const command = step.command ? `: ${step.command}` : "";
    const paths = step.paths && step.paths.length > 0 ? ` [${step.paths.join(", ")}]` : "";
    const refs = step.refs && step.refs.length > 0 ? ` (see ${step.refs.join(", ")})` : "";

    return `${index + 1}. ${step.title} [${step.priority}, ~${step.estimatedMinutes}m]${refs}${paths}${command}`;
  });
}

function formatNotes(notes: string[]): string[] {
  if (notes.length === 0) {
    return ["- none"];
  }

  return notes.map((note) => `- ${note}`);
}

function formatChecklist(checklist: string[]): string[] {
  if (checklist.length === 0) {
    return ["- none"];
  }

  return checklist.map((item) => `- ${item}`);
}

export function renderVerifyText(plan: VerificationPlan): string {
  return `${[
    "repo-context-center verify",
    "",
    `Task: ${plan.task}`,
    `Mode: ${plan.mode}`,
    `Confidence: ${plan.confidence}`,
    "",
    "Targeted tests:",
    ...formatTests(plan.targetedTests),
    "",
    "Targeted test commands:",
    ...formatCommands(plan.targetedTestCommands),
    "",
    "Build commands:",
    ...formatCommands(plan.buildCommands),
    "",
    "Smoke checks:",
    ...formatManualChecks(plan.smokeChecks),
    "",
    "Manual checks:",
    ...formatManualChecks(plan.manualChecks),
    "",
    "Execution plan:",
    ...formatExecutionPlan(plan.executionPlan),
    "",
    "Validation checklist:",
    ...formatChecklist(plan.validationChecklist),
    "",
    "Notes:",
    ...formatNotes(plan.notes)
  ].join("\n")}\n`;
}

export function renderVerifyJson(plan: VerificationPlan): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}
