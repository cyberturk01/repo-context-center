const assert = require("node:assert/strict");
const { stat, readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const templateRoot = path.join(repoRoot, "src", "templates", "generic");
const distTemplateRoot = path.join(repoRoot, "dist", "templates", "generic");
const distGithubTemplateRoot = path.join(repoRoot, "dist", "templates", "github");
const maxTemplateBytes = 1600;
const maxWorkflowTemplateBytes = 2200;
const previousTemplateWordBaseline = 968;
const compressedTemplateWordLimit = Math.floor(previousTemplateWordBaseline * 0.85);

const requiredTemplates = [
  "AGENTS.md",
  "docs/ai-context/RCC_WORKFLOW.md",
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
  "docs/ai-context/REPOSITORY_LEARNING.md",
  "docs/ai-context/HOTSPOTS.md",
  "docs/ai-context/LESSONS_LEARNED.md",
  "docs/ai-context/CHANGE_LOG.md"
];

const minimalAgentsPointer = "# Agent Instructions\n\nFor the RCC repository workflow, read docs/ai-context/RCC_WORKFLOW.md before coding tasks.\n";

const templateTitles = {
  "AGENTS.md": "# Agent Instructions",
  "docs/ai-context/RCC_WORKFLOW.md": "# RCC Workflow",
  "docs/ai-context/COMMUNICATION_MODE.md": "# Communication Mode",
  "docs/ai-context/TASK_ROUTING.md": "# Task Routing",
  "docs/ai-context/MODULE_INDEX.md": "# Module Index",
  "docs/ai-context/PROJECT_MAP.md": "# Project Map",
  "docs/ai-context/RISK_REGISTER.md": "# Risk Register",
  "docs/ai-context/DEPENDENCY_MAP.md": "# Dependency Map",
  "docs/ai-context/SYMBOL_MAP.md": "# Symbol Map",
  "docs/ai-context/TOKEN_BUDGET.md": "# Token Budget",
  "docs/ai-context/DO_NOT_READ.md": "# Do Not Read",
  "docs/ai-context/WORK_INDEX.md": "# Work Index",
  "docs/ai-context/REPOSITORY_LEARNING.md": "# Repository Learning",
  "docs/ai-context/HOTSPOTS.md": "# Hotspots",
  "docs/ai-context/LESSONS_LEARNED.md": "# Lessons Learned",
  "docs/ai-context/CHANGE_LOG.md": "# Change Log"
};

test("all required generic templates exist", async () => {
  for (const file of requiredTemplates) {
    const fileStat = await stat(path.join(templateRoot, file));
    assert.equal(fileStat.isFile(), true, file);
  }
});

test("generic template count and names stay unchanged", async () => {
  const { genericTemplateFiles } = require("../dist/templates/generic");

  assert.equal(requiredTemplates.length, 16);
  assert.equal(genericTemplateFiles.length, requiredTemplates.length);
  assert.deepEqual([...genericTemplateFiles].sort(), [...requiredTemplates].sort());
});

test("generic templates are non-empty and compact", async () => {
  for (const file of requiredTemplates) {
    const content = await readFile(path.join(templateRoot, file), "utf8");
    const byteLength = Buffer.byteLength(content, "utf8");

    assert.notEqual(content.trim(), "", file);
    const limit = file === "docs/ai-context/RCC_WORKFLOW.md" ? maxWorkflowTemplateBytes : maxTemplateBytes;
    assert.ok(byteLength <= limit, `${file} is ${byteLength} bytes`);
  }
});

test("AGENTS template is a minimal workflow pointer", async () => {
  const content = await readFile(path.join(templateRoot, "AGENTS.md"), "utf8");

  assert.equal(content, minimalAgentsPointer);
  assert.doesNotMatch(content, /repo-context-center:workflow:start/);
});

test("AGENTS template remains startup-only", async () => {
  const content = await readFile(path.join(templateRoot, "AGENTS.md"), "utf8");
  const words = content.trim().split(/\s+/).filter(Boolean);

  assert.ok(words.length <= 185, `AGENTS.md has ${words.length} words`);
  assert.doesNotMatch(content, /^Read:$/m);
  assert.doesNotMatch(content, /^Modes:$/m);
  assert.doesNotMatch(content, /# Task Routing/);
  assert.doesNotMatch(content, /# Project Map/);
  assert.doesNotMatch(content, /# Module Index/);
  assert.doesNotMatch(content, /# Risk Register/);
  assert.doesNotMatch(content, /# Change Log/);
});

test("RCC workflow template keeps core startup rules", async () => {
  const content = await readFile(path.join(templateRoot, "docs/ai-context/RCC_WORKFLOW.md"), "utf8");

  assert.match(content, /# RCC Workflow/);
  assert.match(content, /For coding tasks, try RCC in this order:/);
  assert.match(content, /`rcc work "<task>" --agent`/);
  assert.match(content, /`repo-context-center work "<task>" --agent`/);
  assert.match(content, /`npx repo-context-center@latest work "<task>" --agent`/);
  assert.match(content, /Do not enter fallback mode after only one failed command\./);
  assert.match(content, /Use `rcc doctor` for local\/global RCC confusion\./);
  assert.match(content, /For task-first route savings, use `rcc measure "<task>"`\./);
  assert.match(content, /For broader context-cost estimates, use `rcc estimate --compare-naive`, `rcc estimate --task "<task>"`, or `rcc estimate --json`\./);
  assert.doesNotMatch(content, /measure[^.\n]*--compare-naive/);
  assert.match(content, /docs\/ai-context\/TASK_ROUTING\.md/);
  assert.match(content, /docs\/ai-context\/TOKEN_BUDGET\.md/);
  assert.match(content, /docs\/ai-context\/DO_NOT_READ\.md/);
  assert.match(content, /docs\/ai-context\/WORK_INDEX\.md/);
  assert.match(content, /do not read full `WORK_LOG\.md` by default/);
  assert.doesNotMatch(content, /docs\/ai-context\/COMMUNICATION_MODE\.md/);
  assert.doesNotMatch(content, /docs\/ai-context\/MODULE_INDEX\.md/);
  assert.match(content, /Avoid unnecessary repository scanning\./);
});

test("RCC workflow fallback stays strict and bounded", async () => {
  const content = await readFile(path.join(templateRoot, "docs/ai-context/RCC_WORKFLOW.md"), "utf8");
  const fallback = content.slice(content.indexOf("## If RCC commands are unavailable"));

  assert.match(fallback, /Do not ask the human to run RCC commands\./);
  assert.match(fallback, /Read only:\n  - `docs\/ai-context\/TASK_ROUTING\.md`\n  - `docs\/ai-context\/DO_NOT_READ\.md`/);
  assert.match(fallback, /Use `docs\/ai-context\/TOKEN_BUDGET\.md` only if budget guidance is needed\./);
  assert.match(fallback, /Do not read all context files\./);
  assert.match(fallback, /If the route is still unclear, read at most one additional context file\./);
  assert.match(fallback, /1-3 likely implementation files/);
  assert.match(fallback, /1-2 likely test files/);
  assert.match(fallback, /Do not perform broad repository scans\./);
  assert.match(fallback, /Prefer targeted file\/path searches over broad scans\./);

  for (const file of ["PROJECT_MAP.md", "MODULE_INDEX.md", "HOTSPOTS.md", "RISK_REGISTER.md", "DEPENDENCY_MAP.md", "SYMBOL_MAP.md"]) {
    assert.match(fallback, new RegExp(`- \`${file.replace(".", "\\.")}\``));
  }

  assert.doesNotMatch(fallback, /read context files on demand/i);
  assert.doesNotMatch(fallback, /check mapping files/i);
  assert.doesNotMatch(fallback, /pull risk mapping files/i);
  assert.doesNotMatch(fallback, /inspect project context/i);
});

test("templates do not contain another template title", async () => {
  for (const file of requiredTemplates) {
    const content = await readFile(path.join(templateRoot, file), "utf8");
    const otherTitles = Object.entries(templateTitles)
      .filter(([otherFile]) => otherFile !== file)
      .map(([, title]) => title);

    for (const title of otherTitles) {
      assert.doesNotMatch(content, new RegExp(`^${title}$`, "m"), `${file} contains ${title}`);
    }
  }
});

test("generated templates stay below the previous word baseline", async () => {
  let totalWords = 0;

  for (const file of requiredTemplates) {
    const content = await readFile(path.join(distTemplateRoot, file), "utf8");
    totalWords += content.trim().split(/\s+/).filter(Boolean).length;
  }

  assert.ok(
    totalWords <= compressedTemplateWordLimit,
    `${totalWords} words exceeds ${compressedTemplateWordLimit}`
  );
});

test("generated AGENTS template avoids verbose meta headings", async () => {
  const content = await readFile(path.join(distTemplateRoot, "AGENTS.md"), "utf8");

  assert.doesNotMatch(content, /When to read/);
  assert.doesNotMatch(content, /What to read/);
  assert.doesNotMatch(content, /This file contains/);
});

test("generated AGENTS template keeps minimal pointer", async () => {
  const content = await readFile(path.join(distTemplateRoot, "AGENTS.md"), "utf8");

  assert.equal(content, minimalAgentsPointer);
  assert.doesNotMatch(content, /^Read:$/m);
  assert.doesNotMatch(content, /^Modes:$/m);
});

test("generic template loader exposes the required set", async () => {
  const { genericTemplateFiles, readGenericTemplates } = require("../dist/templates/generic");
  const entries = await readGenericTemplates();

  assert.deepEqual([...genericTemplateFiles].sort(), [...requiredTemplates].sort());
  assert.equal(entries.length, requiredTemplates.length);
  assert.ok(entries.every((entry) => entry.content.trim().length > 0));
});

test("repository learning template has generated markers and compact sections", async () => {
  const content = await readFile(path.join(templateRoot, "docs/ai-context/REPOSITORY_LEARNING.md"), "utf8");

  assert.match(content, /^# Repository Learning$/m);
  assert.match(content, /<!-- repo-context-center:repository-learning:start -->/);
  assert.match(content, /<!-- repo-context-center:repository-learning:end -->/);
  assert.match(content, /^## Recent Focus Areas$/m);
  assert.match(content, /^## Common File Relationships$/m);
  assert.match(content, /^## Frequently Modified Together$/m);
  assert.match(content, /^## Verification Patterns$/m);
  assert.match(content, /^## Repository Habits$/m);
  assert.match(content, /\| --- \| --- \| --- \| ---: \|/);
  assert.match(content, /\| --- \| ---: \| --- \|/);
  assert.doesNotMatch(content, /(^|\|)\s*--:\s*(?=\|)/);
  assert.match(content, /none detected yet/);
});

test("build copies markdown templates without removing compiled loader", async () => {
  const loaderStat = await stat(path.join(distTemplateRoot, "index.js"));
  const markdownStat = await stat(path.join(distTemplateRoot, "AGENTS.md"));

  assert.equal(loaderStat.isFile(), true);
  assert.equal(markdownStat.isFile(), true);
});

test("build copies GitHub workflow template into package output", async () => {
  const workflowPath = path.join(distGithubTemplateRoot, "context-check.yml");
  const workflowStat = await stat(workflowPath);
  const content = await readFile(workflowPath, "utf8");

  assert.equal(workflowStat.isFile(), true);
  assert.match(content, /pull_request:/);
  assert.match(content, /actions\/setup-node@v4/);
  assert.match(content, /npx repo-context-center map --check --max-files 300/);
});
