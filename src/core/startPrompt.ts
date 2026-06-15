import type { StartupContext } from "./suggester";

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- none";
}

function formatRecommendedFiles(values: string[], reasonsByFile: Record<string, string[]>): string {
  if (values.length === 0) {
    return "- none";
  }

  return values
    .map((value) => {
      const reasons = reasonsByFile[value] ?? [];
      if (reasons.length === 0) {
        return `- ${value}`;
      }

      return [
        `- ${value}`,
        "  Reasons:",
        ...reasons.map((reason) => `  - ${reason}`)
      ].join("\n");
    })
    .join("\n");
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
    formatRecommendedFiles(startupContext.likelySourceFiles, startupContext.recommendationReasons),
    "",
    "Likely tests:",
    formatRecommendedFiles(startupContext.likelyTests, startupContext.recommendationReasons),
    "",
    "Risk:",
    startupContext.riskLevel,
    "",
    "Instructions:",
    formatList(startupContext.startupInstructions)
  ].join("\n")}\n`;
}
