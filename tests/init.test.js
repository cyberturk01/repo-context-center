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
    assert.match(content, /Repo Context Center startup\./);
    assert.match(content, /repo-context-center start "<task>"/);
    assert.match(content, /No shell: read/);
    assert.match(content, /docs\/ai-context\/TASK_ROUTING\.md/);
    assert.match(content, /docs\/ai-context\/DO_NOT_READ\.md/);
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
    assert.match(result.stdout, /repo-context-center start "<task>"/);
    assert.match(result.stdout, /No shell: read/);
    assert.match(result.stdout, /docs\/ai-context\/TASK_ROUTING\.md/);
    assert.match(result.stdout, /docs\/ai-context\/DO_NOT_READ\.md/);

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
