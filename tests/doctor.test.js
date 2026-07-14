const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
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

async function withDoctorRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-memory-"));

  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function workLogContent(body) {
  return [
    "# Work Log",
    "",
    "Lightweight RCC memory from completed agent work.",
    "",
    "<!-- repo-context-center:work-log:start -->",
    body,
    "<!-- repo-context-center:work-log:end -->",
    ""
  ].join("\n");
}

test("doctor reports healthy RCC memory files", async () => {
  await withDoctorRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, workLogPath, workLogContent([
      "## 2026-07-14T10:00:00Z",
      "- Small completed task",
      "- files: README.md"
    ].join("\n")));

    const result = runCli(["doctor"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /RCC memory files:/);
    assert.match(result.stdout, /docs\/ai-context\/WORK_LOG\.md: healthy \(~\d+ tokens; warn 4000, compact 8000\)/);
    assert.doesNotMatch(result.stdout, /WORK_LOG\.md is above the warning threshold/);
    assert.doesNotMatch(result.stdout, /WORK_LOG\.md is oversized/);
  });
});

test("doctor warns about oversized RCC memory files and explains the fix", async () => {
  await withDoctorRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, workLogPath, workLogContent([
      "## 2026-07-14T10:00:00Z",
      `- ${"Large memory entry ".repeat(2200)}`,
      "- files: src/large.ts"
    ].join("\n")));

    const result = runCli(["doctor"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /docs\/ai-context\/WORK_LOG\.md: oversized \(~\d+ tokens; warn 4000, compact 8000\)/);
    assert.match(result.stdout, /Warning: docs\/ai-context\/WORK_LOG\.md is oversized\./);
    assert.match(result.stdout, /Run `rcc archive --keep 50 --compact-work-log`/);
    assert.match(result.stdout, /future `rcc done` runs will also try to compact\/archive it automatically/);
  });
});
