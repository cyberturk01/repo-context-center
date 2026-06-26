import path from "node:path";
import { ensureDir, pathExists, readTextFile, writeTextFile } from "./fileSystem";
import { readGenericTemplates } from "../templates/generic";

export interface TemplateInstallOptions {
  cwd: string;
  force?: boolean;
  dryRun?: boolean;
  githubAction?: boolean;
  updateAgentFile?: boolean;
}

export type TemplateInstallAction = "create" | "overwrite" | "skip" | "update";

export interface TemplateInstallResult {
  path: string;
  action: TemplateInstallAction;
  type: "file" | "directory";
  preview?: string;
  message?: string;
}

const archiveDir = "docs/ai-context/archive";
export const githubWorkflowPath = ".github/workflows/repo-context-check.yml";
const agentsPath = "AGENTS.md";
const rccWorkflowPath = "docs/ai-context/RCC_WORKFLOW.md";
const workflowStart = "<!-- repo-context-center:workflow:start -->";
const workflowEnd = "<!-- repo-context-center:workflow:end -->";
const workflowStartPattern = /<!--\s*repo-context-center:workflow:start\s*-->/;
const workflowEndPattern = /<!--\s*repo-context-center:workflow:end\s*-->/;
const generatedStart = "<!-- repo-context-center:generated:start -->";
const generatedEnd = "<!-- repo-context-center:generated:end -->";
const agentsPointer = "# Agent Instructions\n\nFor the RCC repository workflow, read docs/ai-context/RCC_WORKFLOW.md before coding tasks.\n";
const agentsWorkflowPointerBlock = `${workflowStart}
For the RCC repository workflow, read:

\`docs/ai-context/RCC_WORKFLOW.md\`
${workflowEnd}`;
const aiInstructionFiles = [
  "CLAUDE.md",
  "GEMINI.md",
  ".cursor/rules",
  ".github/copilot-instructions.md",
  ".windsurf/rules"
];
const externalAiInstructionFileSet = new Set(aiInstructionFiles);
const modernAgentsSignals = [
  "For the RCC repository workflow, read docs/ai-context/RCC_WORKFLOW.md before coding tasks."
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
  "- For task-first route savings, use `rcc measure \"<task>\"`.",
  "- For broader context-cost estimates, use `rcc estimate --compare-naive`, `rcc estimate --task \"<task>\"`, or `rcc estimate --json`.",
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
  const markers = findWorkflowMarkerBlock(content);

  return markers
    ? content.slice(markers.start, markers.end).trim()
    : "";
}

function findWorkflowMarkerBlock(content: string): { start: number; end: number } | undefined {
  const startMatch = workflowStartPattern.exec(content);
  if (!startMatch) {
    return undefined;
  }

  workflowEndPattern.lastIndex = 0;
  const afterStart = content.slice(startMatch.index + startMatch[0].length);
  const endMatch = workflowEndPattern.exec(afterStart);
  if (!endMatch) {
    return undefined;
  }

  const end = startMatch.index + startMatch[0].length + endMatch.index + endMatch[0].length;
  return { start: startMatch.index, end };
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

export function upsertAgentsWorkflowSection(existing: string, templateContent = agentsWorkflowPointerBlock): string {
  const workflowSection = extractWorkflowSection(templateContent) || templateContent.trim();
  const normalizedExisting = stripLegacyAgentsGeneratedSection(existing.replace(/\r\n/g, "\n")).replace(/\n*$/u, "\n");

  if (!workflowSection) {
    return normalizedExisting;
  }

  const markers = findWorkflowMarkerBlock(normalizedExisting);

  if (markers) {
    const beforeWorkflow = normalizedExisting.slice(0, markers.start).trimEnd();
    const afterWorkflow = normalizedExisting.slice(markers.end).trimStart();
    return [beforeWorkflow, workflowSection, afterWorkflow].filter(Boolean).join("\n\n").trimEnd() + "\n";
  }

  const cleanedExisting = stripLegacyWorkflowDuplicateLines(normalizedExisting);
  return [cleanedExisting, workflowSection].filter(Boolean).join("\n\n").trimEnd() + "\n";
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
      await writeTextFile(targetPath, agentsPointer);
    }

    const preview = options.dryRun ? agentsPointer : undefined;
    return { path: agentsPath, action: "create", type: "file", preview };
  }

  const existing = await readTextFile(targetPath);
  const hasMarker = findWorkflowMarkerBlock(existing.replace(/\r\n/g, "\n")) !== undefined;
  if (!hasMarker && !options.updateAgentFile) {
    return {
      path: agentsPath,
      action: "skip",
      type: "file",
      message: `Detected AGENTS.md. RCC did not modify it. RCC workflow was generated at ${rccWorkflowPath}.`
    };
  }

  const nextContent = hasMarker
    ? upsertAgentsWorkflowSection(existing, agentsWorkflowPointerBlock)
    : [existing.replace(/\s*$/u, ""), agentsWorkflowPointerBlock].filter(Boolean).join("\n\n") + "\n";
  const action: TemplateInstallAction = nextContent === existing ? "skip" : "update";

  if (!options.dryRun && action === "update") {
    await writeTextFile(targetPath, nextContent);
  }

  const preview = options.dryRun && action === "update" ? nextContent : undefined;
  return { path: agentsPath, action, type: "file", preview };
}

async function detectExternalAiInstructionFiles(options: TemplateInstallOptions): Promise<TemplateInstallResult[]> {
  const results: TemplateInstallResult[] = [];

  for (const filePath of aiInstructionFiles) {
    if (await pathExists(path.join(options.cwd, filePath))) {
      results.push({
        path: filePath,
        action: "skip",
        type: "file",
        message: `Detected ${filePath}. RCC did not modify it. RCC workflow was generated at ${rccWorkflowPath}.`
      });
    }
  }

  return results;
}

export async function installGenericTemplates(
  options: TemplateInstallOptions
): Promise<TemplateInstallResult[]> {
  const results: TemplateInstallResult[] = [];
  const templates = await readGenericTemplates();
  const agentsTemplate = templates.find((template) => template.path === agentsPath);

  for (const template of templates) {
    if (template.path === agentsPath) {
      continue;
    }

    if (externalAiInstructionFileSet.has(template.path)) {
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

  if (agentsTemplate) {
    results.unshift(await installAgentsTemplate(options, agentsTemplate.content));
  }
  results.push(...await detectExternalAiInstructionFiles(options));

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
