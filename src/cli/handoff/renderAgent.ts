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
    return {
      ...agentHandoff,
      writtenPath: brief.writtenPath
    };
  }

  return agentHandoff;
}

export function renderHandoffAgent(brief: HandoffBrief): string {
  return `${JSON.stringify(toAgentHandoff(brief))}\n`;
}
