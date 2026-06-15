import type { StartupContext } from "./suggester";

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- none";
}

function formatRecommendedFiles(values: string[], reasonsByFile: Record<string, string[]>, emptyReason?: string): string {
  if (values.length === 0) {
    if (!emptyReason) {
      return "- none";
    }

    if (emptyReason.includes(": - ")) {
      return `- none\n${emptyReason.replace(": - ", ":\n- ")}`;
    }

    return `- none\n${emptyReason}`;
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
    formatRecommendedFiles(
      startupContext.likelySourceFiles,
      startupContext.recommendationReasons,
      startupContext.emptyRecommendationReasons?.source
        ? `No source file reason: ${startupContext.emptyRecommendationReasons.source}`
        : undefined
    ),
    "",
    "Likely tests:",
    formatRecommendedFiles(
      startupContext.likelyTests,
      startupContext.recommendationReasons,
      startupContext.emptyRecommendationReasons?.test
        ? `No test reason: ${startupContext.emptyRecommendationReasons.test}`
        : undefined
    ),
    "",
    "Risk:",
    startupContext.riskLevel,
    "",
    "Instructions:",
    formatList(startupContext.startupInstructions)
  ].join("\n")}\n`;
}
