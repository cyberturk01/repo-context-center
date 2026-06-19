import type { CompactAgentHandoff, HandoffBrief } from "./handoffTypes";

export function toAgentHandoff(brief: HandoffBrief): CompactAgentHandoff {
  const agentHandoff: CompactAgentHandoff = {
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
    agentHandoff.writtenPath = brief.writtenPath;
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
