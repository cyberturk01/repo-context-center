import type { HandoffBrief } from "./handoffTypes";

export function toAgentHandoff(brief: HandoffBrief): Record<string, unknown> {
  return {
    task: brief.task,
    status: brief.status,
    summary: brief.summary,
    next: "Use this placeholder handoff structure until full handoff assembly is implemented."
  };
}

export function renderHandoffAgent(brief: HandoffBrief): string {
  return `${JSON.stringify(toAgentHandoff(brief))}\n`;
}
