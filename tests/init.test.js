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
  "docs/ai-context/REPOSITORY_LEARNING.md",
  "docs/ai-context/HOTSPOTS.md",
  "docs/ai-context/LESSONS_LEARNED.md",
  "docs/ai-context/CHANGE_LOG.md"
];

const expectedWorkflowSection = `<!-- repo-context-center:workflow:start -->
For the RCC repository workflow, read:

\`docs/ai-context/RCC_WORKFLOW.md\`
<!-- repo-context-center:workflow:end -->`;

const minimalAgentsPointer = "# Agent Instructions\n\nFor the RCC repository workflow, read docs/ai-context/RCC_WORKFLOW.md before coding tasks.\n";

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
    const workflow = await readFile(path.join(tempDir, "docs/ai-context/RCC_WORKFLOW.md"), "utf8");
    const repositoryLearning = await readFile(path.join(tempDir, "docs/ai-context/REPOSITORY_LEARNING.md"), "utf8");
    const agents = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Generated repository context: \d+ files updated\./);
    assert.match(result.stdout, /Repository size: small/);
    assert.match(result.stdout, /Scan cap: 500/);
    assert.match(result.stdout, /Files scanned: 18/);
    assert.match(taskRouting, /<!-- repo-context-center:generated:start -->/);
    assert.match(taskRouting, /src\/auth\/login\.ts/);
    assert.match(moduleIndex, /tests\/auth\/login\.test\.ts/);
    assert.match(repositoryLearning, /<!-- repo-context-center:repository-learning:start -->/);
    assert.match(repositoryLearning, /<!-- repo-context-center:repository-learning:end -->/);
    assert.match(repositoryLearning, /## Recent Focus Areas/);
    assert.match(workflow, /For coding tasks, try RCC in this order:/);
    assert.match(workflow, /`rcc work "<task>" --agent`/);
    assert.equal(agents, minimalAgentsPointer);
    assert.doesNotMatch(agents, /repo-context-center:generated:start/);
    assert.doesNotMatch(agents, /Compact generated entrypoint\./);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init --max-files overrides auto scan cap", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeFixtureFile(tempDir, "src/a.ts", "export const a = true;\n");
    await writeFixtureFile(tempDir, "src/b.ts", "export const b = true;\n");
    await writeFixtureFile(tempDir, "src/c.ts", "export const c = true;\n");

    const result = runInit(tempDir, ["--max-files", "2"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Repository size: small/);
    assert.match(result.stdout, /Eligible files: 19/);
    assert.match(result.stdout, /Scan cap: 2/);
    assert.match(result.stdout, /Files scanned: 2/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});


test("init preserves manual repository learning sections outside generated markers", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeFixtureFile(tempDir, "docs/ai-context/REPOSITORY_LEARNING.md", [
      "# Repository Learning",
      "",
      "Manual note before generated content.",
      "",
      "<!-- repo-context-center:repository-learning:start -->",
      "stale generated content",
      "<!-- repo-context-center:repository-learning:end -->",
      "",
      "Manual note after generated content.",
      ""
    ].join("\n"));

    const result = runInit(tempDir);
    const content = await readFile(path.join(tempDir, "docs/ai-context/REPOSITORY_LEARNING.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Manual note before generated content\./);
    assert.match(content, /Manual note after generated content\./);
    assert.match(content, /## Recent Focus Areas/);
    assert.doesNotMatch(content, /stale generated content/);
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

test("init leaves existing AGENTS.md without RCC marker unchanged", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await mkdir(path.dirname(agentsPath), { recursive: true });
    await require("node:fs/promises").writeFile(agentsPath, "# Existing Agents\n\nKeep this project-specific guidance.\n", "utf8");

    const result = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.equal(content, "# Existing Agents\n\nKeep this project-specific guidance.\n");
    assert.match(result.stdout, /Detected AGENTS\.md\. RCC did not modify it\. RCC workflow was generated at docs\/ai-context\/RCC_WORKFLOW\.md\./);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init detects and updates AGENTS.md with exact RCC marker block", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", [
      "# Project Agents",
      "",
      "<!-- repo-context-center:workflow:start -->",
      "temporary workflow",
      "<!-- repo-context-center:workflow:end -->",
      ""
    ].join("\n"));

    const result = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.equal(workflowSection(content), expectedWorkflowSection);
    assert.doesNotMatch(result.stdout, /Detected AGENTS\.md\. RCC did not modify it/);
    assert.match(result.stdout, /Updated file: AGENTS\.md/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init detects and replaces old full AGENTS workflow marker block", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", [
      "# Project Agents",
      "",
      "<!-- repo-context-center:workflow:start -->",
      "## RCC Workflow",
      "",
      "For coding tasks, first run once at task start:",
      "",
      "`rcc work \"<task>\" --agent`",
      "",
      "Then:",
      "- Inspect the returned primaryFiles, tests, and supportingFiles before reading or searching broadly.",
      "- Do not repeatedly run `rcc work` for the same task.",
      "- Use `rcc find \"<keyword>\"` only if the route is insufficient.",
      "- Do not ask the human to run RCC commands.",
      "- After meaningful changes, run tests and record:",
      "  `rcc done --summary \"<summary>\" --files auto --verify \"<checks>\"`",
      "<!-- repo-context-center:workflow:end -->",
      ""
    ].join("\n"));

    const result = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.equal(workflowSection(content), expectedWorkflowSection);
    assert.doesNotMatch(content, /## RCC Workflow/);
    assert.doesNotMatch(content, /rcc work "<task>" --agent/);
    assert.match(result.stdout, /Updated file: AGENTS\.md/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init preserves AGENTS.md user content before and after RCC marker block", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", [
      "# Project Agents",
      "",
      "Manual before.",
      "",
      "<!-- repo-context-center:workflow:start -->",
      "old workflow",
      "<!-- repo-context-center:workflow:end -->",
      "",
      "Manual after.",
      ""
    ].join("\n"));

    const result = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Manual before\./);
    assert.match(content, /Manual after\./);
    assert.equal(workflowSection(content), expectedWorkflowSection);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init preserves manual AGENTS sections and refreshes marked RCC pointer", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", [
      "# Project Agents",
      "",
      "Manual intro: keep this.",
      "",
      "<!-- repo-context-center:workflow:start -->",
      "old workflow",
      "<!-- repo-context-center:workflow:end -->",
      "",
      "## Project Rules",
      "",
      "Manual rule: keep this too.",
      ""
    ].join("\n"));

    const result = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Manual intro: keep this\./);
    assert.match(content, /## Project Rules/);
    assert.match(content, /Manual rule: keep this too\./);
    assert.equal(workflowSection(content), expectedWorkflowSection);
    assert.match(result.stdout, /Updated file: AGENTS\.md/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init updates only marked AGENTS block and preserves surrounding user content", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", [
      "# AGENTS.md",
      "",
      "Read this first.",
      "",
      "After meaningful changes, run tests and record:",
      "  `rcc done --summary \"<summary>\" --files auto --verify \"<checks>\"`",
      "",
      "## Local RCC Development",
      "",
      "- Use `doctor` for local/global RCC confusion.",
      "- Use `measure` for token-saving estimates.",
      "",
      "<!-- repo-context-center:workflow:start -->",
      "old workflow",
      "<!-- repo-context-center:workflow:end -->",
      "",
      "- Read `docs/ai-context/HANDOFF.md` if present.",
      "",
      "Keep this project-specific guidance.",
      ""
    ].join("\n"));

    const result = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.equal(workflowSection(content), expectedWorkflowSection);
    assert.match(content, /Keep this project-specific guidance\./);
    assert.match(content, /After meaningful changes, run tests and record:/);
    assert.match(content, /- Use `measure` for token-saving estimates\./);
    assert.match(content, /- Read `docs\/ai-context\/HANDOFF\.md` if present\./);
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
    assert.equal(content, minimalAgentsPointer);
    assert.match(result.stdout, /Created file: AGENTS\.md/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init does not modify existing non-RCC AI instruction files", async () => {
  const tempDir = await createTempRepo();
  const aiFiles = {
    "CLAUDE.md": "# Claude\n\nKeep Claude guidance.\n",
    "GEMINI.md": "# Gemini\n\nKeep Gemini guidance.\n",
    ".cursor/rules": "Keep Cursor rules.\n",
    ".github/copilot-instructions.md": "# Copilot\n\nKeep Copilot guidance.\n",
    ".windsurf/rules": "Keep Windsurf rules.\n"
  };

  try {
    for (const [file, content] of Object.entries(aiFiles)) {
      await writeFixtureFile(tempDir, file, content);
    }

    const result = runInit(tempDir);

    assert.equal(result.status, 0);
    for (const [file, content] of Object.entries(aiFiles)) {
      assert.equal(await readFile(path.join(tempDir, file), "utf8"), content);
      assert.match(
        result.stdout,
        new RegExp(`Detected ${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\. RCC did not modify it\\. RCC workflow was generated at docs\\/ai-context\\/RCC_WORKFLOW\\.md\\.`)
      );
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init --update-agent-file modifies only AGENTS.md", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");
  const claudePath = path.join(tempDir, "CLAUDE.md");

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "# Project Agents\n\nManual owner guidance.\n");
    await writeFixtureFile(tempDir, "CLAUDE.md", "# Claude\n\nDo not touch.\n");

    const result = runInit(tempDir, ["--update-agent-file"]);
    const agents = await readFile(agentsPath, "utf8");
    const claude = await readFile(claudePath, "utf8");

    assert.equal(result.status, 0);
    assert.match(agents, /Manual owner guidance\./);
    assert.equal(workflowSection(agents), expectedWorkflowSection);
    assert.equal(claude, "# Claude\n\nDo not touch.\n");
    assert.match(result.stdout, /Updated file: AGENTS\.md/);
    assert.match(result.stdout, /Detected CLAUDE\.md\. RCC did not modify it\./);
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
    assert.equal(content, minimalAgentsPointer);
    assert.equal(countOccurrences(content, "<!-- repo-context-center:workflow:start -->"), 0);
    assert.equal(countOccurrences(content, "RCC_WORKFLOW.md"), 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init does not modify existing markerless AGENTS.md legacy content", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", [
      "# Existing Agents",
      "",
      "Keep this project-specific guidance.",
      "",
      "## RCC Workflow",
      "",
      "For any coding task, the first shell command must be:",
      "",
      "`rcc work \"<task>\"`",
      "",
      "- Do not begin repository exploration, manual file reading, or broad searching before running `rcc work`.",
      "- Follow the read-first files from the work brief.",
      "- For targeted lookup, prefer `rcc find \"<keyword>\"` before broad grep/search.",
      "- Do not ask the human to run RCC commands.",
      "",
      "After meaningful changes:",
      "1. Run relevant tests.",
      "2. Run `rcc done --summary \"<summary>\" --files auto --verify \"<checks>\"`.",
      ""
    ].join("\n"));

    const result = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Keep this project-specific guidance\./);
    assert.match(content, /For any coding task, the first shell command must be:/);
    assert.doesNotMatch(content, /repo-context-center:workflow:start/);
    assert.match(result.stdout, /Detected AGENTS\.md\. RCC did not modify it/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init removes legacy generated AGENTS stub", async () => {
  const tempDir = await createTempRepo();
  const agentsPath = path.join(tempDir, "AGENTS.md");

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", [
      "# Existing Agents",
      "",
      "<!-- repo-context-center:workflow:start -->",
      "old workflow",
      "<!-- repo-context-center:workflow:end -->",
      "",
      "<!-- repo-context-center:generated:start -->",
      "## Generated Repo Map",
      "",
      "Compact generated entrypoint.",
      "",
      "- Start tasks with `rcc work \"<task>\"` before broad scanning.",
      "- Do not replace `rcc work` with manually reading `docs/ai-context` files.",
      "- For targeted lookup, prefer `rcc find \"<keyword>\"` before broad repo search.",
      "- Do not ask the human to run RCC commands.",
      "- Save completed-work memory with `rcc done --summary \"<summary>\" --files auto --verify \"<checks>\"`.",
      "- Generated repo maps live in `docs/ai-context/*`.",
      "- Keep manual guidance outside generated markers.",
      "",
      "_Generated by repo-context-center. Edit outside this section._",
      "<!-- repo-context-center:generated:end -->",
      ""
    ].join("\n"));

    const result = runInit(tempDir);
    const content = await readFile(agentsPath, "utf8");

    assert.equal(result.status, 0);
    assert.equal(workflowSection(content), expectedWorkflowSection);
    assert.equal(countOccurrences(content, "RCC_WORKFLOW.md"), 1);
    assert.doesNotMatch(content, /repo-context-center:generated:start/);
    assert.doesNotMatch(content, /Compact generated entrypoint\./);
    assert.doesNotMatch(content, /Generated repo maps live in `docs\/ai-context\/\*`/);
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
    assert.equal(countOccurrences(afterSecondAgents, "<!-- repo-context-center:workflow:start -->"), 0);
    assert.equal(countOccurrences(afterSecondAgents, "<!-- repo-context-center:generated:start -->"), 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init generates dedicated RCC workflow guidance", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runInit(tempDir);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "RCC_WORKFLOW.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /# RCC Workflow/);
    assert.match(content, /`rcc work "<task>" --agent`/);
    assert.match(content, /`rcc done --summary "<summary>" --files auto --verify "<checks>"`/);
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
    assert.doesNotMatch(content, /repo-context-center:workflow:start/);
    assert.match(result.stdout, /Detected AGENTS\.md\. RCC did not modify it/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("init dry-run does not write files", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runInit(tempDir, ["--dry-run"]);
    const agentsPreview = result.stdout.slice(0, result.stdout.indexOf("Would create file: docs/ai-context/COMMUNICATION_MODE.md"));

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Dry run complete/);
    assert.match(agentsPreview, /For the RCC repository workflow, read docs\/ai-context\/RCC_WORKFLOW\.md before coding tasks\./);

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
