import path from "node:path";
import { ensureDir, pathExists, writeTextFile } from "./fileSystem";
import { readGenericTemplates } from "../templates/generic";

export interface TemplateInstallOptions {
  cwd: string;
  force?: boolean;
  dryRun?: boolean;
}

export type TemplateInstallAction = "create" | "overwrite" | "skip";

export interface TemplateInstallResult {
  path: string;
  action: TemplateInstallAction;
  type: "file" | "directory";
}

const archiveDir = "docs/ai-context/archive";

export async function installGenericTemplates(
  options: TemplateInstallOptions
): Promise<TemplateInstallResult[]> {
  const results: TemplateInstallResult[] = [];
  const templates = await readGenericTemplates();

  for (const template of templates) {
    const targetPath = path.join(options.cwd, template.path);
    const exists = await pathExists(targetPath);
    const action = exists ? (options.force ? "overwrite" : "skip") : "create";

    if (!options.dryRun && action !== "skip") {
      await writeTextFile(targetPath, template.content);
    }

    results.push({ path: template.path, action, type: "file" });
  }

  const archivePath = path.join(options.cwd, archiveDir);
  const archiveExists = await pathExists(archivePath);
  const archiveAction = archiveExists ? "skip" : "create";

  if (!options.dryRun && archiveAction === "create") {
    await ensureDir(archivePath);
  }

  results.push({ path: archiveDir, action: archiveAction, type: "directory" });
  return results;
}
