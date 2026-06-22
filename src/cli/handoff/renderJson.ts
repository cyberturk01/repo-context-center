import type { HandoffBrief, PublicHandoffBrief } from "./handoffTypes";

function normalizeHandoffText(value: string): string {
  return value
    .replace(/\bWorkingtree\b/gi, "Working tree")
    .replace(/\bareinsufficient\b/gi, "are insufficient")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextItems(items: string[]): string[] {
  return items.map(normalizeHandoffText);
}

export function toPublicHandoffBrief(brief: HandoffBrief): PublicHandoffBrief {
  const publicBrief: PublicHandoffBrief = {
    schemaVersion: brief.schemaVersion,
    command: brief.command,
    task: brief.task,
    generatedAt: brief.generatedAt,
    currentState: normalizeTextItems(brief.currentState),
    memory: normalizeTextItems(brief.memory),
    readFirst: brief.readFirst,
    nextRecommendedFiles: brief.nextRecommendedFiles,
    relevantTests: brief.relevantTests,
    relevantDecisions: normalizeTextItems(brief.relevantDecisions),
    nextActions: normalizeTextItems(brief.nextActions),
    avoid: normalizeTextItems(brief.avoid),
    nextLookup: brief.nextLookup,
    nextCommand: brief.nextCommand
  };

  if (brief.writtenPath) {
    publicBrief.writtenPath = brief.writtenPath;
  }

  if (brief.repositoryLearning && brief.repositoryLearning.length > 0) {
    publicBrief.repositoryLearning = normalizeTextItems(brief.repositoryLearning);
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
