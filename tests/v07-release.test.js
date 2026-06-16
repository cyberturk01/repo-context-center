const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, stat, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const workLogPath = path.join("docs", "ai-context", "WORK_LOG.md");

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

async function withTempRepo(prefix, callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));

  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withFocusedRepo(callback) {
  return withTempRepo("repo-context-center-v07-", async (tempDir) => {
    await writeFixtureFile(tempDir, "AGENTS.md", "# Agents\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Login work: read `src/auth/login.ts`, `tests/auth/login.test.ts`, and `docs/ai-context/RISK_REGISTER.md`."
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
        "| `src/auth/login.ts` | Login regressions block sign-in | Run `tests/auth/login.test.ts` |"
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
        "| 2026-06-16 | Keep login server-side | Avoid leaking session state | Active | src/auth/login.ts |"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");

    return callback(tempDir);
  });
}

function countOccurrences(content, text) {
  return content.split(text).length - 1;
}

test("v0.7 release: rcc work exists", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const cliStat = await stat(cliPath);
  const result = runCli(["work", "inspect release workflow"]);

  assert.equal(packageJson.bin.rcc, "dist/cli/index.js");
  assert.equal(cliStat.isFile(), true);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /repo-context-center work brief/);
});

test("v0.7 release: rcc work produces useful focused output", async () => {
  await withFocusedRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Task intent:\nfix login bug/);
    assert.match(result.stdout, /Recommended files to inspect first:\n- src\/auth\/login\.ts/);
    assert.match(result.stdout, /Relevant tests or test folders:\n- tests\/auth\/login\.test\.ts/);
    assert.match(result.stdout, /Recent decisions \/ memory:\n- Decision: 2026-06-16 \| Keep login server-side/);
    assert.match(result.stdout, /Known risks:\n- high/);
    assert.match(result.stdout, /Next command after meaningful work:\nrcc done --summary "<summary>" --files "<files>" --verify "<check>"/);
    assert.doesNotMatch(result.stdout, /rcc done "<summary>"/);
    assert.doesNotMatch(result.stdout, /score/i);
  });
});

test("v0.7 release: rcc work works with missing context files", async () => {
  await withTempRepo("repo-context-center-v07-empty-", async (tempDir) => {
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");

    const result = runCli(["work", "small change"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Recent decisions \/ memory:\n- none found/);
    assert.match(result.stdout, /Read first:\n- no RCC context files found; run npx repo-context-center init to install them/);
    assert.match(result.stdout, /rcc done --summary "<summary>" --files "<files>" --verify "<check>"/);
    assert.doesNotMatch(result.stdout, /rcc done "<summary>"/);
  });
});

test("v0.7 release: rcc done creates and appends memory", async () => {
  await withTempRepo("repo-context-center-v07-done-", async (tempDir) => {
    const first = runCli(["done", "Fixed login bug", "--files", "src/auth/login.ts"], { cwd: tempDir });
    const second = runCli(["done", "Added login regression test", "--verify", "npm test -- login"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    assert.match(first.stdout, /Saved work memory to docs\/ai-context\/WORK_LOG\.md/);
    assert.match(content, /# Work Log/);
    assert.match(content, /- Summary: Fixed login bug/);
    assert.match(content, /- Changed files: `src\/auth\/login\.ts`/);
    assert.match(content, /- Summary: Added login regression test/);
    assert.match(content, /- Verification: npm test -- login/);
    assert.ok(content.indexOf("Fixed login bug") < content.indexOf("Added login regression test"));
  });
});

test("v0.7 release: rcc done rejects empty summaries", async () => {
  await withTempRepo("repo-context-center-v07-done-empty-", async (tempDir) => {
    const result = runCli(["done", "   "], { cwd: tempDir });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: rcc done --summary "<summary>"/);
  });
});

test("v0.7 release: init creates or updates AGENTS.md", async () => {
  await withTempRepo("repo-context-center-v07-init-", async (tempDir) => {
    const created = runCli(["init"], { cwd: tempDir });
    const createdAgents = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");

    assert.equal(created.status, 0);
    assert.match(createdAgents, /## RCC Workflow/);
    assert.match(createdAgents, /Run `rcc work "<task>"`\./);

    await writeFixtureFile(tempDir, "AGENTS.md", "# Existing Agents\n\nKeep this guidance.\n");
    const updated = runCli(["init"], { cwd: tempDir });
    const updatedAgents = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");

    assert.equal(updated.status, 0);
    assert.match(updatedAgents, /# Existing Agents/);
    assert.match(updatedAgents, /Keep this guidance\./);
    assert.match(updatedAgents, /## RCC Workflow/);
    assert.match(updatedAgents, /Run `rcc done --summary "<summary>" --files "<files>" --verify "<check>"`\./);
  });
});

test("v0.7 release: init is idempotent", async () => {
  await withTempRepo("repo-context-center-v07-idempotent-", async (tempDir) => {
    const first = runCli(["init"], { cwd: tempDir });
    const second = runCli(["init"], { cwd: tempDir });
    const agents = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");

    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    assert.equal(countOccurrences(agents, "<!-- repo-context-center:workflow:start -->"), 1);
    assert.equal(countOccurrences(agents, "<!-- repo-context-center:workflow:end -->"), 1);
    assert.equal(countOccurrences(agents, "## RCC Workflow"), 1);
  });
});

test("v0.7 release: help output shows the new agent workflow clearly", () => {
  const result = runCli(["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Agent workflow:/);
  assert.match(result.stdout, /work\s+Print a concise work brief for an AI coding agent/);
  assert.match(result.stdout, /Usage: work "<task>"/);
  assert.match(result.stdout, /done\s+Save lightweight memory after completed agent work/);
  assert.match(result.stdout, /Usage: done --summary "<summary>" \[--files "<path,path>"\] \[--verify "<command\/result>"\] \[--dry-run\]/);
  assert.ok(result.stdout.indexOf("Agent workflow:") < result.stdout.indexOf("Commands:"));
});
