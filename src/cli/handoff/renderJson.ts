import type { HandoffBrief, PublicHandoffBrief } from "./handoffTypes";

export function toPublicHandoffBrief(brief: HandoffBrief): PublicHandoffBrief {
  const publicBrief: PublicHandoffBrief = {
    schemaVersion: brief.schemaVersion,
    command: brief.command,
    task: brief.task,
    generatedAt: brief.generatedAt,
    currentState: brief.currentState,
    memory: brief.memory,
    readFirst: brief.readFirst,
    nextRecommendedFiles: brief.nextRecommendedFiles,
    relevantTests: brief.relevantTests,
    relevantDecisions: brief.relevantDecisions,
    nextActions: brief.nextActions,
    avoid: brief.avoid,
    nextLookup: brief.nextLookup,
    nextCommand: brief.nextCommand
  };

  if (brief.writtenPath) {
    publicBrief.writtenPath = brief.writtenPath;
  }

  if (brief.lastSummary) {
    publicBrief.lastSummary = brief.lastSummary;
  }
  if (brief.filesTouched) {
    publicBrief.filesTouched = brief.filesTouched;
  }
  if (brief.verification) {
    publicBrief.verification = brief.verification;
  }
  if (brief.followUps) {
    publicBrief.followUps = brief.followUps;
  }
  if (brief.risks) {
    publicBrief.risks = brief.risks;
  }

  return publicBrief;
}

export function renderHandoffJson(brief: HandoffBrief, debug = false): string {
  return `${JSON.stringify(debug ? brief : toPublicHandoffBrief(brief), null, 2)}\n`;
}
