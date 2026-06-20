import { renderRepositoryLearningBody } from "../../core/renderRepositoryLearning";
import type { RepositoryLearningModel } from "../../core/repositoryLearning";
import type { LearnDebugInfo } from "./buildLearnResult";

export function renderLearnJson(model: RepositoryLearningModel): string {
  return `${JSON.stringify(model, null, 2)}\n`;
}

export function renderLearnText(model: RepositoryLearningModel): string {
  return `${renderRepositoryLearningBody(model)}\n`;
}

export function renderLearnDebug(debug: LearnDebugInfo): string {
  return [
    "",
    "## Debug",
    "",
    "Source counts:",
    `- work log entries: ${debug.sourceCounts.workLogEntries}`,
    `- work index lines: ${debug.sourceCounts.workIndexLines}`,
    `- decisions lines: ${debug.sourceCounts.decisions}`,
    "",
    "Ignored entries:",
    ...(debug.ignoredEntries.length > 0 ? debug.ignoredEntries.map((entry) => `- ${entry}`) : ["- none"])
  ].join("\n");
}
