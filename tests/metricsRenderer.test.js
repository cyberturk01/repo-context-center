const assert = require("node:assert/strict");
const test = require("node:test");

function sampleMetrics() {
  return {
    schemaVersion: 1,
    command: "metrics",
    task: "fix login bug",
    ecosystem: {
      primary: "node",
      confidence: "high",
      detected: 1,
      signals: 2,
      roots: 1,
      monorepo: false,
      workspaceDetected: false,
      workspaceType: "none",
      packageScope: null,
      workspacePackages: 0,
      packageRoot: ".",
      ids: "node"
    },
    routing: {
      taskSize: "small",
      taskMode: "normal",
      taskSizeConfidence: "high",
      contextBudget: "balanced",
      primaryFiles: 2,
      supportingFiles: 3,
      optionalSupportingFiles: 1,
      tests: 1,
      readFirst: 2
    },
    tokens: {
      naiveTokens: 12345,
      rccTokens: 678,
      estimatedSavingTokens: 11667,
      estimatedSavingPercent: 94.5
    },
    freshness: {
      status: "fresh",
      score: 100,
      reason: "context is current",
      affectedFiles: 0,
      affectedContextFiles: 0
    },
    impact: {
      mode: "working-tree",
      basis: "changed-files-and-task",
      summary: {
        changedFiles: 1,
        contextChanges: 0,
        affectedFiles: 2,
        affectedTests: 1,
        suggestedCommands: 1
      },
      confidence: "high"
    },
    verification: {
      mode: "working-tree",
      targetedTests: 1,
      targetedTestCommands: 1,
      buildCommands: 1,
      smokeChecks: 0,
      manualChecks: 1,
      confidence: "high"
    }
  };
}

test("metrics JSON renderer preserves stable contract", () => {
  const { renderMetricsJson } = require("../dist/analytics/renderMetrics");
  const metrics = sampleMetrics();
  const output = renderMetricsJson(metrics);

  assert.equal(output, `${JSON.stringify(metrics, null, 2)}\n`);
  assert.deepEqual(Object.keys(JSON.parse(output)), [
    "schemaVersion",
    "command",
    "task",
    "ecosystem",
    "routing",
    "tokens",
    "freshness",
    "impact",
    "verification"
  ]);
});

test("metrics text renderer shows metric sections only", () => {
  const { renderMetricsText } = require("../dist/analytics/renderMetrics");
  const output = renderMetricsText(sampleMetrics());

  assert.match(output, /^repo-context-center metrics\n/);
  assert.match(output, /Task: fix login bug/);
  assert.match(output, /Ecosystem:\n- Primary: node/);
  assert.match(output, /- Workspace: none/);
  assert.match(output, /Routing:\n- Task size: small/);
  assert.match(output, /Token savings:\n- Naive tokens: 12,345/);
  assert.match(output, /- Estimated saving: 11,667 tokens \(94\.5%\)/);
  assert.match(output, /Freshness:\n- Status: fresh/);
  assert.match(output, /Impact:\n- Mode: working-tree/);
  assert.match(output, /Verification:\n- Mode: working-tree/);
  assert.doesNotMatch(output, /Run:|Usage:|Start with|Do not rerun|Confidence evidence:/);
  assert.equal(output.endsWith("\n"), true);
});
