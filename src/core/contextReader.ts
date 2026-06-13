import path from "node:path";
import { pathExists, readTextFile } from "./fileSystem";

export const suggestContextFiles = [
  "docs/ai-context/TASK_ROUTING.md",
  "docs/ai-context/MODULE_INDEX.md",
  "docs/ai-context/DEPENDENCY_MAP.md",
  "docs/ai-context/RISK_REGISTER.md",
  "docs/ai-context/HOTSPOTS.md"
] as const;

export type SuggestContextFile = (typeof suggestContextFiles)[number];

export interface ContextDocument {
  path: SuggestContextFile;
  content: string;
}

export async function readSuggestContext(cwd: string): Promise<ContextDocument[]> {
  const documents: ContextDocument[] = [];

  for (const file of suggestContextFiles) {
    const fullPath = path.join(cwd, file);
    if (await pathExists(fullPath)) {
      documents.push({
        path: file,
        content: await readTextFile(fullPath)
      });
    }
  }

  return documents;
}
