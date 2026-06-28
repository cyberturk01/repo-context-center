const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8"
  });
}

function fixturePath(name) {
  return path.join(repoRoot, "fixtures", name);
}

test("verify --json renders TaskAnalysisResult verification fields", () => {
  const result = runCli(["verify", "add redis cache", "--task-only", "--json"], {
    cwd: fixturePath("redis-cache")
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /```/);

  const report = JSON.parse(result.stdout);

  assert.deepEqual(Object.keys(report).sort(), [
    "affectedFiles",
    "command",
    "confidence",
    "mode",
    "notes",
    "primaryFiles",
    "schemaVersion",
    "task",
    "testCandidates",
    "verification"
  ]);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.command, "verify");
  assert.equal(report.task, "add redis cache");
  assert.equal(report.mode, "task-only");
  assert.ok(report.primaryFiles.some((file) => file.path === "src/cache/redis.ts"));
  assert.ok(report.affectedFiles.some((file) => file.path === "src/cache/redis.ts"));
  assert.deepEqual(report.testCandidates.map((file) => file.path), ["tests/cache/redis.spec.ts"]);
  assert.equal(report.confidence.level, "high");
  assert.ok(Array.isArray(report.confidence.reasons));
  assert.ok(report.verification.commands.some((item) => item.command === "node --test tests/cache/redis.spec.ts"));
  assert.deepEqual(report.verification.hints, []);
  assert.equal("changedFiles" in report, false);
  assert.equal("suggestedCommands" in report, false);
});

test("verify text output stays a renderer and suppresses unrelated tests", () => {
  const result = runCli(["verify", "update translation", "--task-only"], {
    cwd: fixturePath("translations")
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^repo-context-center verify/);
  assert.match(result.stdout, /Task: update translation/);
  assert.match(result.stdout, /Test candidates:\n- none/);
  assert.match(result.stdout, /Verification commands:\n- npm test/);
  assert.doesNotMatch(result.stdout, /redis\.spec\.ts|worker\.spec\.ts|public\.spec\.ts/);
  assert.doesNotMatch(result.stdout, /Changed files:/);
});

test("verify rejects invalid args", () => {
  const result = runCli(["verify", "--unknown"]);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Usage: rcc verify "<task>"/);
});
