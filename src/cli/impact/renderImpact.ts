import type { ImpactAnalysis, ImpactCommand, ImpactFile } from "./impactTypes";

function formatFiles(files: ImpactFile[]): string[] {
  if (files.length === 0) {
    return ["- none"];
  }

  return files.map((file) => `- ${file.path} (${file.reason})`);
}

function formatCommands(commands: ImpactCommand[]): string[] {
  if (commands.length === 0) {
    return ["- none"];
  }

  return commands.map((item) => `- ${item.command} (${item.reason})`);
}

function formatConfidenceEvidence(analysis: ImpactAnalysis): string[] {
  return analysis.confidenceExplanation.reasons.map((reason) => `- ${reason}`);
}

export function renderImpactText(analysis: ImpactAnalysis): string {
  return `${[
    "repo-context-center impact",
    "",
    `Task: ${analysis.task}`,
    `Mode: ${analysis.mode}`,
    `Basis: ${analysis.basis}`,
    `Confidence: ${analysis.confidence}`,
    "Confidence evidence:",
    ...formatConfidenceEvidence(analysis),
    "",
    "Changed files:",
    ...formatFiles(analysis.changedFiles),
    "",
    "Context changes:",
    ...formatFiles(analysis.contextChanges),
    "",
    "Affected files:",
    ...formatFiles(analysis.affectedFiles),
    "",
    "Affected tests:",
    ...formatFiles(analysis.affectedTests),
    "",
    "Suggested commands:",
    ...formatCommands(analysis.suggestedCommands),
    "",
    "Notes:",
    ...analysis.notes.map((note) => `- ${note}`)
  ].join("\n")}\n`;
}

export function renderImpactJson(analysis: ImpactAnalysis): string {
  return `${JSON.stringify(analysis, null, 2)}\n`;
}
