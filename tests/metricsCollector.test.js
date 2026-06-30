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
    assert.deepEqual(metrics.ecosystem, {
      primary: "unknown",
      confidence: "none",
      detected: 0,
      signals: 0,
      roots: 0,
      monorepo: false,
      packageRoot: null,
      ids: ""
    });
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

  assert.match(source, /buildTaskAnalysis/);
  assert.match(source, /buildWorkBriefFromTaskContext/);
  assert.match(source, /toAgentRoute/);
  assert.match(source, /buildMeasureReportFromRoute/);
  assert.match(source, /buildImpactAnalysisFromTaskContext/);
  assert.match(source, /buildVerificationPlanFromImpact/);
  assert.equal((source.match(/buildTaskAnalysis\(cwd, task/g) ?? []).length, 2);
  assert.doesNotMatch(source, /\bbuildWorkBriefForTask\(/);
  assert.doesNotMatch(source, /\bbuildAgentWorkRoute\(/);
  assert.doesNotMatch(source, /\bbuildMeasureReport\(/);
  assert.doesNotMatch(source, /\bbuildImpactAnalysis\(/);
  assert.doesNotMatch(source, /\bbuildVerificationPlan\(/);
  assert.doesNotMatch(source, /from "\.\.\/core\/(?:scanner|repoMapper|tokenEstimator|fileSystem)"/);
  assert.doesNotMatch(source, /from "node:fs/);
});

test("metrics collector exposes compact counts instead of raw arrays", async () => {
  await withMetricsRepo(async (tempDir) => {
    const { buildRepositoryMetrics } = require("../dist/analytics/metricsCollector");
    const metrics = await buildRepositoryMetrics(tempDir, "fix login bug");

    function assertCompact(value, label) {
      assert.equal(Array.isArray(value), false, `${label} should not expose raw arrays`);

      if (!value || typeof value !== "object") {
        return;
      }

      for (const [key, child] of Object.entries(value)) {
        assertCompact(child, `${label}.${key}`);
      }
    }

    assertCompact(metrics, "metrics");
  });
});

test("metrics collector exposes compact ecosystem detection without changing routing counts", async () => {
  await withMetricsRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
    const { buildRepositoryMetrics } = require("../dist/analytics/metricsCollector");
    const metrics = await buildRepositoryMetrics(tempDir, "fix login bug");

    assert.equal(metrics.ecosystem.primary, "node");
    assert.equal(metrics.ecosystem.confidence, "high");
    assert.equal(metrics.ecosystem.monorepo, false);
    assert.equal(metrics.ecosystem.packageRoot, ".");
    assert.equal(metrics.ecosystem.ids, "node");
    assert.equal(typeof metrics.routing.primaryFiles, "number");
    assert.equal(typeof metrics.verification.targetedTests, "number");
  });
});
