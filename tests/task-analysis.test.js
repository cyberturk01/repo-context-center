const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const { buildTaskAnalysis } = require("../dist/core/task-analysis");

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

async function withTaskAnalysisRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-task-analysis-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Redis cache work: read `src/cache/redis.ts` and `tests/cache/redis.test.js`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "src/cache/redis.ts", "export function redisCache() { return true; }\n");
    await writeFixtureFile(tempDir, "tests/cache/redis.test.js", "test('redis cache', () => {});\n");
    await writeFixtureFile(tempDir, "tests/api/public.test.js", "test('public api', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("buildTaskAnalysis exposes the shared task analysis contract", async () => {
  await withTaskAnalysisRepo(async (cwd) => {
    const analysis = await buildTaskAnalysis(cwd, "update Redis cache behavior", {
      taskOnly: true,
      maxFiles: 20
    });

    assert.equal(analysis.task, "update Redis cache behavior");
    assert.equal(analysis.mode, "task-only");
    assert.equal(analysis.basis, "task");
    assert.ok(analysis.primaryFiles.some((file) => file.path === "src/cache/redis.ts"));
    assert.ok(analysis.affectedFiles.some((file) => file.path === "src/cache/redis.ts"));
    assert.ok(analysis.testCandidates.some((file) => file.path === "tests/cache/redis.test.js"));
    assert.equal(analysis.confidence.evidence.taskRoutingMatched, true);
    assert.ok(Array.isArray(analysis.contextChanges));
    assert.ok(Array.isArray(analysis.verification.commands));
  });
});

test("work and impact render the same shared test analysis", async () => {
  await withTaskAnalysisRepo(async (cwd) => {
    const workResult = runCli(["work", "update Redis cache behavior", "--agent"], { cwd });
    const impactResult = runCli(["impact", "update Redis cache behavior", "--task-only", "--json"], { cwd });

    assert.equal(workResult.status, 0, workResult.stderr || workResult.stdout);
    assert.equal(impactResult.status, 0, impactResult.stderr || impactResult.stdout);

    const workRoute = JSON.parse(workResult.stdout);
    const impactAnalysis = JSON.parse(impactResult.stdout);

    assert.ok(workRoute.tests.includes("tests/cache/redis.test.js"));
    assert.ok(impactAnalysis.affectedTests.some((file) => file.path === "tests/cache/redis.test.js"));
    assert.ok(!impactAnalysis.affectedTests.some((file) => file.path === "tests/api/public.test.js"));
  });
});
