const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, stat, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

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

function runInit(cwd, args = []) {
  return spawnSync(process.execPath, [cliPath, "init", ...args], {
    cwd,
    encoding: "utf8"
  });
}

async function createTempRepo() {
  return mkdtemp(path.join(os.tmpdir(), "repo-context-center-init-"));
}

function countOccurrences(content, value) {
  return (content.match(new RegExp(value, "g")) ?? []).length;
}

test("init installs all generic templates into a temp repo", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runInit(tempDir);

    assert.equal(result.status, 0);
    for (const file of requiredTemplates) {
      const content = await readFile(path.join(tempDir, file), "utf8");
      assert.notEqual(content.trim(), "", file);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init updates existing AGENTS.md without overwriting content", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await mkdir(path.dirname(agentsPath), { recursive: true });
    await require("node:fs/promises").writeFile(agentsPath, "# Existing Agents\n\nKeep this project-specific guidance.\n", "utf8");

    const result = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /# Existing Agents/);
    assert.match(content, /Keep this project-specific guidance\./);
    assert.match(content, /<!-- repo-context-center:workflow:start -->/);
    assert.match(content, /Before coding:/);
    assert.match(content, /Run `rcc work`\./);
    assert.match(content, /Read the focused context\./);
    assert.match(content, /Avoid broad repo scanning unless necessary\./);
    assert.match(content, /After coding:/);
    assert.match(content, /Run relevant tests\./);
    assert.match(content, /Run `rcc done --summary "<summary>"`\./);
    assert.match(result.stdout, /Updated file: AGENTS\.md/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init creates AGENTS.md if missing", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runInit(tempDir);
    const content = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /# AGENTS\.md/);
    assert.match(content, /## RCC Workflow/);
    assert.match(content, /Before coding:/);
    assert.match(content, /After coding:/);
    assert.match(result.stdout, /Created file: AGENTS\.md/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init does not duplicate RCC workflow section", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    const first = runInit(tempDir);
    const second = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    assert.equal(countOccurrences(content, "<!-- repo-context-center:workflow:start -->"), 1);
    assert.equal(countOccurrences(content, "<!-- repo-context-center:workflow:end -->"), 1);
    assert.equal(countOccurrences(content, "## RCC Workflow"), 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init keeps AGENTS.md workflow concise", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runInit(tempDir);
    const content = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");
    const words = content.trim().split(/\s+/).filter(Boolean);

    assert.equal(result.status, 0);
    assert.ok(words.length <= 95, `AGENTS.md has ${words.length} words`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init preserves existing AGENTS.md content with --force", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await mkdir(path.dirname(agentsPath), { recursive: true });
    await require("node:fs/promises").writeFile(agentsPath, "custom\n", "utf8");

    const result = runInit(tempDir, ["--force"]);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /custom/);
    assert.match(content, /## RCC Workflow/);
    assert.match(content, /Run `rcc work`\./);
    assert.match(content, /Run `rcc done --summary "<summary>"`\./);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init dry-run does not write files", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runInit(tempDir, ["--dry-run"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Dry run complete/);
    assert.match(result.stdout, /Run `rcc work`\./);
    assert.match(result.stdout, /Run `rcc done --summary "<summary>"`\./);
    assert.match(result.stdout, /No shell: read/);
    assert.match(result.stdout, /docs\/ai-context\/COMMUNICATION_MODE\.md/);
    assert.match(result.stdout, /docs\/ai-context\/TASK_ROUTING\.md/);
    assert.match(result.stdout, /docs\/ai-context\/DO_NOT_READ\.md/);
    assert.match(result.stdout, /Use `docs\/ai-context\/MODULE_INDEX\.md` only when routing is missing or the task spans modules\./);

    for (const file of requiredTemplates) {
      await assert.rejects(() => stat(path.join(tempDir, file)), { code: "ENOENT" });
    }

    await assert.rejects(
      () => stat(path.join(tempDir, ".repo-context-center", "config.json")),
      { code: "ENOENT" }
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init creates archive directory", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runInit(tempDir);
    const archiveStat = await stat(path.join(tempDir, "docs", "ai-context", "archive"));

    assert.equal(result.status, 0);
    assert.equal(archiveStat.isDirectory(), true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init creates GitHub workflow with --github-action", async () => {
  const tempDir = await createTempRepo();
  const workflowPath = path.join(tempDir, ".github", "workflows", "repo-context-check.yml");

  try {
    const result = runInit(tempDir, ["--github-action"]);
    const content = await readFile(workflowPath, "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /actions\/checkout@v4/);
    assert.match(content, /actions\/setup-node@v4/);
    assert.match(content, /npx repo-context-center map --check --max-files 300/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init does not create GitHub workflow by default", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runInit(tempDir);

    assert.equal(result.status, 0);
    await assert.rejects(
      () => stat(path.join(tempDir, ".github", "workflows", "repo-context-check.yml")),
      { code: "ENOENT" }
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init does not overwrite existing GitHub workflow", async () => {
  const tempDir = await createTempRepo();
  const workflowPath = path.join(tempDir, ".github", "workflows", "repo-context-check.yml");

  try {
    await mkdir(path.dirname(workflowPath), { recursive: true });
    await writeFile(workflowPath, "custom workflow\n", "utf8");

    const result = runInit(tempDir, ["--github-action"]);
    const content = await readFile(workflowPath, "utf8");

    assert.equal(result.status, 0);
    assert.equal(content, "custom workflow\n");
    assert.match(result.stdout, /Skipped file: \.github\/workflows\/repo-context-check\.yml already exists/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init force overwrites GitHub workflow", async () => {
  const tempDir = await createTempRepo();
  const workflowPath = path.join(tempDir, ".github", "workflows", "repo-context-check.yml");

  try {
    await mkdir(path.dirname(workflowPath), { recursive: true });
    await writeFile(workflowPath, "custom workflow\n", "utf8");

    const result = runInit(tempDir, ["--github-action", "--force"]);
    const content = await readFile(workflowPath, "utf8");

    assert.equal(result.status, 0);
    assert.notEqual(content, "custom workflow\n");
    assert.match(content, /npx repo-context-center map --check --max-files 300/);
    assert.match(result.stdout, /Overwrote file: \.github\/workflows\/repo-context-check\.yml/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
