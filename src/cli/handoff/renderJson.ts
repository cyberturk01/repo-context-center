import type { HandoffBrief, PublicHandoffBrief } from "./handoffTypes";

export function toPublicHandoffBrief(brief: HandoffBrief): PublicHandoffBrief {
  return {
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
}

export function renderHandoffJson(brief: HandoffBrief, debug = false): string {
  return `${JSON.stringify(debug ? brief : toPublicHandoffBrief(brief), null, 2)}\n`;
}
