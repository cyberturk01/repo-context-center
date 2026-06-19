import type { CompactAgentHandoff, HandoffBrief } from "./handoffTypes";

export function toAgentHandoff(brief: HandoffBrief): CompactAgentHandoff {
  return {
    schemaVersion: brief.schemaVersion,
    command: brief.command,
    task: brief.task,
    generatedAt: brief.generatedAt,
    currentState: brief.currentState,
    memory: brief.memory,
    readFirst: brief.readFirst,
    nextActions: brief.nextActions,
    avoid: brief.avoid,
    nextCommand: brief.nextCommand
  };
}

export function renderHandoffAgent(brief: HandoffBrief): string {
  return `${JSON.stringify(toAgentHandoff(brief))}\n`;
}
