const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const stableVerifyFields = [
  "schemaVersion",
  "command",
  "task",
  "mode",
  "summary",
  "targetedTests",
  "targetedTestCommands",
  "buildCommands",
  "smokeChecks",
  "manualChecks",
  "validationChecklist",
  "confidence",
  "confidenceExplanation",
  "notes"
];
const forbiddenVerifyFields = [
  "executionPlan",
  "estimatedMinutes",
  "verificationScore",
  "score",
  "coverage",
  "riskScore",
  "risk",
  "executionSteps"
];
const compactTargetedTestReasons = [
  "exact source/test relationship",
  "task-routed test",
  "domain-matched test",
  "same-module test",
  "learned test relationship"
];

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8"
  });
}

function fixturePath(name) {
  return path.join(repoRoot, "fixtures", name);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function runGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function writeFixtureFile(cwd, relativePath, content) {
  mkdirSync(path.dirname(path.join(cwd, relativePath)), { recursive: true });
  writeFileSync(path.join(cwd, relativePath), content);
}

function contextOnlyWorkingTreeFixture() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "rcc-verify-context-only-"));

  writeFixtureFile(cwd, "AGENTS.md", "Fixture repo guidance.\n");
  writeFixtureFile(cwd, "docs/ai-context/TASK_ROUTING.md", "# Task Routing\n\n- RCC context work: read `docs/ai-context/TASK_ROUTING.md`.\n");
  writeFixtureFile(cwd, "src/cache/redis.ts", "export function redisCache() { return true; }\n");
  writeFixtureFile(cwd, "tests/cache/redis.spec.ts", "test(\"redis cache\", () => {});\n");
  runGit(cwd, ["init"]);
  runGit(cwd, ["add", "."]);
  runGit(cwd, ["-c", "user.email=rcc@example.test", "-c", "user.name=RCC Test", "commit", "-m", "initial fixture"]);
  writeFixtureFile(cwd, "docs/ai-context/TASK_ROUTING.md", "# Task Routing\n\n- RCC context work: read `docs/ai-context/TASK_ROUTING.md`.\n- Updated context-only route note.\n");

  return cwd;
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

function collectKeys(value, keys = []) {
  if (!value || typeof value !== "object") {
    return keys;
  }

  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    if (child && typeof child === "object") {
      collectKeys(child, keys);
    }
  }

  return keys;
}

function assertNoRemovedVerifyFields(plan) {
  const keys = collectKeys(plan);

  for (const removedKey of forbiddenVerifyFields) {
    assert.equal(keys.includes(removedKey), false, `verify JSON should not expose ${removedKey}`);
  }
}

function assertCompactTargetedTestReasons(plan) {
  for (const item of plan.targetedTests) {
    assert.ok(
      compactTargetedTestReasons.includes(item.reason),
      `targeted test reason should be compact: ${item.reason}`
    );
  }
}

function assertCompactConfidenceReasons(plan) {
  for (const reason of plan.confidenceExplanation.reasons) {
    assert.equal(typeof reason, "string");
    assert.ok(reason.length <= 80, `confidence reason should stay compact: ${reason}`);
    assert.doesNotMatch(reason, /\b(?:src|app|lib|tests?|docs|\.github|fixtures)\//);
    assert.doesNotMatch(reason, /\([^)]*(?:\/|\\|affected file:|test path:|workflow path:|github integration path:)[^)]*\)/);
    assert.doesNotMatch(reason, /^(?:routing confidence|change confidence):/i);
    assert.notEqual(reason, "filename stem matched");
    assert.notEqual(reason, "weak test relationship");
    assert.notEqual(reason, "no test relationship");
  }
}

function assertPathArray(value, label) {
  assert.ok(Array.isArray(value), `${label} should be an array`);
  for (const item of value) {
    assert.equal(typeof item, "string", `${label} should contain compact path strings`);
  }
}

