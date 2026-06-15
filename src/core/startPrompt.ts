import type { StartupContext } from "./suggester";

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- none";
}

export function formatStartupPrompt(startupContext: StartupContext): string {
  return `${[
    "Before starting this task, use Repository Context Center.",
    "",
    "Task:",
    startupContext.task,
    "",
    "Read first:",
    formatList(startupContext.readFirstDocs),
    "",
    "Likely source files:",
    formatList(startupContext.likelySourceFiles),
    "",
    "Likely tests:",
    formatList(startupContext.likelyTests),
    "",
    "Risk:",
    startupContext.riskLevel,
    "",
    "Instructions:",
    formatList(startupContext.startupInstructions)
  ].join("\n")}\n`;
}
