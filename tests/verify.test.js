const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const {
  createVerificationPlan,
  createVerificationPlanFromImpact
} = require(path.join(repoRoot, "dist", "cli", "verify", "buildVerify.js"));

function confidenceExplanation(overrides = {}) {
  return {
    level: overrides.level ?? "high",
    reasons: overrides.reasons ?? ["focused test maps to changed source"],
    evidence: {
      changedFiles: 1,
      nonContextChangedFiles: 1,
      contextChanges: 0,
      affectedFiles: 1,
      affectedTests: 1,
      taskRoutingMatched: true,
      filenameStemMatched: true,
      contextOnlyChanges: false,
      testRelationship: "strong",
      ...(overrides.evidence ?? {})
    }
  };
}

function impactAnalysis(overrides = {}) {
  const affectedTests = overrides.affectedTests ?? [
    {
      path: "tests/cache/redis.spec.ts",
      reason: "matches cache module",
      score: 96,
      confidence: "high",
      signals: ["same module", "filename match"]
    }
  ];
  const affectedFiles = overrides.affectedFiles ?? [
    {
      path: "src/cache/redis.ts",
      reason: "task routing matched"
    }
  ];
  const contextChanges = overrides.contextChanges ?? [];
  const suggestedCommands = overrides.suggestedCommands ?? [
    {
      command: "node --test tests/cache/redis.spec.ts",
      type: "test",
      scope: "focused",
      confidence: "high",
      reason: "exercise changed cache behavior"
    },
    {
      command: "npm run build",
      type: "build",
      scope: "project",
      confidence: "medium",
      reason: "verify TypeScript output"
    },
    {
      command: "npm run smoke",
      type: "verification",
      scope: "project",
      confidence: "low",
      reason: "exercise integrated cache startup"
    }
  ];

  return {
    schemaVersion: 1,
    command: "impact",
    task: overrides.task ?? "add redis cache",
    mode: overrides.mode ?? "task-only",
    basis: overrides.basis ?? "task",
    summary: overrides.summary ?? {
      changedFiles: 1,
      contextChanges: contextChanges.length,
      affectedFiles: affectedFiles.length,
      affectedTests: affectedTests.length,
      suggestedCommands: suggestedCommands.length
    },
    changedFiles: overrides.changedFiles ?? [],
    contextChanges,
    affectedFiles,
    affectedTests,
    suggestedCommands,
    confidence: overrides.confidence ?? "high",
    confidenceExplanation: overrides.confidenceExplanation ?? confidenceExplanation({
      evidence: {
        changedFiles: 1,
        contextChanges: contextChanges.length,
        affectedFiles: affectedFiles.length,
        affectedTests: affectedTests.length
      }
    }),
    verificationHints: overrides.verificationHints ?? [],
    notes: overrides.notes ?? []
  };
}

