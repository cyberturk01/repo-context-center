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
const generatedStart = "<!-- repo-context-center:generated:start -->";
const generatedEnd = "<!-- repo-context-center:generated:end -->";
const modernAgentsSignals = [
  "For coding tasks, first run once at task start:",
  "`rcc work \"<task>\" --agent`",
  "Inspect the returned primaryFiles, tests, and supportingFiles before reading or searching broadly.",
  "Do not repeatedly run `rcc work` for the same task.",
  "Use `rcc find \"<keyword>\"` only if the route is insufficient.",
  "Do not ask the human to run RCC commands.",
  "`rcc done --summary \"<summary>\" --files auto --verify \"<checks>\"`",
  "Read `docs/ai-context/HANDOFF.md` if present.",
  "Read `docs/ai-context/WORK_INDEX.md` if task/history context is unclear; do not read full `WORK_LOG.md` by default.",
  "Use `rcc doctor` for local/global RCC confusion.",
  "Use `rcc measure \"<task>\"` for token-saving estimates.",
  "If RCC commands are unavailable, read only `docs/ai-context/TASK_ROUTING.md` and `docs/ai-context/TOKEN_BUDGET.md`; check `docs/ai-context/DO_NOT_READ.md` before manual broad scans."
];
const legacyAgentsSignals = [
  "repo-context-center:workflow:start",
  "repo-context-center:generated:start",
  "## RCC Workflow",
  "rcc work \"<task>\"",
  "rcc find \"<keyword>\"",
  "rcc done --summary \"<summary>\"",
  "repo-context-center map --write",
  "Generated Repo Map",
  "Compact generated entrypoint.",
  "COMMUNICATION_MODE.md",
  "MODULE_INDEX.md"
];
const legacyWorkflowDuplicateLines = new Set([
  "## RCC Workflow",
  "For coding tasks, first run once:",
  "For coding tasks, first run once at task start:",
  "For any coding task, the first shell command must be:",
  "`rcc work \"<task>\"`",
  "`rcc work \"<task>\" --agent`",
  "Then:",
  "- Follow the brief before reading files or searching broadly.",
  "- Inspect the returned primaryFiles, tests, and supportingFiles before reading or searching broadly.",
  "- Use `rcc find \"<keyword>\"` for follow-up lookup.",
  "- Do not rerun `rcc work` unless the task/context changes or the brief is insufficient.",
  "- Do not repeatedly run `rcc work` for the same task.",
  "- Use `rcc find \"<keyword>\"` only if the route is insufficient.",
  "- Do not begin repository exploration, manual file reading, or broad searching before running `rcc work`.",
  "- Follow the read-first files from the work brief.",
  "- For targeted lookup, prefer `rcc find \"<keyword>\"` before broad grep/search.",
  "- Do not ask the human to run RCC commands.",
  "After meaningful changes, run tests and record:",
  "After meaningful changes:",
  "- After meaningful changes, run tests and record:",
  "`rcc done --summary \"<summary>\" --files auto --verify \"<checks>\"`",
  "1. Run relevant tests.",
  "2. Run `rcc done --summary \"<summary>\" --files auto --verify \"<checks>\"`.",
  "- Start tasks with `rcc work \"<task>\"` before broad scanning.",
  "- Do not replace `rcc work` with manually reading `docs/ai-context` files.",
  "- For targeted lookup, prefer `rcc find \"<keyword>\"` before broad repo search.",
  "- Save completed-work memory with `rcc done --summary \"<summary>\" --files auto --verify \"<checks>\"`."
]);
const legacyAgentsSupportLines = new Set([
  "- Read `docs/ai-context/HANDOFF.md` if present.",
  "- Read `docs/ai-context/WORK_INDEX.md` if task/history context is unclear; do not read full `WORK_LOG.md` by default.",
  "- Use `rcc doctor` for local/global RCC confusion.",
  "- Use `doctor` for local/global RCC confusion.",
  "- Use `rcc measure \"<task>\"` for token-saving estimates.",
  "- Use `measure` for token-saving estimates.",
  "- If RCC commands are unavailable, read only `docs/ai-context/TASK_ROUTING.md` and `docs/ai-context/TOKEN_BUDGET.md`; check `docs/ai-context/DO_NOT_READ.md` before manual broad scans.",
  "Keep changes focused. Avoid unnecessary repository scanning.",
  "- Read `docs/ai-context/COMMUNICATION_MODE.md` for response style.",
  "- Read `docs/ai-context/MODULE_INDEX.md` before changing modules.",
  "- Generated repo maps live in `docs/ai-context/*`.",
  "- Keep manual guidance outside generated markers."
]);

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

function extractAgentsManagedSupport(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  const end = normalized.indexOf(workflowEnd);
  return (end === -1
    ? normalized
    : normalized.slice(end + workflowEnd.length)).trim();
}

function stripLegacyWorkflowDuplicateLines(content: string): string {
  const lines = content.split("\n");
  const keptLines = lines.filter((line) => {
    const trimmed = line.trim();
    return !legacyWorkflowDuplicateLines.has(trimmed) && !legacyAgentsSupportLines.has(trimmed);
  });

  return keptLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripLegacyAgentsGeneratedSection(content: string): string {
  const start = content.indexOf(generatedStart);
  const end = content.indexOf(generatedEnd);

  if (start === -1 || end === -1 || end <= start) {
    return content;
  }

  const section = content.slice(start, end + generatedEnd.length);
  const isLegacyAgentsStub = section.includes("## Generated Repo Map")
    && section.includes("Compact generated entrypoint.");

  if (!isLegacyAgentsStub) {
    return content;
  }

  return `${content.slice(0, start)}\n${content.slice(end + generatedEnd.length)}`
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function upsertAgentsWorkflowSection(existing: string, templateContent: string): string {
  const workflowSection = extractWorkflowSection(templateContent);
  const managedSupport = extractAgentsManagedSupport(templateContent);
  const normalizedExisting = stripLegacyAgentsGeneratedSection(existing.replace(/\r\n/g, "\n")).replace(/\n*$/u, "\n");

  if (!workflowSection) {
    return normalizedExisting;
  }

  const managedSection = [workflowSection, managedSupport].filter(Boolean).join("\n\n");
  const start = normalizedExisting.indexOf(workflowStart);
  const end = normalizedExisting.indexOf(workflowEnd);

  if (start !== -1 && end !== -1 && end > start) {
    const beforeWorkflow = stripLegacyWorkflowDuplicateLines(normalizedExisting.slice(0, start));
    const afterWorkflow = stripLegacyWorkflowDuplicateLines(normalizedExisting.slice(end + workflowEnd.length));
    return [beforeWorkflow, managedSection, afterWorkflow].filter(Boolean).join("\n\n").trimEnd() + "\n";
  }

  const cleanedExisting = stripLegacyWorkflowDuplicateLines(normalizedExisting);
  return [cleanedExisting, managedSection].filter(Boolean).join("\n\n").trimEnd() + "\n";
}

export function isModernAgentsContent(content: string): boolean {
  const normalized = content.replace(/\r\n/g, "\n");
  return modernAgentsSignals.every((signal) => normalized.includes(signal));
}

export function isOutdatedRccAgentsContent(content: string): boolean {
  const normalized = content.replace(/\r\n/g, "\n");
  const hasRccSignals = legacyAgentsSignals.some((signal) => normalized.includes(signal));
  return hasRccSignals && !isModernAgentsContent(normalized);
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
