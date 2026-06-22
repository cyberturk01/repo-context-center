import type { CompactAgentHandoff, HandoffBrief } from "./handoffTypes";

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

export function toAgentHandoff(brief: HandoffBrief): CompactAgentHandoff {
  const agentHandoff: CompactAgentHandoff = {
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
    agentHandoff.writtenPath = brief.writtenPath;
  }

  if (brief.repositoryLearning && brief.repositoryLearning.length > 0) {
    agentHandoff.repositoryLearning = normalizeTextItems(brief.repositoryLearning).slice(0, 2);
  }

  if (brief.lastSummary) {
    agentHandoff.lastSummary = brief.lastSummary;
  }
  if (brief.filesTouched) {
    agentHandoff.filesTouched = brief.filesTouched;
  }
  if (brief.verification) {
    agentHandoff.verification = brief.verification;
  }
  if (brief.followUps) {
    agentHandoff.followUps = brief.followUps;
  }
  if (brief.risks) {
    agentHandoff.risks = brief.risks;
  }

  return agentHandoff;
}

export function renderHandoffAgent(brief: HandoffBrief): string {
  return `${JSON.stringify(toAgentHandoff(brief))}\n`;
}
