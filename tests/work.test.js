const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8"
  });
}

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withWorkRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Auth or login work: read `src/auth/login.ts`, `tests/auth/login.test.ts`, and `docs/ai-context/RISK_REGISTER.md`."
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/RISK_REGISTER.md",
      [
        "# Risk Register",
        "",
        "| Area | Risk | Check |",
        "| --- | --- | --- |",
        "| `src/auth/login.ts` | Login regressions can block sign-in | Run `tests/auth/login.test.ts` |"
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/DECISIONS.md",
      [
        "# Decisions",
        "",
        "| Date | Decision | Reason | Status | Files |",
        "| --- | --- | --- | --- | --- |",
        "| 2026-06-16 | Keep login flow server-side | Avoid leaking session state | Active | src/auth/login.ts |"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("work runs without arguments", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work"], { cwd: tempDir });

    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^Usage: rcc work "<task>"/);
    assert.doesNotMatch(result.stdout, /Unspecified task/);
  });
});

test("work accepts a task string and recommends focused files", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Task intent:\nfix login bug/);
    assert.match(result.stdout, /Recommended files to inspect first:\n- src\/auth\/login\.ts/);
    assert.match(result.stdout, /Relevant tests or test folders:\n- tests\/auth\/login\.test\.ts/);
    assert.match(result.stdout, /Recent decisions \/ memory:\n- Decision: 2026-06-16 \| Keep login flow server-side/);
    assert.match(result.stdout, /Known risks:\n- high/);
    assert.match(result.stdout, /Next command after meaningful work:\nrcc done "<summary>" --files <files> --verify "<check>"/);
  });
});

test("work handles missing RCC files gracefully", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-empty-"));

  try {
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");

    const result = runCli(["work", "unknown task"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Recent decisions \/ memory:\n- none found/);
    assert.match(result.stdout, /Read first:\n- no RCC context files found; run npx repo-context-center init to install them/);
    assert.match(result.stdout, /rcc done "<summary>" --files <files> --verify "<check>"/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("work shows duplicate decisions only once", async () => {
  await withWorkRepo(async (tempDir) => {
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/DECISIONS.md",
      [
        "# Decisions",
        "",
        "| Date | Decision | Reason | Status | Files |",
        "| --- | --- | --- | --- | --- |",
        "| 2026-06-16 | Keep login flow server-side | Avoid leaking session state | Active | src/auth/login.ts |",
        "| 2026-06-17 | Keep login flow server-side | Avoid leaking session state | Active | src/auth/login.ts |"
      ].join("\n")
    );

    const result = runCli(["work", "fix login bug"], { cwd: tempDir });
    const matches = result.stdout.match(/Keep login flow server-side/g) ?? [];

    assert.equal(result.status, 0);
    assert.equal(matches.length, 1);
  });
});

test("work output is concise and agent-oriented", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });
    const lines = result.stdout.trim().split(/\r?\n/);

    assert.equal(result.status, 0);
    assert.ok(lines.length <= 40, `work output has ${lines.length} lines`);
    assert.doesNotMatch(result.stdout, /score/i);
    assert.doesNotMatch(result.stdout, /generate code/i);
    assert.match(result.stdout, /Recommended files to inspect first:/);
    assert.match(result.stdout, /Suggested|Next command after meaningful work:/);
  });
});
