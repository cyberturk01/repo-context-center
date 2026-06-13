const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, stat } = require("node:fs/promises");
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

test("init does not overwrite existing files", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await mkdir(path.dirname(agentsPath), { recursive: true });
    await require("node:fs/promises").writeFile(agentsPath, "custom\n", "utf8");

    const result = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.equal(content, "custom\n");
    assert.match(result.stdout, /Skipped file: AGENTS\.md already exists/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init overwrites existing files with --force", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await mkdir(path.dirname(agentsPath), { recursive: true });
    await require("node:fs/promises").writeFile(agentsPath, "custom\n", "utf8");

    const result = runInit(tempDir, ["--force"]);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.notEqual(content, "custom\n");
    assert.match(content, /Use this repository context center/);
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
