import path from "node:path";
import { ensureDir, pathExists, readTextFile, writeTextFile } from "./fileSystem";
import { readGenericTemplates } from "../templates/generic";

export interface TemplateInstallOptions {
  cwd: string;
  force?: boolean;
  dryRun?: boolean;
  githubAction?: boolean;
}

export type TemplateInstallAction = "create" | "overwrite" | "skip" | "update";

export interface TemplateInstallResult {
  path: string;
  action: TemplateInstallAction;
  type: "file" | "directory";
  preview?: string;
}

const archiveDir = "docs/ai-context/archive";
export const githubWorkflowPath = ".github/workflows/repo-context-check.yml";
const agentsPath = "AGENTS.md";
const workflowStart = "<!-- repo-context-center:workflow:start -->";
const workflowEnd = "<!-- repo-context-center:workflow:end -->";

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

function extractWorkflowSection(content: string): string {
  const start = content.indexOf(workflowStart);
  const end = content.indexOf(workflowEnd);

  if (start === -1 || end === -1 || end <= start) {
    return "";
  }

  return content.slice(start, end + workflowEnd.length).trim();
}

export function upsertAgentsWorkflowSection(existing: string, templateContent: string): string {
  const workflowSection = extractWorkflowSection(templateContent);
  const normalizedExisting = existing.replace(/\r\n/g, "\n").replace(/\n*$/u, "\n");

  if (!workflowSection) {
    return normalizedExisting;
  }

  const start = normalizedExisting.indexOf(workflowStart);
  const end = normalizedExisting.indexOf(workflowEnd);

  if (start !== -1 && end !== -1 && end > start) {
    return `${normalizedExisting.slice(0, start).trimEnd()}\n\n${workflowSection}\n\n${normalizedExisting.slice(end + workflowEnd.length).trimStart()}`.trimEnd() + "\n";
  }

  return `${normalizedExisting.trimEnd()}\n\n${workflowSection}\n`;
}

async function installAgentsTemplate(
  options: TemplateInstallOptions,
  templateContent: string
): Promise<TemplateInstallResult> {
  const targetPath = path.join(options.cwd, agentsPath);
  const exists = await pathExists(targetPath);

  if (!exists) {
    if (!options.dryRun) {
      await writeTextFile(targetPath, templateContent);
    }

    const preview = options.dryRun ? templateContent : undefined;
    return { path: agentsPath, action: "create", type: "file", preview };
  }

  const existing = await readTextFile(targetPath);
  const nextContent = upsertAgentsWorkflowSection(existing, templateContent);
  const action: TemplateInstallAction = nextContent === existing ? "skip" : "update";

  if (!options.dryRun && action === "update") {
    await writeTextFile(targetPath, nextContent);
  }

  const preview = options.dryRun && action === "update" ? nextContent : undefined;
  return { path: agentsPath, action, type: "file", preview };
}

export async function installGenericTemplates(
  options: TemplateInstallOptions
): Promise<TemplateInstallResult[]> {
  const results: TemplateInstallResult[] = [];
  const templates = await readGenericTemplates();

  for (const template of templates) {
    if (template.path === agentsPath) {
      results.push(await installAgentsTemplate(options, template.content));
      continue;
    }

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

  if (options.githubAction) {
    results.push(await installGitHubWorkflow(options));
  }

  return results;
}
