import type { HandoffBrief } from "./handoffTypes";

function bulletItems(items: string[]): string[] {
  if (items.length === 0) {
    return ["- none"];
  }

  return items.map((item) => `- ${item}`);
}

function numberedItems(items: string[]): string[] {
  if (items.length === 0) {
    return ["1. none"];
  }

  return items.map((item, index) => `${index + 1}. ${item}`);
}

export function renderHandoffText(brief: HandoffBrief): string {
  const lines = [
    "repo-context-center handoff brief",
    "",
    "Task:",
    brief.task ?? "none",
    "",
    "Current state:",
    ...bulletItems(brief.currentState),
    "",
    "Memory:",
    ...bulletItems(brief.memory),
    "",
    "Read first:",
    ...bulletItems(brief.readFirst),
    "",
    "Next actions:",
    ...numberedItems(brief.nextActions),
    "",
    "Avoid:",
    ...bulletItems(brief.avoid)
  ];

  return `${lines.join("\n")}\n`;
}
