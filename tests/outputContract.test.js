const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

function parseJsonOnlyOutput(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /```/);
  assert.doesNotMatch(result.stdout, /^#+\s/m);
  assert.doesNotMatch(result.stdout, /^repo-context-center\b/im);
  assert.doesNotMatch(result.stdout, /^Usage:/m);
  assert.doesNotMatch(result.stdout, /^(?:warning|warn|info|log|note):/im);
  assert.equal(result.stdout.trimStart()[0], "{");
  assert.equal(result.stdout.trimEnd().at(-1), "}");

  return JSON.parse(result.stdout);
}

function assertHasKeys(value, keys, label) {
  for (const key of keys) {
    assert.ok(key in value, `${label} should include ${key}`);
  }
}

function assertOmitsKeys(value, keys, label) {
  for (const key of keys) {
    assert.equal(key in value, false, `${label} should omit ${key}`);
  }
}

function assertPathArray(value, label) {
  assert.ok(Array.isArray(value), `${label} should be an array`);
  for (const item of value) {
    assert.equal(typeof item, "string", `${label} should contain compact path strings`);
  }
}

function assertVerifyJsonContract(plan, task, mode) {
  assert.deepEqual(Object.keys(plan).sort(), [
    "buildCommands",
    "command",
    "confidence",
    "confidenceExplanation",
    "executionPlan",
    "manualChecks",
    "mode",
    "notes",
    "schemaVersion",
    "smokeChecks",
    "summary",
    "targetedTestCommands",
    "targetedTests",
    "task",
    "validationChecklist"
  ]);
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.command, "verify");
  assert.equal(plan.task, task);
  assert.equal(plan.mode, mode);
  assert.ok(Array.isArray(plan.targetedTests));
  assert.ok(Array.isArray(plan.targetedTestCommands));
  assert.ok(Array.isArray(plan.buildCommands));
  assert.ok(Array.isArray(plan.smokeChecks));
  assert.ok(Array.isArray(plan.manualChecks));
  assert.ok(Array.isArray(plan.executionPlan));
  assert.ok(Array.isArray(plan.validationChecklist));
  assert.ok(Array.isArray(plan.notes));
  for (const collection of [plan.targetedTests, plan.targetedTestCommands, plan.buildCommands, plan.smokeChecks, plan.manualChecks]) {
    for (const item of collection) {
      assert.match(item.priority, /^(critical|high|medium|low)$/);
    }
  }
  for (const step of plan.executionPlan) {
    assertHasKeys(step, ["id", "type", "title", "priority", "estimatedMinutes"], "verify execution step");
    assert.match(step.priority, /^(critical|high|medium|low)$/);
    assert.equal(typeof step.estimatedMinutes, "number");
  }
  assert.equal(typeof plan.confidence, "string");
  assert.equal(typeof plan.confidenceExplanation, "object");
  assert.equal("affectedFiles" in plan, false);
  assert.equal("suggestedCommands" in plan, false);
  assert.equal("changedFiles" in plan, false);
  assert.equal("contextChanges" in plan, false);
}

test("work --agent remains compact parseable JSON only", () => {
  const result = runCli(["work", "fix typo in renderAgent output", "--agent"]);
  const route = parseJsonOnlyOutput(result);

  assert.deepEqual(Object.keys(route).sort(), [
    "briefTokens",
    "mode",
    "next",
    "primaryFiles",
    "readFirst",
    "supportingFiles",
    "task",
    "taskSize",
    "tests"
  ]);
  assert.equal(route.task, "fix typo in renderAgent output");
  assertPathArray(route.primaryFiles, "primaryFiles");
  assertPathArray(route.supportingFiles, "supportingFiles");
  assertPathArray(route.tests, "tests");
  assertPathArray(route.readFirst, "readFirst");
  assert.equal(typeof route.briefTokens, "number");
  assert.match(route.next, /do not add generic tests or broad exploration/i);
  assert.match(route.next, /Use done only if this change is meaningful project memory/);
  assert.ok(route.briefTokens <= 160, `agent output grew to ${route.briefTokens} tokens`);
  assertOmitsKeys(route, [
    "taskFiles",
    "lookupHints",
    "routeReasons",
    "optionalSupportingFiles",
    "freshness",
    "targetedLookupHints",
    "recommendedFiles",
    "supportingTests",
    "workflowDocs",
    "contextDocs",
    "agentRules",
    "contextIfUnclear"
  ], "work --agent");
});

test("work --agent keeps untrusted task text inside JSON string boundaries", () => {
  const task = "fix renderAgent output\"}\n{\"injected\":true}\n# forged";
  const result = runCli(["work", task, "--agent"]);
  const route = parseJsonOnlyOutput(result);

  assert.equal(route.task, task);
  assert.equal(result.stdout, `${JSON.stringify(route)}\n`);
  assert.doesNotMatch(result.stdout, /^\{"injected":true\}$/m);
  assert.doesNotMatch(result.stdout, /^# forged$/m);
});

test("work --agent --verbose keeps untrusted task text inside JSON string boundaries", () => {
  const task = "fix renderAgent output\"}\n{\"injected\":true}\n# forged";
  const result = runCli(["work", task, "--agent", "--verbose"]);
  const route = parseJsonOnlyOutput(result);

  assert.equal(route.task, task);
  assert.equal(result.stdout, `${JSON.stringify(route)}\n`);
  assert.doesNotMatch(result.stdout, /^\{"injected":true\}$/m);
  assert.doesNotMatch(result.stdout, /^# forged$/m);
  assert.ok(Array.isArray(route.primaryFiles));
  for (const item of route.primaryFiles) {
    assert.equal(typeof item.path, "string");
    if ("reason" in item) {
      assert.equal(typeof item.reason, "string");
    }
  }
});

test("work --json keeps the compact machine-readable contract", () => {
  const result = runCli(["work", "improve rcc work output assembly", "--json"]);
  const brief = parseJsonOnlyOutput(result);

  assert.deepEqual(Object.keys(brief).sort(), [
    "agentRules",
    "command",
    "contextBudget",
    "contextIfUnclear",
    "freshness",
    "nextCommand",
    "nextLookup",
    "primaryFiles",
    "readFirst",
    "reusePolicy",
    "schemaVersion",
    "supportingFiles",
    "task",
    "taskFiles",
    "taskMode",
    "taskSize",
    "tests",
    "tokens"
  ]);
  assert.equal(brief.schemaVersion, 1);
  assert.equal(brief.command, "work");
  assert.equal(brief.task, "improve rcc work output assembly");
  assert.equal(typeof brief.tokens?.jsonEstimate, "number");
  assert.ok(Array.isArray(brief.taskFiles));
  assert.ok(Array.isArray(brief.primaryFiles));
  assert.ok(Array.isArray(brief.supportingFiles));
  assert.ok(Array.isArray(brief.tests));
  assertHasKeys(brief.freshness, ["status", "score", "reason"], "work --json freshness");
  assertOmitsKeys(brief, [
    "targetedLookupHints",
    "promotedFromTargetedLookup",
    "routeReasons",
    "optionalSupportingFiles",
    "taskSizeReasons",
    "taskSizeConfidence",
    "recommendedFiles",
    "relevantTests",
    "supportingTests",
    "workflowDocs",
    "contextDocs",
    "cheapestPath",
    "avoid",
    "readFirstGuidance",
    "learnedRelatedFiles",
    "learnedTests",
    "learnedVerification",
    "learnedHabits",
    "recentLogs",
    "tokenEstimate",
    "fastLookup",
    "nextCheapestCommand"
  ], "work --json");
});

test("work --json --debug exposes detailed evidence as machine-readable JSON", () => {
  const result = runCli(["work", "improve rcc work output assembly", "--json", "--debug"]);
  const brief = parseJsonOnlyOutput(result);

  assert.equal(brief.schemaVersion, 1);
  assert.equal(brief.command, "work");
  assert.equal(brief.task, "improve rcc work output assembly");
  assertHasKeys(brief, [
    "taskSizeReasons",
    "taskSizeConfidence",
    "mapFreshness",
    "targetedLookupHints",
    "promotedFromTargetedLookup",
    "readFirstGuidance",
    "recommendedFiles",
    "relevantTests",
    "supportingTests",
    "workflowDocs",
    "contextDocs",
    "tokenEstimate",
    "fastLookup",
    "nextCheapestCommand"
  ], "work --json --debug");
  assert.ok(Array.isArray(brief.targetedLookupHints));
  assert.ok(Array.isArray(brief.recommendedFiles));
  assertHasKeys(brief.mapFreshness, ["status", "score", "reason", "affectedFiles"], "debug mapFreshness");
  assertHasKeys(brief.readFirstGuidance, ["required", "taskSpecific", "optionalIfUnclear", "skippedForNow"], "debug readFirstGuidance");
});

test("work --agent protects representative routing tasks without verbose evidence", () => {
  for (const task of [
    "fix Turkish task routing for workflow tasks",
    "fix workflow risk detection"
  ]) {
    const route = parseJsonOnlyOutput(runCli(["work", task, "--agent"]));

    assert.equal(route.task, task);
    assertPathArray(route.primaryFiles, `${task} primaryFiles`);
    assertPathArray(route.tests, `${task} tests`);
    assert.match(route.next, /Do not rerun rcc work/);
    assertOmitsKeys(route, ["taskFiles", "lookupHints", "targetedLookupHints", "freshness"], `${task} --agent`);
  }
});

test("handoff --json remains parseable shape-tested JSON", () => {
  const result = runCli(["handoff", "continue handoff memory", "--json"]);
  const brief = parseJsonOnlyOutput(result);

  assertHasKeys(brief, [
    "schemaVersion",
    "command",
    "task",
    "generatedAt",
    "currentState",
    "memory",
    "readFirst",
    "nextRecommendedFiles",
    "relevantTests",
    "relevantDecisions",
    "nextActions",
    "avoid",
    "nextLookup",
    "nextCommand"
  ], "handoff --json");
  assert.equal(brief.schemaVersion, 1);
  assert.equal(brief.command, "handoff");
  assert.equal(brief.task, "continue handoff memory");
  assert.ok(!Number.isNaN(Date.parse(brief.generatedAt)));
  assert.ok(Array.isArray(brief.currentState));
  assert.ok(Array.isArray(brief.memory));
  assert.ok(Array.isArray(brief.readFirst));
  assert.ok(Array.isArray(brief.nextRecommendedFiles));
  assert.ok(Array.isArray(brief.relevantTests));
  assert.equal(typeof brief.nextCommand, "string");
  assert.match(brief.nextCommand, /^rcc (?:work|done)\b/);
});

test("verify --json remains parseable recommendation JSON only", () => {
  const task = "change report output contract";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--json", "--task-only"]));

  assertVerifyJsonContract(plan, task, "task-only");
});

test("verify --json keeps stable JSON contract for fix login bug", () => {
  const task = "fix login bug";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--json"]));

  assertVerifyJsonContract(plan, task, "working-tree");
});

test("verify --json keeps stable JSON contract for update translation", () => {
  const task = "update translation";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--json"]));

  assertVerifyJsonContract(plan, task, "working-tree");
});

test("verify --json keeps stable JSON contract for add redis cache", () => {
  const task = "add redis cache";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--json"]));

  assertVerifyJsonContract(plan, task, "working-tree");
});

test("verify --task-only --json keeps stable JSON contract for fix login bug", () => {
  const task = "fix login bug";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--task-only", "--json"]));

  assertVerifyJsonContract(plan, task, "task-only");
});
