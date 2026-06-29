const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const {
  createVerificationPlan,
  createVerificationPlanFromImpact
} = require(path.join(repoRoot, "dist", "cli", "verify", "buildVerify.js"));

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8"
  });
}

function fixturePath(name) {
  return path.join(repoRoot, "fixtures", name);
}

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
        type: "cache-behavior",
        reason: "Manually check cache behavior and fallback behavior for the affected path.",
        paths: ["src/cache/redis.ts"]
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
    notes: ["Model construction test note."]
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
  assert.equal(plan.smokeChecks[0].type, "cache-behavior");
  assert.equal("command" in plan.smokeChecks[0], false);
  assert.equal(plan.manualChecks[0].type, "config");
  assert.deepEqual(plan.validationChecklist, [
    "Focused cache test passes",
    "Build still succeeds",
    "Redis configuration has a documented fallback"
  ]);
  assert.equal(plan.notes[0], "Model construction test note.");
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
  assert.deepEqual(plan.smokeChecks.map((check) => check.type), ["cache-behavior"]);
  assert.equal(plan.smokeChecks.some((check) => "command" in check), false);
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
  assert.deepEqual(plan.validationChecklist, [
    "Inspect affected files.",
    "Run targeted tests.",
    "Run build command.",
    "Perform smoke checks.",
    "Confirm RCC context changes are intentional.",
    "Record verification with `rcc done`."
  ]);
});

test("createVerificationPlanFromImpact preserves verification for non-context changed files", () => {
  const impact = impactAnalysis({
    changedFiles: [
      {
        path: "src/cache/redis.ts",
        reason: "changed in working tree"
      }
    ],
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ],
    confidenceExplanation: confidenceExplanation({
      evidence: {
        changedFiles: 2,
        nonContextChangedFiles: 1,
        contextChanges: 1,
        affectedFiles: 1,
        affectedTests: 1,
        contextOnlyChanges: false,
        testRelationship: "strong"
      }
    })
  });

  const plan = createVerificationPlanFromImpact(impact);

  assert.strictEqual(plan.targetedTests, impact.affectedTests);
  assert.deepEqual(plan.targetedTestCommands.map((command) => command.command), [
    "node --test tests/cache/redis.spec.ts"
  ]);
  assert.deepEqual(plan.buildCommands.map((command) => command.command), ["npm run build"]);
  assert.deepEqual(plan.smokeChecks.map((check) => check.type), ["cache-behavior"]);
});

test("createVerificationPlanFromImpact suggests a login/auth smoke check for fix login bug", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "fix login bug",
    affectedFiles: [
      {
        path: "src/auth/login.ts",
        reason: "task routing matched"
      }
    ],
    suggestedCommands: []
  }));

  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "auth-flow"
    && /login\/auth flow/.test(check.reason)
    && check.paths.includes("src/auth/login.ts")
  )));
  assert.equal(plan.smokeChecks.some((check) => "command" in check), false);
});

test("createVerificationPlanFromImpact suggests a UI text smoke check for update translation", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "update translation",
    affectedFiles: [
      {
        path: "src/i18n/translations.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }));

  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "ui-text"
    && /affected UI text/.test(check.reason)
    && check.paths.includes("src/i18n/translations.ts")
  )));
  assert.deepEqual(plan.targetedTestCommands, []);
});

test("createVerificationPlanFromImpact suggests cache and fallback smoke checks for add redis cache", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "add redis cache",
    affectedFiles: [
      {
        path: "src/cache/redis.ts",
        reason: "task routing matched"
      }
    ]
  }));

  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "cache-behavior"
    && /cache behavior and fallback behavior/.test(check.reason)
    && check.paths.includes("src/cache/redis.ts")
  )));
});

test("createVerificationPlanFromImpact suggests a workflow smoke check for improve github action", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "improve github action",
    affectedFiles: [
      {
        path: ".github/workflows/ci.yml",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }));

  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "ci-workflow"
    && /GitHub Action or CI workflow path/.test(check.reason)
    && check.paths.includes(".github/workflows/ci.yml")
  )));
  assert.deepEqual(plan.targetedTestCommands, []);
});

test("createVerificationPlanFromImpact suggests rendered docs review for update README wording", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "update README wording",
    affectedFiles: [
      {
        path: "README.md",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: [
      {
        command: "npm test",
        type: "test",
        scope: "project",
        confidence: "low",
        reason: "fallback command"
      }
    ],
    notes: ["Docs-only impact detected; no focused test command suggested."]
  }));

  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "docs-rendering"
    && /rendered Markdown or published docs/.test(check.reason)
    && check.paths.includes("README.md")
  )));
  assert.deepEqual(plan.targetedTests, []);
  assert.deepEqual(plan.targetedTestCommands, []);
  assert.equal(plan.smokeChecks.some((check) => "command" in check), false);
});

test("createVerificationPlanFromImpact does not invent tests when Impact has no affected tests", () => {
  const impact = impactAnalysis({
    task: "update README wording",
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
  assert.deepEqual(plan.smokeChecks.map((check) => check.type), ["docs-rendering"]);
  assert.deepEqual(plan.validationChecklist, [
    "Inspect affected files.",
    "No strongly related tests were found; do not add generic tests.",
    "Perform smoke checks.",
    "Record verification with `rcc done`."
  ]);
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "affected-files"
    && check.paths.includes("README.md")
  )));
  assert.ok(plan.notes.includes("Docs-only impact detected; no focused test command suggested."));
  assert.ok(plan.notes.includes("Docs-only impact detected; verify documentation changes manually."));
});

