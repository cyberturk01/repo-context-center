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

const expectedWorkflowSection = `<!-- repo-context-center:workflow:start -->
## RCC Workflow

For any coding task, the first shell command must be:

\`rcc work "<task>"\`

- Do not begin repository exploration, manual file reading, or broad searching before running \`rcc work\`.
- Follow the read-first files from the work brief.
- For targeted lookup, prefer \`rcc find "<keyword>"\` before broad grep/search.
- Do not ask the human to run RCC commands.

After meaningful changes:
1. Run relevant tests.
2. Run \`rcc done --summary "<summary>" --files auto --verify "<checks>"\`.
<!-- repo-context-center:workflow:end -->`;

function runInit(cwd, args = []) {
  return spawnSync(process.execPath, [cliPath, "init", ...args], {
    cwd,
    encoding: "utf8"
  });
}

function runCli(cwd, args = []) {
  return spawnSync(process.execPath, [cliPath, ...args], {
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

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

function workflowSection(content) {
  const start = content.indexOf("<!-- repo-context-center:workflow:start -->");
  const end = content.indexOf("<!-- repo-context-center:workflow:end -->");
  assert.ok(start !== -1 && end !== -1 && end > start);
  return content.slice(start, end + "<!-- repo-context-center:workflow:end -->".length);
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

test("init creates missing context files and populates real map content", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");

    const result = runInit(tempDir);
    const taskRouting = await readFile(path.join(tempDir, "docs/ai-context/TASK_ROUTING.md"), "utf8");
    const moduleIndex = await readFile(path.join(tempDir, "docs/ai-context/MODULE_INDEX.md"), "utf8");
    const agents = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Generated repository context: \d+ files updated \(\d+ files scanned\)\./);
    assert.match(taskRouting, /<!-- repo-context-center:generated:start -->/);
    assert.match(taskRouting, /src\/auth\/login\.ts/);
    assert.match(moduleIndex, /tests\/auth\/login\.test\.ts/);
    assert.match(agents, /Compact generated entrypoint\./);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init does not require a separate map --write call for work guidance", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");

    const initResult = runInit(tempDir);
    const workResult = runCli(tempDir, ["work", "fix login bug"]);

    assert.equal(initResult.status, 0);
    assert.equal(workResult.status, 0);
    assert.match(workResult.stdout, /src\/auth\/login\.ts/);
    assert.match(workResult.stdout, /tests\/auth\/login\.test\.ts/);
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
    assert.equal(workflowSection(content), expectedWorkflowSection);
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
    assert.equal(workflowSection(content), expectedWorkflowSection);
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
    assert.equal(countOccurrences(content, "rcc work \"<task>\""), 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init is idempotent after repeated runs", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");

    const first = runInit(tempDir);
    const afterFirstAgents = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");
    const afterFirstRouting = await readFile(path.join(tempDir, "docs/ai-context/TASK_ROUTING.md"), "utf8");
    const second = runInit(tempDir);
    const afterSecondAgents = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");
    const afterSecondRouting = await readFile(path.join(tempDir, "docs/ai-context/TASK_ROUTING.md"), "utf8");

    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    assert.equal(afterSecondAgents, afterFirstAgents);
    assert.equal(afterSecondRouting, afterFirstRouting);
    assert.equal(countOccurrences(afterSecondAgents, "<!-- repo-context-center:workflow:start -->"), 1);
    assert.equal(countOccurrences(afterSecondAgents, "<!-- repo-context-center:generated:start -->"), 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init keeps AGENTS.md workflow concise", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runInit(tempDir);
    const content = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");
    const words = workflowSection(content).trim().split(/\s+/).filter(Boolean);

    assert.equal(result.status, 0);
    assert.ok(words.length <= 85, `AGENTS workflow has ${words.length} words`);
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
    assert.equal(workflowSection(content), expectedWorkflowSection);
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
    assert.match(result.stdout, /For any coding task, the first shell command must be:/);
    assert.match(result.stdout, /`rcc work "<task>"`/);
    assert.match(result.stdout, /Do not begin repository exploration, manual file reading, or broad searching before running `rcc work`\./);
    assert.match(result.stdout, /rcc find "<keyword>"/);
    assert.match(result.stdout, /Do not ask the human to run RCC commands\./);
    assert.match(result.stdout, /2\. Run `rcc done --summary "<summary>" --files auto --verify "<checks>"`\./);
    assert.match(result.stdout, /If shell commands are unavailable, fallback to reading/);
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
