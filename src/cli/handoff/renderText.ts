import type { HandoffBrief } from "./handoffTypes";

export function renderHandoffText(brief: HandoffBrief): string {
  const lines = [
    "repo-context-center handoff",
    "",
    `Task: ${brief.task ?? "(none)"}`,
    `Status: ${brief.status}`,
    "",
    brief.summary
  ];

  return `${lines.join("\n")}\n`;
}
