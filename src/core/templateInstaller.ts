import path from "node:path";
import { ensureDir, pathExists, readTextFile, writeTextFile } from "./fileSystem";
import { readGenericTemplates } from "../templates/generic";

export interface TemplateInstallOptions {
  cwd: string;
  force?: boolean;
  dryRun?: boolean;
  githubAction?: boolean;
}

export type TemplateInstallAction = "create" | "overwrite" | "skip";

export interface TemplateInstallResult {
  path: string;
  action: TemplateInstallAction;
  type: "file" | "directory";
  preview?: string;
}

const archiveDir = "docs/ai-context/archive";
export const githubWorkflowPath = ".github/workflows/repo-context-check.yml";

function getGitHubWorkflowTemplatePath(): string {
  return path.join(__dirname, "..", "templates", "github", "context-check.yml");
}

async function installGitHubWorkflow(options: TemplateInstallOptions): Promise<TemplateInstallResult> {
  const targetPath = path.join(options.cwd, githubWorkflowPath);
  const exists = await pathExists(targetPath);
  const action = exists ? (options.force ? "overwrite" : "skip") : "create";

  if (!options.dryRun && action !== "skip") {
    const content = await readTextFile(getGitHubWorkflowTemplatePath());
    await writeTextFile(targetPath, content);
  }

  return { path: githubWorkflowPath, action, type: "file" };
}

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

    const preview = options.dryRun && template.path === "AGENTS.md" ? template.content : undefined;
    results.push({ path: template.path, action, type: "file", preview });
  }

  const archivePath = path.join(options.cwd, archiveDir);
  const archiveExists = await pathExists(archivePath);
  const archiveAction = archiveExists ? "skip" : "create";

  if (!options.dryRun && archiveAction === "create") {
    await ensureDir(archivePath);
  }

  results.push({ path: archiveDir, action: archiveAction, type: "directory" });

  if (options.githubAction) {
    results.push(await installGitHubWorkflow(options));
  }

  return results;
}
