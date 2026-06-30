const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withMetricsRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-metrics-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Fixture repo guidance.\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Auth or login work: read `src/auth/login.ts` and `tests/auth/login.test.ts`."
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/MODULE_INDEX.md",
      [
        "# Module Index",
        "",
        "| Path | Owns | Read When |",
        "| --- | --- | --- |",
        "| `src/auth/login.ts` | Auth login | login work |"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "docs/ai-context/DO_NOT_READ.md", "- `node_modules/`\n- `dist/`\n");
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() { return true; }\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");
    await writeFixtureFile(tempDir, "README.md", "# Fixture\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("metrics collector summarizes existing RCC builder outputs", async () => {
  await withMetricsRepo(async (tempDir) => {
    const { buildRepositoryMetrics } = require("../dist/analytics/metricsCollector");
    const { buildWorkBriefForTask } = require("../dist/cli/work/buildWorkBrief");
    const { buildImpactAnalysis } = require("../dist/cli/impact/buildImpact");
    const { buildVerificationPlanFromImpact } = require("../dist/cli/verify/buildVerify");
    const { buildMeasureReport } = require("../dist/cli/measure/buildMeasure");
    const task = "fix login bug";

    const [metrics, work, impact, measure] = await Promise.all([
      buildRepositoryMetrics(tempDir, task),
      buildWorkBriefForTask(tempDir, task),
      buildImpactAnalysis(tempDir, task),
      buildMeasureReport(tempDir, task)
    ]);
    const verify = buildVerificationPlanFromImpact(impact);

    assert.equal(metrics.schemaVersion, 1);
    assert.equal(metrics.command, "metrics");
    assert.equal(metrics.task, task);
    assert.deepEqual(metrics.routing, {
      taskSize: work.taskSize,
      taskMode: work.taskMode,
      taskSizeConfidence: work.taskSizeConfidence,
      contextBudget: work.contextBudget,
      primaryFiles: work.primaryFiles.length,
      supportingFiles: work.supportingFiles.length,
      optionalSupportingFiles: work.optionalSupportingFiles.length,
      tests: work.tests.length,
      readFirst: work.readFirst.length
    });
    assert.deepEqual(metrics.tokens, {
      naiveTokens: measure.naiveTokens,
      rccTokens: measure.rccTokens,
      estimatedSavingTokens: measure.estimatedSavingTokens,
      estimatedSavingPercent: measure.estimatedSavingPercent
    });
    assert.deepEqual(metrics.freshness, {
      status: work.mapFreshness.status,
      score: work.mapFreshness.score,
      reason: work.mapFreshness.reason,
      affectedFiles: work.mapFreshness.affectedFiles.length,
      affectedContextFiles: work.mapFreshness.affectedContextFiles.length
    });
    assert.deepEqual(metrics.impact, {
      mode: impact.mode,
      basis: impact.basis,
      summary: impact.summary,
      confidence: impact.confidence
    });
    assert.deepEqual(metrics.verification, {
      mode: verify.mode,
      targetedTests: verify.targetedTests.length,
      targetedTestCommands: verify.targetedTestCommands.length,
      buildCommands: verify.buildCommands.length,
      smokeChecks: verify.smokeChecks.length,
      manualChecks: verify.manualChecks.length,
      confidence: verify.confidence
    });
  });
});

test("metrics collector depends on command builders instead of repository scanners", async () => {
  const source = await readFile(path.join(repoRoot, "src", "analytics", "metricsCollector.ts"), "utf8");

  assert.match(source, /buildWorkBriefForTask/);
  assert.match(source, /buildImpactAnalysis/);
  assert.match(source, /buildVerificationPlanFromImpact/);
  assert.match(source, /buildMeasureReport/);
  assert.doesNotMatch(source, /from "\.\.\/core\/(?:scanner|repoMapper|tokenEstimator|task-analysis|fileSystem)"/);
  assert.doesNotMatch(source, /from "node:fs/);
});
