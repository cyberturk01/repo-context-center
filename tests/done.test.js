const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
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

async function withDoneRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-done-"));

  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("done creates memory file if missing", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli(["done", "Fixed login redirect bug"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Summary: Fixed login redirect bug/);
    assert.match(result.stdout, /RCC memory updated: docs\/ai-context\/WORK_LOG\.md/);
    assert.match(content, /# Work Log/);
    assert.match(content, /<!-- repo-context-center:work-log:start -->/);
    assert.match(content, /- Summary: Fixed login redirect bug/);
    assert.match(content, /- Changed files: _not detected_/);
  });
});

test("done appends new entry", async () => {
  await withDoneRepo(async (tempDir) => {
    const first = runCli(["done", "Fixed login redirect bug"], { cwd: tempDir });
    const second = runCli(["done", "Added coupon redemption tests", "--verify", "npm test -- coupons"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    assert.ok(content.indexOf("Fixed login redirect bug") < content.indexOf("Added coupon redemption tests"));
    assert.match(content, /- Verification: npm test -- coupons/);
  });
});

test("done preserves existing entries", async () => {
  await withDoneRepo(async (tempDir) => {
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/WORK_LOG.md",
      [
        "# Work Log",
        "",
        "Manual intro stays.",
        "",
        "<!-- repo-context-center:work-log:start -->",
        "## 2026-01-01T00:00:00.000Z",
        "- Summary: Existing work",
        "- Changed files: `src/existing.ts`",
        "<!-- repo-context-center:work-log:end -->",
        ""
      ].join("\n")
    );

    const result = runCli(["done", "Updated routing docs", "--risk", "low"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Manual intro stays\./);
    assert.match(content, /- Summary: Existing work/);
    assert.match(content, /- Summary: Updated routing docs/);
    assert.match(content, /- Risk: low/);
  });
});

test("done works without git", async () => {
  await withDoneRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");

    const result = runCli(["done", "Finished non-git task"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Changed files: not detected/);
    assert.match(content, /- Summary: Finished non-git task/);
  });
});

test("done --files auto detects changed files and filters RCC memory files", async () => {
  await withDoneRepo(async (tempDir) => {
    spawnSync("git", ["init"], { cwd: tempDir, encoding: "utf8" });
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");
    await writeFixtureFile(tempDir, "docs/ai-context/TASK_ROUTING.md", "# Routing\n");
    await writeFixtureFile(tempDir, ".repo-context-center/config.json", "{}\n");

    const result = runCli(["done", "--summary", "Recorded source edit", "--files", "auto"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Changed files: src\/index\.ts/);
    assert.doesNotMatch(result.stdout, /docs\/ai-context\/TASK_ROUTING\.md/);
    assert.doesNotMatch(result.stdout, /\.repo-context-center\/config\.json/);
    assert.match(content, /- Changed files: `src\/index\.ts`/);
    assert.doesNotMatch(content, /docs\/ai-context\/TASK_ROUTING\.md/);
    assert.doesNotMatch(content, /\.repo-context-center\/config\.json/);
  });
});

test("done --files none records no changed files", async () => {
  await withDoneRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");

    const result = runCli(["done", "--summary", "Recorded summary only", "--files", "none"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Changed files: none/);
    assert.match(content, /- Changed files: _none_/);
  });
});

test("done validates empty summary", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli(["done", "   "], { cwd: tempDir });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: rcc done --summary "<summary>"/);
  });
});

test("done output tells agent what was saved", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "Updated routing docs",
      "--verify",
      "npm test -- routing",
      "--risk",
      "low",
      "--follow-ups",
      "Refresh map after docs settle",
      "--files",
      "docs/ai-context/TASK_ROUTING.md,AGENTS.md"
    ], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Summary: Updated routing docs/);
    assert.match(result.stdout, /Changed files: docs\/ai-context\/TASK_ROUTING\.md, AGENTS\.md/);
    assert.match(result.stdout, /RCC memory updated: docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /Verification: npm test -- routing/);
    assert.match(result.stdout, /Risk: low/);
    assert.match(result.stdout, /Follow-ups: Refresh map after docs settle/);
  });
});

test("done writes structured handoff-friendly data", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Finished handoff integration",
      "--verify",
      "node --test tests/handoff.test.js",
      "--risk",
      "Parser should tolerate legacy entries",
      "--follow-ups",
      "Wire full handoff assembly",
      "--files",
      "src/cli/commands/done.ts,src/cli/handoff/handoffSources.ts"
    ], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");
    const match = content.match(/```json repo-context-center:done\s*\n(?<json>[\s\S]*?)\n```/);
    assert.ok(match);
    const entry = JSON.parse(match.groups.json);

    assert.equal(result.status, 0);
    assert.match(content, /- Summary: Finished handoff integration/);
    assert.match(content, /- Changed files: `src\/cli\/commands\/done\.ts`, `src\/cli\/handoff\/handoffSources\.ts`/);
    assert.equal(entry.schemaVersion, 1);
    assert.equal(entry.command, "done");
    assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(entry.summary, "Finished handoff integration");
    assert.deepEqual(entry.files, ["src/cli/commands/done.ts", "src/cli/handoff/handoffSources.ts"]);
    assert.equal(entry.verification, "node --test tests/handoff.test.js");
    assert.deepEqual(entry.followUps, ["Wire full handoff assembly"]);
    assert.deepEqual(entry.risks, ["Parser should tolerate legacy entries"]);
  });
});

test("done dry-run does not write work log", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli(["done", "Preview routing docs", "--verify", "npm test -- routing", "--dry-run"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /RCC memory would update: docs\/ai-context\/WORK_LOG\.md/);
    await assert.rejects(() => readFile(path.join(tempDir, workLogPath), "utf8"), { code: "ENOENT" });
  });
});

test("done help documents auto and none file modes", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli(["done", "--help"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /--files auto\|none\|"<path,path>"/);
    assert.match(result.stdout, /--files auto\s+Detect changed files from git status/);
    assert.match(result.stdout, /--files none\s+Record no changed files/);
  });
});
