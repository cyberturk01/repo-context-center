const assert = require("node:assert/strict");
const { stat, readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const templateRoot = path.join(repoRoot, "src", "templates", "generic");
const distTemplateRoot = path.join(repoRoot, "dist", "templates", "generic");
const distGithubTemplateRoot = path.join(repoRoot, "dist", "templates", "github");
const maxTemplateBytes = 1600;
const previousTemplateWordBaseline = 925;
const compressedTemplateWordLimit = Math.floor(previousTemplateWordBaseline * 0.7);

const requiredTemplates = [
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
  "docs/ai-context/HOTSPOTS.md",
  "docs/ai-context/LESSONS_LEARNED.md",
  "docs/ai-context/CHANGE_LOG.md"
];

const expectedWorkflowSection = `<!-- repo-context-center:workflow:start -->
## RCC Workflow

For coding tasks, first run once:

\`rcc work "<task>"\`

Then:
- Follow the brief before reading files or searching broadly.
- Use \`rcc find "<keyword>"\` for follow-up lookup.
- Do not rerun \`rcc work\` unless the task/context changes or the brief is insufficient.
- Do not ask the human to run RCC commands.
- After meaningful changes, run tests and record:
  \`rcc done --summary "<summary>" --files auto --verify "<checks>"\`
<!-- repo-context-center:workflow:end -->`;

const templateTitles = {
  "AGENTS.md": "# AGENTS.md",
  "docs/ai-context/COMMUNICATION_MODE.md": "# Communication Mode",
  "docs/ai-context/TASK_ROUTING.md": "# Task Routing",
  "docs/ai-context/MODULE_INDEX.md": "# Module Index",
  "docs/ai-context/PROJECT_MAP.md": "# Project Map",
  "docs/ai-context/RISK_REGISTER.md": "# Risk Register",
  "docs/ai-context/DEPENDENCY_MAP.md": "# Dependency Map",
  "docs/ai-context/SYMBOL_MAP.md": "# Symbol Map",
  "docs/ai-context/TOKEN_BUDGET.md": "# Token Budget",
  "docs/ai-context/DO_NOT_READ.md": "# Do Not Read",
  "docs/ai-context/HOTSPOTS.md": "# Hotspots",
  "docs/ai-context/LESSONS_LEARNED.md": "# Lessons Learned",
  "docs/ai-context/CHANGE_LOG.md": "# Change Log"
};

function shellFallbackLine(content) {
  return content.split("\n").find((line) => line.includes("RCC commands are unavailable")) ?? "";
}

function workflowSection(content) {
  const startMarker = "<!-- repo-context-center:workflow:start -->";
  const endMarker = "<!-- repo-context-center:workflow:end -->";
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  assert.ok(start !== -1 && end !== -1 && end > start);
  return content.slice(start, end + endMarker.length);
}

test("all required generic templates exist", async () => {
  for (const file of requiredTemplates) {
    const fileStat = await stat(path.join(templateRoot, file));
    assert.equal(fileStat.isFile(), true, file);
  }
});

test("generic template count and names stay unchanged", async () => {
  const { genericTemplateFiles } = require("../dist/templates/generic");

  assert.equal(requiredTemplates.length, 13);
  assert.equal(genericTemplateFiles.length, requiredTemplates.length);
  assert.deepEqual([...genericTemplateFiles].sort(), [...requiredTemplates].sort());
});

test("generic templates are non-empty and compact", async () => {
  for (const file of requiredTemplates) {
    const content = await readFile(path.join(templateRoot, file), "utf8");
    const byteLength = Buffer.byteLength(content, "utf8");

    assert.notEqual(content.trim(), "", file);
    assert.ok(byteLength <= maxTemplateBytes, `${file} is ${byteLength} bytes`);
  }
});

test("AGENTS template keeps low-token startup references", async () => {
  const content = await readFile(path.join(templateRoot, "AGENTS.md"), "utf8");
  const noShellLine = shellFallbackLine(content);

  assert.equal(workflowSection(content), expectedWorkflowSection);
  assert.match(content, /Read this first\./);
  assert.match(content, /rcc doctor/);
  assert.match(content, /rcc measure "<task>"/);
  assert.match(content, /TASK_ROUTING\.md/);
  assert.match(noShellLine, /TOKEN_BUDGET\.md/);
  assert.match(content, /DO_NOT_READ\.md/);
  assert.doesNotMatch(content, /COMMUNICATION_MODE\.md/);
  assert.doesNotMatch(content, /MODULE_INDEX\.md/);
  assert.match(content, /Avoid unnecessary repository scanning\./);
});

test("AGENTS template remains startup-only", async () => {
  const content = await readFile(path.join(templateRoot, "AGENTS.md"), "utf8");
  const words = content.trim().split(/\s+/).filter(Boolean);

  assert.ok(words.length <= 140, `AGENTS.md has ${words.length} words`);
  assert.doesNotMatch(content, /^Read:$/m);
  assert.doesNotMatch(content, /^Modes:$/m);
  assert.doesNotMatch(content, /# Task Routing/);
  assert.doesNotMatch(content, /# Project Map/);
  assert.doesNotMatch(content, /# Module Index/);
  assert.doesNotMatch(content, /# Risk Register/);
  assert.doesNotMatch(content, /# Change Log/);
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

test("generated AGENTS template keeps core startup rules", async () => {
  const content = await readFile(path.join(distTemplateRoot, "AGENTS.md"), "utf8");
  const noShellLine = shellFallbackLine(content);

  assert.equal(workflowSection(content), expectedWorkflowSection);
  assert.match(content, /rcc doctor/);
  assert.match(content, /rcc measure "<task>"/);
  assert.match(content, /docs\/ai-context\/TASK_ROUTING\.md/);
  assert.match(noShellLine, /docs\/ai-context\/TOKEN_BUDGET\.md/);
  assert.match(content, /docs\/ai-context\/DO_NOT_READ\.md/);
  assert.doesNotMatch(content, /docs\/ai-context\/COMMUNICATION_MODE\.md/);
  assert.doesNotMatch(content, /docs\/ai-context\/MODULE_INDEX\.md/);
  assert.match(content, /Read this first\./);
  assert.match(content, /Avoid unnecessary repository scanning\./);
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
