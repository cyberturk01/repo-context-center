import type { HandoffBrief } from "./handoffTypes";

export function renderHandoffText(brief: HandoffBrief): string {
  const lines = [
    "repo-context-center handoff",
    "",
    `Task: ${brief.task ?? "(none)"}`,
    `Generated: ${brief.generatedAt}`,
    "",
    "Current state:",
    ...brief.currentState.map((item) => `- ${item}`),
    "",
    `Next command: ${brief.nextCommand}`
  ];

  return `${lines.join("\n")}\n`;
}
