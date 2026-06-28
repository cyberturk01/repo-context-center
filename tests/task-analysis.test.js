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
        "- Redis cache work: read `src/cache/redis.ts` and `tests/cache/redis.test.js`.",
        "- Auth login work: read `src/auth/login.ts` and `tests/auth/auth.spec.ts`.",
        "- Auth middleware work: read `src/auth/middleware.ts`, `tests/auth/auth.spec.ts`, and `tests/cache/redis.test.js`.",
        "- Translation work: read `src/i18n/translate.ts`, `tests/cache/redis.test.js`, `tests/queue/worker.test.js`, and `tests/api/public.test.js`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "src/cache/redis.ts", "export function redisCache() { return true; }\n");
    await writeFixtureFile(tempDir, "tests/cache/redis.test.js", "test('redis cache', () => {});\n");
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() { return true; }\n");
    await writeFixtureFile(tempDir, "src/auth/middleware.ts", "export function authMiddleware() { return true; }\n");
    await writeFixtureFile(tempDir, "tests/auth/auth.spec.ts", "test('auth login', () => {});\n");
    await writeFixtureFile(tempDir, "src/i18n/translate.ts", "export function translate() { return ''; }\n");
    await writeFixtureFile(tempDir, "tests/queue/worker.test.js", "test('queue worker', () => {});\n");
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
    const redisTest = analysis.testCandidates.find((file) => file.path === "tests/cache/redis.test.js");
    assert.ok(redisTest);
    assert.equal(redisTest.relationshipType, "direct-test");
    assert.ok(analysis.testClassifications.some((file) => file.path === "tests/cache/redis.test.js"));
    assert.equal(analysis.confidence.evidence.taskRoutingMatched, true);
    assert.ok(Array.isArray(analysis.contextChanges));
    assert.ok(Array.isArray(analysis.verification.commands));
  });
});

test("test candidates are classified before scoring", async () => {
  await withTaskAnalysisRepo(async (cwd) => {
    const analysis = await buildTaskAnalysis(cwd, "fix auth login", {
      taskOnly: true,
      maxFiles: 20
    });
    const authTest = analysis.testCandidates.find((file) => file.path === "tests/auth/auth.spec.ts");
    const redisClassification = analysis.testClassifications.find((file) => file.path === "tests/cache/redis.test.js");

    assert.ok(authTest);
    assert.equal(authTest.relationshipType, "direct-test");
    assert.ok(redisClassification);
    assert.equal(redisClassification.relationshipType, "unrelated");
    assert.ok(!analysis.testCandidates.some((file) => file.path === "tests/cache/redis.test.js"));
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

test("task analysis requires direct relationships before recommending tests", async () => {
  await withTaskAnalysisRepo(async (cwd) => {
    const translation = await buildTaskAnalysis(cwd, "update translation strings", {
      taskOnly: true,
      maxFiles: 20
    });
    const auth = await buildTaskAnalysis(cwd, "improve auth middleware", {
      taskOnly: true,
      maxFiles: 20
    });

    assert.deepEqual(translation.testCandidates, []);
    assert.ok(auth.testCandidates.some((file) => file.path === "tests/auth/auth.spec.ts"));
    assert.ok(!auth.testCandidates.some((file) => file.path === "tests/cache/redis.test.js"));
    assert.ok(!auth.testCandidates.some((file) => file.path === "tests/api/public.test.js"));
  });
});