test("createVerificationPlanFromImpact is conservative for context-only route estimates", () => {
  const impact = impactAnalysis({
    task: "add redis cache",
    affectedFiles: [
      {
        path: "src/cache/redis.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/cache/redis.spec.ts",
        reason: "task route matched cache test",
        score: 120,
        confidence: "strong",
        signals: ["task routing evidence", "filename similarity"]
      }
    ],
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ],
    suggestedCommands: [
      {
        command: "node --test tests/cache/redis.spec.ts",
        type: "test",
        scope: "focused",
        confidence: "high",
        reason: "run affected tests directly"
      },
      {
        command: "npm run build",
        type: "build",
        scope: "project",
        confidence: "medium",
        reason: "verify TypeScript and generated CLI output"
      }
    ],
    confidence: "high",
    confidenceExplanation: confidenceExplanation({
      level: "high",
      reasons: [
        "context-only changes detected",
        "task routing matched",
        "strong test relationship"
      ],
      evidence: {
        changedFiles: 1,
        nonContextChangedFiles: 0,
        contextChanges: 1,
        affectedFiles: 1,
        affectedTests: 1,
        contextOnlyChanges: true,
        testRelationship: "strong"
      }
    })
  });

  const plan = createVerificationPlanFromImpact(impact);

  assert.equal(plan.confidence, "medium");
  assert.equal(plan.confidenceExplanation.level, "medium");
  assert.ok(plan.confidenceExplanation.reasons.includes("verify confidence reduced because only context files changed"));
  assert.deepEqual(plan.confidenceExplanation.evidence, impact.confidenceExplanation.evidence);
  assert.deepEqual(plan.targetedTests, []);
  assert.deepEqual(plan.targetedTestCommands, []);
  assert.deepEqual(plan.buildCommands, []);
  assert.deepEqual(plan.smokeChecks, []);
  assert.deepEqual(plan.manualChecks, [
    {
      type: "context-changes",
      reason: "Manually review context changes for workflow and routing impact.",
      paths: ["docs/ai-context/TASK_ROUTING.md"]
    }
  ]);
  assert.deepEqual(plan.validationChecklist, [
    "Inspect context changes.",
    "Confirm RCC workflow/context changes are intentional.",
    "Run `rcc validate` if context files changed.",
    "Record verification with `rcc done` only if the context change is meaningful."
  ]);
  assert.ok(plan.notes.includes(
    "Context-only changes detected; verify focuses on RCC/context files and does not promote task-route estimates to targeted tests or smoke checks."
  ));
  assert.ok(plan.notes.includes("Context-only impact detected; verify context changes manually."));
});

test("createVerificationPlanFromImpact does not let context paths trigger source smoke checks", () => {
  const impact = impactAnalysis({
    task: "refresh context",
    affectedFiles: [
      {
        path: "src/domain/service.ts",
        reason: "changed in working tree"
      }
    ],
    affectedTests: [],
    contextChanges: [
      {
        path: ".github/workflows/ci.yml",
        reason: "changed in working tree"
      },
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ],
    suggestedCommands: [],
    confidenceExplanation: confidenceExplanation({
      evidence: {
        changedFiles: 3,
        nonContextChangedFiles: 1,
        contextChanges: 2,
        affectedFiles: 1,
        affectedTests: 0,
        contextOnlyChanges: false,
        testRelationship: "none"
      }
    })
  });

  const plan = createVerificationPlanFromImpact(impact);

  assert.deepEqual(plan.smokeChecks, []);
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "affected-files"
    && check.paths.includes("src/domain/service.ts")
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "context-changes"
    && check.paths.includes(".github/workflows/ci.yml")
  )));
});

test("verify --json builds recommendations from Impact analysis", () => {
  const result = runCli(["verify", "add redis cache", "--task-only", "--json"], {
    cwd: fixturePath("redis-cache")
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /```/);

  const plan = JSON.parse(result.stdout);

  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.command, "verify");
  assert.equal(plan.task, "add redis cache");
  assert.equal(plan.mode, "task-only");
  assert.equal(plan.confidence, "high");
  assert.deepEqual(plan.targetedTests.map((test) => test.path), ["tests/cache/redis.spec.ts"]);
  assert.ok(plan.targetedTestCommands.some((command) => (
    command.command === "node --test tests/cache/redis.spec.ts"
    && command.type === "test"
  )));
  assert.ok(plan.buildCommands.some((command) => (
    command.command === "npm run build"
    && command.type === "build"
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "affected-files"
    && check.paths.includes("src/cache/redis.ts")
  )));
  assert.deepEqual(plan.validationChecklist, [
    "Inspect affected files.",
    "Run targeted tests.",
    "Run build command.",
    "Perform smoke checks.",
    "Record verification with `rcc done`."
  ]);
  assert.equal("affectedFiles" in plan, false);
  assert.equal("suggestedCommands" in plan, false);
});

test("verify text output is compact and recommendation-only", () => {
  const result = runCli(["verify", "update translation", "--task-only"], {
    cwd: fixturePath("translations")
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^repo-context-center verify/);
  assert.match(result.stdout, /Task: update translation/);
  assert.match(result.stdout, /Targeted tests:\n- none/);
  assert.match(result.stdout, /Targeted test commands:\n- none/);
  assert.match(result.stdout, /Manual checks:/);
  assert.match(result.stdout, /Validation checklist:\n- Inspect affected files\.\n- No strongly related tests were found; do not add generic tests\./);
  assert.match(result.stdout, /- Record verification with `rcc done`\./);
  assert.doesNotMatch(result.stdout, /Changed files:|Affected files:|Suggested commands:/);
  assert.doesNotMatch(result.stdout, /redis\.spec\.ts|worker\.spec\.ts|public\.spec\.ts/);
});

test("verify rejects invalid args", () => {
  const result = runCli(["verify", "--unknown"]);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Usage: rcc verify "<task>" \[--json\] \[--task-only\]/);
});
