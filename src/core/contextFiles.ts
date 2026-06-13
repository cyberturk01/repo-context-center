import { genericTemplateFiles } from "../templates/generic";

export const requiredContextFiles = genericTemplateFiles;
export type RequiredContextFile = (typeof requiredContextFiles)[number];

export const contextArchiveDir = "docs/ai-context/archive";
export const agentsFile = "AGENTS.md";
export const tokenBudgetFile = "docs/ai-context/TOKEN_BUDGET.md";
export const doNotReadFile = "docs/ai-context/DO_NOT_READ.md";

export const requiredTokenBudgetModes = ["Compact Mode", "Investigation Mode"] as const;
export const generatedFolderExclusions = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  "archive"
] as const;

export const contextSizeLimits: Partial<Record<RequiredContextFile, number>> = {
  "docs/ai-context/CHANGE_LOG.md": 32 * 1024,
  "docs/ai-context/TASK_ROUTING.md": 16 * 1024
};