function assertVerifyJsonContract(plan, task, mode) {
  assert.deepEqual(Object.keys(plan).sort(), [...stableVerifyFields].sort());
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.command, "verify");
  assert.equal(plan.task, task);
  assert.equal(plan.mode, mode);
  assert.ok(Array.isArray(plan.targetedTests));
  assert.ok(Array.isArray(plan.targetedTestCommands));
  assert.ok(Array.isArray(plan.buildCommands));
  assert.ok(Array.isArray(plan.smokeChecks));
  assert.ok(Array.isArray(plan.manualChecks));
  assert.ok(Array.isArray(plan.validationChecklist));
  assert.ok(Array.isArray(plan.notes));
  for (const collection of [plan.targetedTests, plan.targetedTestCommands, plan.buildCommands, plan.smokeChecks, plan.manualChecks]) {
    for (const item of collection) {
      assert.match(item.priority, /^(critical|high|medium|low)$/);
    }
  }
  for (const item of plan.targetedTests) {
    assert.equal("score" in item, false);
    assert.equal("signals" in item, false);
  }
  assert.equal(typeof plan.confidence, "string");
  assert.equal(typeof plan.confidenceExplanation, "object");
  assert.equal("affectedFiles" in plan, false);
  assert.equal("suggestedCommands" in plan, false);
  assert.equal("changedFiles" in plan, false);
  assert.equal("contextChanges" in plan, false);
  assert.equal("executionPlan" in plan, false);
  assertNoRemovedVerifyFields(plan);
  assert.equal(plan.manualChecks.some((check) => check.type === "affected-files"), false);

  assertCompactTargetedTestReasons(plan);
  assertCompactConfidenceReasons(plan);
}

function informationalKeys(value, keys) {
  return keys.filter((key) => key in value);
}

function stableTestSnapshot(testItem) {
  return {
    path: testItem.path,
    confidence: testItem.confidence,
    priority: testItem.priority,
    informational: informationalKeys(testItem, ["reason"])
  };
}

function stableCommandSnapshot(command) {
  return {
    command: command.command,
    type: command.type,
    scope: command.scope,
    confidence: command.confidence,
    priority: command.priority,
    informational: informationalKeys(command, ["reason"])
  };
}

function stableCheckSnapshot(check) {
  return {
    type: check.type,
    paths: check.paths ?? [],
    command: check.command ?? null,
    priority: check.priority,
    informational: informationalKeys(check, ["reason"])
  };
}

function verifyStableContractSnapshot(plan) {
  return {
    schemaVersion: plan.schemaVersion,
    command: plan.command,
    mode: plan.mode,
    topLevelKeys: Object.keys(plan),
    summary: plan.summary,
    targetedTests: plan.targetedTests.map(stableTestSnapshot),
    targetedTestCommands: plan.targetedTestCommands.map(stableCommandSnapshot),
    buildCommands: plan.buildCommands.map(stableCommandSnapshot),
    smokeChecks: plan.smokeChecks.map(stableCheckSnapshot),
    manualChecks: plan.manualChecks.map(stableCheckSnapshot),
    validationChecklist: plan.validationChecklist,
    confidence: plan.confidence,
    informationalTopLevel: informationalKeys(plan, ["confidenceExplanation", "notes"])
  };
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
  assert.ok(plan.notes.includes("Working-tree verification mode: plan is based on actual repository changes."));
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

test("verify --planned --json makes planned mode explicit without changing contract", () => {
  const task = "fix login bug";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--planned", "--json"]));

  assertVerifyJsonContract(plan, task, "planned-task");
  assert.ok(plan.notes.includes(
    "Planned verification mode: plan uses task routing, impact analysis, and repository learning without requiring source code changes."
  ));
});

test("verify --planned --json freezes login public contract", () => {
  const task = "fix login bug";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--planned", "--json"], {
    cwd: fixturePath("simple-auth")
  }));

  assertVerifyJsonContract(plan, task, "planned-task");
  assert.ok(plan.smokeChecks.some((check) => check.type === "auth-flow"));
  assert.ok(plan.manualChecks.some((check) => check.type === "invalid-credentials"));
  assert.ok(plan.validationChecklist.includes("Verify login flow."));
  assert.ok(plan.validationChecklist.includes("Verify invalid credentials behavior."));
});

test("verify --planned --json freezes redis public contract", () => {
  const task = "add redis cache";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--planned", "--json"], {
    cwd: fixturePath("redis-cache")
  }));

  assertVerifyJsonContract(plan, task, "planned-task");
  assert.ok(plan.targetedTests.every((item) => compactTargetedTestReasons.includes(item.reason)));
  assert.ok(plan.smokeChecks.some((check) => check.type === "cache-behavior"));
  assert.ok(plan.manualChecks.some((check) => check.type === "cache-fallback"));
  assert.ok(plan.validationChecklist.includes("Verify cache miss behavior."));
  assert.ok(plan.validationChecklist.includes("Verify Redis/cache backend unavailable fallback."));
  assert.ok(plan.confidenceExplanation.reasons.includes("domain matched: redis"));
});