test("createVerificationPlan constructs the shared verification plan model", () => {
  const plan = createVerificationPlan({
    task: "add redis cache",
    mode: "task-only",
    summary: {
      changedFiles: 1,
      contextChanges: 0,
      affectedFiles: 1,
      affectedTests: 1,
      suggestedCommands: 3
    },
    targetedTests: [
      {
        path: "tests/cache/redis.spec.ts",
        reason: "matches cache module",
        score: 96,
        confidence: "high",
        signals: ["same module", "filename match"]
      }
    ],
    buildCommands: [
      {
        command: "npm run build",
        type: "build",
        scope: "project",
        confidence: "medium",
        reason: "verify TypeScript output"
      }
    ],
    smokeChecks: [
      {
        command: "node --test tests/cache/redis.spec.ts",
        type: "test",
        scope: "focused",
        confidence: "high",
        reason: "exercise changed cache behavior"
      }
    ],
    manualChecks: [
      {
        type: "config",
        reason: "confirm Redis URL is documented",
        paths: ["docs/ai-context/CHANGE_LOG.md"]
      }
    ],
    validationChecklist: [
      "Focused cache test passes",
      "Build still succeeds",
      "Redis configuration has a documented fallback"
    ],
    confidence: "high",
    confidenceExplanation: confidenceExplanation(),
    notes: ["No CLI command is exposed by this model-only implementation."]
  });

  assert.deepEqual(Object.keys(plan).sort(), [
    "buildCommands",
    "command",
    "confidence",
    "confidenceExplanation",
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
  assert.equal(plan.task, "add redis cache");
  assert.equal(plan.mode, "task-only");
  assert.equal(plan.confidence, "high");
  assert.equal(plan.confidenceExplanation.level, "high");
  assert.equal(plan.summary.suggestedCommands, 3);
  assert.equal(plan.targetedTests[0].path, "tests/cache/redis.spec.ts");
  assert.equal(plan.targetedTests[0].confidence, "high");
  assert.deepEqual(plan.targetedTestCommands, []);
  assert.equal(plan.buildCommands[0].type, "build");
  assert.equal(plan.smokeChecks[0].scope, "focused");
  assert.equal(plan.manualChecks[0].type, "config");
  assert.deepEqual(plan.validationChecklist, [
    "Focused cache test passes",
    "Build still succeeds",
    "Redis configuration has a documented fallback"
  ]);
  assert.equal(plan.notes[0], "No CLI command is exposed by this model-only implementation.");
});

test("createVerificationPlan defaults optional collections to empty arrays", () => {
  const plan = createVerificationPlan({
    task: "update copy",
    mode: "working-tree",
    summary: {
      changedFiles: 0,
      contextChanges: 0,
      affectedFiles: 0,
      affectedTests: 0,
      suggestedCommands: 0
    },
    confidence: "low",
    confidenceExplanation: confidenceExplanation({
      level: "low",
      reasons: ["no changed files or task routing evidence"],
      evidence: {
        changedFiles: 0,
        nonContextChangedFiles: 0,
        affectedFiles: 0,
        affectedTests: 0,
        taskRoutingMatched: false,
        filenameStemMatched: false,
        testRelationship: "none"
      }
    })
  });

  assert.deepEqual(plan.targetedTests, []);
  assert.deepEqual(plan.targetedTestCommands, []);
  assert.deepEqual(plan.buildCommands, []);
  assert.deepEqual(plan.smokeChecks, []);
  assert.deepEqual(plan.manualChecks, []);
  assert.deepEqual(plan.validationChecklist, []);
  assert.deepEqual(plan.notes, []);
  assert.equal(plan.confidence, "low");
});

test("createVerificationPlanFromImpact maps Impact affected tests and commands", () => {
  const impact = impactAnalysis({
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ],
    verificationHints: [
      {
        type: "environment",
        reason: "confirm Redis service is available",
        command: "redis-cli ping"
      }
    ]
  });

  const plan = createVerificationPlanFromImpact(impact);

  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.command, "verify");
  assert.equal(plan.task, impact.task);
  assert.equal(plan.mode, impact.mode);
  assert.deepEqual(plan.summary, impact.summary);
  assert.strictEqual(plan.targetedTests, impact.affectedTests);
  assert.deepEqual(plan.targetedTestCommands.map((command) => command.command), [
    "node --test tests/cache/redis.spec.ts"
  ]);
  assert.deepEqual(plan.buildCommands.map((command) => command.command), ["npm run build"]);
  assert.deepEqual(plan.smokeChecks.map((command) => command.command), ["npm run smoke"]);
  assert.equal(plan.confidence, impact.confidence);
  assert.deepEqual(plan.confidenceExplanation, impact.confidenceExplanation);
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "environment"
    && check.command === "redis-cli ping"
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "affected-files"
    && check.paths.includes("src/cache/redis.ts")
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "context-changes"
    && check.paths.includes("docs/ai-context/TASK_ROUTING.md")
  )));
  assert.ok(plan.validationChecklist.includes("Run targeted tests from Impact affectedTests."));
  assert.ok(plan.validationChecklist.includes("Run build commands from Impact suggestedCommands."));
  assert.ok(plan.validationChecklist.includes("Review affected files for behavior-specific manual checks."));
  assert.ok(plan.validationChecklist.includes("Review context changes for workflow or routing drift."));
});

test("createVerificationPlanFromImpact does not invent tests when Impact has no affected tests", () => {
  const impact = impactAnalysis({
    affectedTests: [],
    affectedFiles: [
      {
        path: "README.md",
        reason: "task routing matched"
      }
    ],
    suggestedCommands: [
      {
        command: "npm test",
        type: "test",
        scope: "project",
        confidence: "low",
        reason: "fallback command"
      }
    ],
    confidence: "medium",
    confidenceExplanation: confidenceExplanation({
      level: "medium",
      evidence: {
        affectedFiles: 1,
        affectedTests: 0,
        testRelationship: "none"
      }
    }),
    notes: ["Docs-only impact detected; no focused test command suggested."]
  });

  const plan = createVerificationPlanFromImpact(impact);

  assert.deepEqual(plan.targetedTests, []);
  assert.deepEqual(plan.targetedTestCommands, []);
  assert.deepEqual(plan.buildCommands, []);
  assert.deepEqual(plan.smokeChecks, []);
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "affected-files"
    && check.paths.includes("README.md")
  )));
  assert.ok(plan.notes.includes("Docs-only impact detected; no focused test command suggested."));
  assert.ok(plan.notes.includes("Docs-only impact detected; verify documentation changes manually."));
});

test("createVerificationPlanFromImpact adds context-only notes from Impact evidence", () => {
  const impact = impactAnalysis({
    affectedFiles: [],
    affectedTests: [],
    contextChanges: [
      {
        path: "AGENTS.md",
        reason: "changed in working tree"
      }
    ],
    suggestedCommands: [],
    confidence: "medium",
    confidenceExplanation: confidenceExplanation({
      level: "medium",
      evidence: {
        changedFiles: 1,
        nonContextChangedFiles: 0,
        contextChanges: 1,
        affectedFiles: 0,
        affectedTests: 0,
        contextOnlyChanges: true,
        testRelationship: "none"
      }
    })
  });

  const plan = createVerificationPlanFromImpact(impact);

  assert.deepEqual(plan.targetedTests, []);
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "context-changes"
    && check.paths.includes("AGENTS.md")
  )));
  assert.ok(plan.notes.includes("Context-only impact detected; verify context changes manually."));
});
