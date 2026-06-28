import type { VerifyFile, VerifyReport, VerifyTest } from "./verifyTypes";

function formatFiles(files: VerifyFile[]): string[] {
  if (files.length === 0) {
    return ["- none"];
  }

  return files.map((file) => `- ${file.path} (${file.reason})`);
}

function formatTests(tests: VerifyTest[]): string[] {
  if (tests.length === 0) {
    return ["- none"];
  }

  return tests.map((test) => `- ${test.path} (${test.reason})`);
}

function formatCommands(report: VerifyReport): string[] {
  if (report.verification.commands.length === 0) {
    return ["- none"];
  }

  return report.verification.commands.map((item) => `- ${item.command} (${item.reason})`);
}

function formatHints(report: VerifyReport): string[] {
  if (report.verification.hints.length === 0) {
    return ["- none"];
  }

  return report.verification.hints.map((item) => `- ${item.type}: ${item.reason}`);
}

export function renderVerifyText(report: VerifyReport): string {
  return `${[
    "repo-context-center verify",
    "",
    `Task: ${report.task}`,
    `Mode: ${report.mode}`,
    `Confidence: ${report.confidence.level}`,
    "Confidence evidence:",
    ...report.confidence.reasons.map((reason) => `- ${reason}`),
    "",
    "Primary files:",
    ...formatFiles(report.primaryFiles),
    "",
    "Affected files:",
    ...formatFiles(report.affectedFiles),
    "",
    "Test candidates:",
    ...formatTests(report.testCandidates),
    "",
    "Verification commands:",
    ...formatCommands(report),
    "",
    "Verification hints:",
    ...formatHints(report),
    "",
    "Notes:",
    ...report.notes.map((note) => `- ${note}`)
  ].join("\n")}\n`;
}

export function renderVerifyJson(report: VerifyReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
