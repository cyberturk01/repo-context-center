import { readFile } from "node:fs/promises";
import path from "node:path";

export const genericTemplateFiles = [
  "AGENTS.md",
  "docs/ai-context/COMMUNICATION_MODE.md",
  "docs/ai-context/TASK_ROUTING.md",
  "docs/ai-context/MODULE_INDEX.md",
  "docs/ai-context/PROJECT_MAP.md",
  "docs/ai-context/RISK_REGISTER.md",
  "docs/ai-context/DEPENDENCY_MAP.md",
  "docs/ai-context/SYMBOL_MAP.md",
  "docs/ai-context/TOKEN_BUDGET.md",
  "docs/ai-context/DO_NOT_READ.md",
  "docs/ai-context/WORK_INDEX.md",
  "docs/ai-context/HOTSPOTS.md",
  "docs/ai-context/LESSONS_LEARNED.md",
  "docs/ai-context/CHANGE_LOG.md"
] as const;

export type GenericTemplateFile = (typeof genericTemplateFiles)[number];

export interface TemplateEntry {
  path: GenericTemplateFile;
  content: string;
}

export function getGenericTemplateRoot(): string {
  return __dirname;
}

export async function readGenericTemplate(file: GenericTemplateFile): Promise<TemplateEntry> {
  const content = await readFile(path.join(getGenericTemplateRoot(), file), "utf8");
  return { path: file, content };
}

export async function readGenericTemplates(): Promise<TemplateEntry[]> {
  return Promise.all(genericTemplateFiles.map((file) => readGenericTemplate(file)));
}