test("verify --planned --json freezes GitHub integration public contract", () => {
  const task = "update github api integration";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--planned", "--json"], {
    cwd: fixturePath("github-integration")
  }));

  assertVerifyJsonContract(plan, task, "planned-task");
  assert.ok(plan.smokeChecks.some((check) => check.type === "github-integration"));
  assert.ok(plan.manualChecks.some((check) => check.type === "github-api-integration"));
  assert.equal(plan.manualChecks.some((check) => check.type === "workflow-lint"), false);
  assert.ok(plan.validationChecklist.includes("Verify GitHub API/webhook contract behavior."));
  assert.ok(plan.validationChecklist.includes("Verify GitHub integration error handling."));
  assert.ok(plan.confidenceExplanation.reasons.includes("domain matched: github-integration"));
});

test("verify --planned --json freezes workflow YAML public contract", () => {
  const task = "tighten github actions permissions";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--planned", "--json"], {
    cwd: fixturePath("workflow-yaml")
  }));

  assertVerifyJsonContract(plan, task, "planned-task");
  assert.ok(plan.smokeChecks.some((check) => check.type === "ci-workflow"));
  assert.ok(plan.manualChecks.some((check) => check.type === "workflow-lint"));
  assert.ok(plan.manualChecks.some((check) => check.type === "workflow-triggers-secrets"));
  assert.ok(plan.validationChecklist.includes("Verify workflow syntax."));
  assert.ok(plan.validationChecklist.includes("Verify workflow permissions."));
  assert.ok(plan.confidenceExplanation.reasons.includes("domain matched: workflow"));
});

test("verify --json freezes context-only working-tree public contract", () => {
  const task = "refresh rcc context routing";
  const plan = parseJsonOnlyOutput(runCli(["verify", task, "--json"], {
    cwd: contextOnlyWorkingTreeFixture()
  }));

  assertVerifyJsonContract(plan, task, "working-tree");
  assert.deepEqual(plan.targetedTests, []);
  assert.deepEqual(plan.targetedTestCommands, []);
  assert.deepEqual(plan.buildCommands, []);
  assert.deepEqual(plan.smokeChecks, []);
  assert.deepEqual(plan.manualChecks.map((check) => check.type), ["context-changes"]);
  assert.deepEqual(plan.validationChecklist, [
    "Inspect context changes.",
    "Confirm RCC workflow/context changes are intentional.",
    "Run `rcc validate` if context files changed."
  ]);
  assert.equal(plan.confidence, "medium");
  assert.ok(plan.confidenceExplanation.reasons.includes("context-only changes detected"));
  assert.ok(plan.confidenceExplanation.reasons.includes("verify confidence reduced because only context files changed"));
});

test("verify --json stable contract snapshot for task-only fixture", () => {
  const plan = parseJsonOnlyOutput(runCli(["verify", "add redis cache", "--task-only", "--json"], {
    cwd: fixturePath("redis-cache")
  }));
  const snapshots = readJson("tests/fixtures/verify-json-contract-snapshots.json");

  assertVerifyJsonContract(plan, "add redis cache", "task-only");
  assert.deepEqual(
    verifyStableContractSnapshot(plan),
    snapshots["redis-cache task-only"]
  );
});

test("verify --planned --task-only --json stable contract snapshot for planned fixture", () => {
  const plan = parseJsonOnlyOutput(runCli(["verify", "fix login bug", "--planned", "--task-only", "--json"], {
    cwd: fixturePath("simple-auth")
  }));
  const snapshots = readJson("tests/fixtures/verify-json-contract-snapshots.json");

  assertVerifyJsonContract(plan, "fix login bug", "planned-task");
  assert.deepEqual(
    verifyStableContractSnapshot(plan),
    snapshots["simple-auth planned"]
  );
});

test("README documents verify JSON stable, informational, and internal fields", () => {
  const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");

  assert.match(readme, /`verify --json` is intended for long-lived integrations/);
  assert.match(readme, /Stable: top-level fields `schemaVersion`, `command`, `task`, `mode`, `summary`/);
  assert.match(readme, /`confidence`, `confidenceExplanation`, and `notes`/);
  assert.match(readme, /Compact informational wording: `reason`, `confidenceExplanation\.reasons`, and `notes`/);
  assert.match(readme, /Internal and intentionally omitted: execution plans, estimated minutes, coverage percentages, verification scores/);
});
