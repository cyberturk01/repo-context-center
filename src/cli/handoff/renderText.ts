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

function fileItems(items: Array<{ path: string; reason?: string }>): string[] {
  if (items.length === 0) {
    return ["- none"];
  }

  return items.map((item) => item.reason ? `- ${item.path} (${item.reason})` : `- ${item.path}`);
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
    "Next recommended files:",
    ...fileItems(brief.nextRecommendedFiles),
    "",
    "Relevant tests:",
    ...fileItems(brief.relevantTests),
    "",
    "Relevant decisions:",
    ...bulletItems(brief.relevantDecisions),
    "",
    "Next actions:",
    ...numberedItems(brief.nextActions),
    "",
    "Avoid:",
    ...bulletItems(brief.avoid),
    "",
    `Next lookup: ${brief.nextLookup}`,
    `Next command: ${brief.nextCommand}`
  ];

  return `${lines.join("\n")}\n`;
}
