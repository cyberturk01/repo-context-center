const assert = require("node:assert/strict");
const { stat, readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const templateRoot = path.join(repoRoot, "src", "templates", "generic");
const maxTemplateBytes = 1600;

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

test("all required generic templates exist", async () => {
  for (const file of requiredTemplates) {
    const fileStat = await stat(path.join(templateRoot, file));
    assert.equal(fileStat.isFile(), true, file);
  }
});

test("generic templates are non-empty and compact", async () => {
  for (const file of requiredTemplates) {
    const content = await readFile(path.join(templateRoot, file), "utf8");
    const byteLength = Buffer.byteLength(content, "utf8");

    assert.notEqual(content.trim(), "", file);
    assert.ok(byteLength <= maxTemplateBytes, `${file} is ${byteLength} bytes`);
  }
});

test("generic template loader exposes the required set", async () => {
  const { genericTemplateFiles, readGenericTemplates } = require("../dist/templates/generic");
  const entries = await readGenericTemplates();

  assert.deepEqual([...genericTemplateFiles].sort(), [...requiredTemplates].sort());
  assert.equal(entries.length, requiredTemplates.length);
  assert.ok(entries.every((entry) => entry.content.trim().length > 0));
});

test("build copies markdown templates without removing compiled loader", async () => {
  const distTemplateRoot = path.join(repoRoot, "dist", "templates", "generic");
  const loaderStat = await stat(path.join(distTemplateRoot, "index.js"));
  const markdownStat = await stat(path.join(distTemplateRoot, "AGENTS.md"));

  assert.equal(loaderStat.isFile(), true);
  assert.equal(markdownStat.isFile(), true);
});
