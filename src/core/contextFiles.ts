import { genericTemplateFiles } from "../templates/generic";

export const requiredContextFiles = genericTemplateFiles;
export type RequiredContextFile = (typeof requiredContextFiles)[number];

export const contextArchiveDir = "docs/ai-context/archive";

export const contextSizeLimits: Partial<Record<RequiredContextFile, number>> = {
  "docs/ai-context/CHANGE_LOG.md": 32 * 1024,
  "docs/ai-context/TASK_ROUTING.md": 16 * 1024
};
