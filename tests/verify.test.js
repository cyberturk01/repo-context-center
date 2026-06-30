const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const {
  buildVerificationPlan,
  buildVerificationPlanFromImpact,
  createVerificationPlan,
  createPlannedVerificationPlanFromImpact,
  createVerificationPlanFromImpact
} = require(path.join(repoRoot, "dist", "cli", "verify", "buildVerify.js"));
const {
  buildImpactAnalysis
} = require(path.join(repoRoot, "dist", "cli", "impact", "buildImpact.js"));
const {
  detectDomains,
  taskMentionsDomain
} = require(path.join(repoRoot, "dist", "core", "domainEngine.js"));

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
      confidence: "strong",
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

  const impact = {
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
  const domainMatches = overrides.domainMatches ?? detectDomains({
    task: impact.task,
    affectedFilePaths: affectedFiles.map((file) => file.path),
    affectedTestPaths: affectedTests.map((test) => test.path),
    contextPaths: contextChanges.map((file) => file.path),
    includeContext: true
  });

  Object.defineProperties(impact, {
    domainMatches: {
      value: domainMatches,
      enumerable: false,
      configurable: true
    },
    taskMentionsContext: {
      value: overrides.taskMentionsContext ?? taskMentionsDomain(impact.task, "context"),
      enumerable: false,
      configurable: true
    }
  });

  return impact;
}

function publicTargetedTests(tests) {
  return tests.map(({ score, signals, ...test }) => ({
    ...test,
    reason: compactPublicTestReason(test.reason, signals)
  }));
}

function compactPublicTestReason(reason, signals) {
  const signalSet = new Set(signals.map((signal) => signal.toLowerCase()));
  const lowerReason = reason.toLowerCase();

  if (
    signalSet.has("imports affected source")
    || signalSet.has("same directory")
    || signalSet.has("task/test name match")
  ) {
    return "exact source/test relationship";
  }

  if (signalSet.has("specific routed test name") || signalSet.has("task routing evidence") || /\btask[- ]routed|task routing\b/i.test(lowerReason)) {
    return "task-routed test";
  }

  if (signalSet.has("repository learning") || signalSet.has("co-change history") || /\blearned|repository learning|co-change\b/i.test(lowerReason)) {
    return "learned test relationship";
  }

  if (
    signalSet.has("same module")
    || signalSet.has("same package/module")
    || signalSet.has("same package/module with task token")
    || signalSet.has("filename similarity")
  ) {
    return "same-module test";
  }

  return "domain-matched test";
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
        confidence: "strong",
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
  assert.equal(plan.targetedTests[0].confidence, "strong");
  assert.equal(plan.targetedTests[0].priority, "high");
  assert.equal("score" in plan.targetedTests[0], false);
  assert.equal("signals" in plan.targetedTests[0], false);
  assert.deepEqual(plan.targetedTestCommands, []);
  assert.equal(plan.buildCommands[0].type, "build");
  assert.equal(plan.buildCommands[0].priority, "high");
  assert.equal(plan.smokeChecks[0].type, "cache-behavior");
  assert.equal(plan.smokeChecks[0].priority, "high");
  assert.equal("command" in plan.smokeChecks[0], false);
  assert.equal(plan.manualChecks[0].type, "config");
  assert.equal(plan.manualChecks[0].priority, "high");
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
  assert.deepEqual(plan.targetedTests.map(({ priority, ...test }) => test), publicTargetedTests(impact.affectedTests));
  assert.deepEqual(plan.targetedTestCommands.map((command) => command.command), [
    "node --test tests/cache/redis.spec.ts"
  ]);
  assert.deepEqual(plan.targetedTestCommands.map((command) => command.priority), ["high"]);
  assert.deepEqual(plan.buildCommands.map((command) => command.command), ["npm run build"]);
  assert.deepEqual(plan.buildCommands.map((command) => command.priority), ["high"]);
  assert.deepEqual(plan.smokeChecks.map((check) => check.type), ["cache-behavior"]);
  assert.deepEqual(plan.smokeChecks.map((check) => check.priority), ["high"]);
  assert.equal(plan.smokeChecks.some((check) => "command" in check), false);
  assert.equal(plan.confidence, impact.confidence);
  assert.equal(plan.confidenceExplanation.level, impact.confidenceExplanation.level);
  assert.deepEqual(plan.confidenceExplanation.evidence, impact.confidenceExplanation.evidence);
  assert.ok(plan.confidenceExplanation.reasons.includes("domain matched: cache"));
  assert.ok(plan.confidenceExplanation.reasons.includes("domain matched: redis"));
  assert.equal(plan.confidenceExplanation.reasons.some((reason) => reason.includes("src/cache/redis.ts")), false);
  assert.equal(plan.targetedTests[0].reason, "same-module test");
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "environment"
    && check.command === "redis-cli ping"
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "context-routing"
    && check.priority === "low"
    && check.paths.includes("docs/ai-context/TASK_ROUTING.md")
  )));
  assert.equal(plan.manualChecks.some((check) => check.type === "affected-files"), false);
  assert.deepEqual(plan.validationChecklist, [
    "Verify cache miss behavior.",
    "Verify cache hit behavior.",
    "Verify cache invalidation behavior.",
    "Verify Redis/cache backend unavailable fallback.",
    "Confirm RCC context changes are intentional."
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

  assert.deepEqual(plan.targetedTests.map(({ priority, ...test }) => test), publicTargetedTests(impact.affectedTests));
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
    affectedTests: [],
    suggestedCommands: []
  }));

  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "auth-flow"
    && /login\/logout flow/.test(check.reason)
    && check.paths.includes("src/auth/login.ts")
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "invalid-credentials"
    && /invalid credentials/.test(check.reason)
    && check.paths.includes("src/auth/login.ts")
  )));
  assert.ok(plan.confidenceExplanation.reasons.some((reason) => reason.startsWith("domain matched: auth")));
  assert.ok(plan.confidenceExplanation.reasons.some((reason) => reason.startsWith("domain matched: login")));
  assert.equal(plan.smokeChecks.some((check) => "command" in check), false);
  assert.deepEqual(plan.validationChecklist, [
    "Verify login flow.",
    "Verify logout flow.",
    "Verify invalid credentials behavior.",
    "Verify session expiration behavior."
  ]);
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
    && /cache miss and cache hit behavior/.test(check.reason)
    && check.paths.includes("src/cache/redis.ts")
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "cache-fallback"
    && /Redis or the cache backend is unavailable/.test(check.reason)
    && check.paths.includes("src/cache/redis.ts")
  )));
  assert.ok(plan.confidenceExplanation.reasons.some((reason) => reason.startsWith("domain matched: cache")));
  assert.ok(plan.confidenceExplanation.reasons.some((reason) => reason.startsWith("domain matched: redis")));
  assert.deepEqual(plan.validationChecklist, [
    "Verify cache miss behavior.",
    "Verify cache hit behavior.",
    "Verify cache invalidation behavior.",
    "Verify Redis/cache backend unavailable fallback."
  ]);
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
    && /workflow path/.test(check.reason)
    && check.paths.includes(".github/workflows/ci.yml")
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "yaml-syntax"
    && check.command === "yamllint .github/workflows/ci.yml"
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "workflow-triggers-secrets"
    && /required secrets/.test(check.reason)
  )));
  assert.deepEqual(plan.validationChecklist, [
    "Verify workflow syntax.",
    "Verify workflow trigger conditions.",
    "Verify workflow permissions.",
    "Verify required secrets."
  ]);
  assert.ok(plan.confidenceExplanation.reasons.some((reason) => reason.startsWith("domain matched: workflow")));
  assert.equal(plan.confidenceExplanation.reasons.some((reason) => reason.includes(".github/workflows/ci.yml")), false);
  assert.deepEqual(plan.targetedTestCommands, []);
});

test("update github workflow uses workflow checks with exact workflow evidence", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "update github workflow",
    affectedFiles: [
      {
        path: ".github/workflows/release.yml",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }));

  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "ci-workflow"
    && check.paths.includes(".github/workflows/release.yml")
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "workflow-lint"
    && check.command === "actionlint .github/workflows/release.yml"
  )));
  assert.ok(plan.confidenceExplanation.reasons.includes("domain matched: workflow"));
  assert.equal(plan.confidenceExplanation.reasons.some((reason) => reason.includes(".github/workflows/release.yml")), false);
});

test("github integration files do not get workflow lint without workflow YAML", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "update github workflow",
    affectedFiles: [
      {
        path: "src/api/githubController.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/api/githubController.spec.ts",
        reason: "task route matched github api test",
        score: 108,
        confidence: "strong",
        signals: ["filename similarity"]
      }
    ],
    suggestedCommands: []
  }));

  assert.equal(plan.smokeChecks.some((check) => check.type === "ci-workflow"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "workflow-lint"), false);
  assert.equal(plan.manualChecks.some((check) => check.command && check.command.includes("actionlint")), false);
  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "github-integration"
    && check.paths.includes("src/api/githubController.ts")
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "github-api-integration"
    && /request\/response contracts/.test(check.reason)
    && check.paths.includes("src/api/githubController.ts")
  )));
  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "backend-behavior"
    && /contract behavior/.test(check.reason)
  )));
  assert.ok(plan.confidenceExplanation.reasons.includes("domain matched: github-integration"));
  assert.equal(plan.confidenceExplanation.reasons.some((reason) => reason.includes("src/api/githubController.ts")), false);
});

test("update github workflow routed to API files stays GitHub integration only", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "update github workflow",
    affectedFiles: [
      {
        path: "src/controllers/githubWebhookController.ts",
        reason: "task routing matched"
      },
      {
        path: "src/integrations/githubClient.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/integrations/githubClient.spec.ts",
        reason: "task route matched github integration test",
        score: 110,
        confidence: "strong",
        signals: ["filename similarity"]
      }
    ],
    suggestedCommands: []
  }), "deep");

  assert.equal(plan.smokeChecks.some((check) => check.type === "ci-workflow"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "workflow-lint"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "workflow-triggers-secrets"), false);
  assert.ok(plan.smokeChecks.some((check) => check.type === "github-integration"));
  assert.ok(plan.manualChecks.some((check) => check.type === "github-api-integration"));
  assert.ok(plan.smokeChecks.some((check) => check.type === "backend-behavior"));
  assert.ok(plan.confidenceExplanation.reasons.includes("domain matched: github-integration"));
  assert.equal(plan.confidenceExplanation.reasons.includes("domain matched: workflow"), false);
});

test("actual workflow yaml keeps workflow lint and trigger checks", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "tighten ci workflow yaml",
    affectedFiles: [
      {
        path: ".github/workflows/deploy.yml",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }), "deep");

  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "ci-workflow"
    && check.paths.includes(".github/workflows/deploy.yml")
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "yaml-syntax"
    && check.command === "yamllint .github/workflows/deploy.yml"
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "workflow-lint"
    && check.command === "actionlint .github/workflows/deploy.yml"
  )));
  assert.ok(plan.manualChecks.some((check) => check.type === "workflow-triggers-secrets"));
  assert.ok(plan.confidenceExplanation.reasons.includes("domain matched: workflow"));
});

test("change postgres schema prioritizes backend database paths over UI-only references", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "change postgres schema",
    affectedFiles: [
      {
        path: "src/ui/PostgresIcon.tsx",
        reason: "task routing matched"
      },
      {
        path: "src/db/schema/postgres.sql",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }), "deep");

  const schemaCheck = plan.manualChecks.find((check) => check.type === "schema-compatibility");
  const rollbackCheck = plan.manualChecks.find((check) => check.type === "data-rollback-impact");

  assert.ok(schemaCheck);
  assert.ok(rollbackCheck);
  assert.deepEqual(schemaCheck.paths, ["src/db/schema/postgres.sql"]);
  assert.deepEqual(rollbackCheck.paths, ["src/db/schema/postgres.sql"]);
  assert.deepEqual(plan.validationChecklist, [
    "Verify migration compatibility.",
    "Verify rollback behavior.",
    "Verify existing data compatibility."
  ]);
  assert.equal(plan.manualChecks.some((check) => (
    check.type === "postgres-ui-reference"
    && check.paths.includes("src/ui/PostgresIcon.tsx")
  )), false);
});

test("postgres schema task with UI helper paths avoids database and UI smoke checks", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "change postgres schema",
    affectedFiles: [
      {
        path: "src/ui/PostgresIcon.tsx",
        reason: "task routing matched"
      },
      {
        path: "src/frontend/postgresLabelHelper.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }), "deep");

  assert.equal(plan.manualChecks.some((check) => check.type === "schema-compatibility"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "data-rollback-impact"), false);
  assert.equal(plan.smokeChecks.some((check) => check.type === "database-behavior"), false);
  assert.equal(plan.smokeChecks.some((check) => check.type === "frontend-ui"), false);
  assert.ok(plan.manualChecks.some((check) => check.type === "postgres-ui-reference"));
});

test("ui-only postgres paths stay low priority and avoid schema checks", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "change postgres icon",
    affectedFiles: [
      {
        path: "src/ui/PostgresIcon.tsx",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }), "deep");

  const uiCheck = plan.manualChecks.find((check) => check.type === "postgres-ui-reference");
  const uiSmoke = plan.smokeChecks.find((check) => check.type === "postgres-ui-reference");

  assert.ok(uiCheck);
  assert.ok(uiSmoke);
  assert.equal(uiCheck.priority, "low");
  assert.equal(uiSmoke.priority, "low");
  assert.equal(plan.manualChecks.some((check) => check.type === "schema-compatibility"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "data-rollback-impact"), false);
});

test("improve auth middleware adds session security checks without frontend-only smoke", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "improve auth middleware",
    affectedFiles: [
      {
        path: "src/auth/middleware.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/auth/middleware.spec.ts",
        reason: "task route matched auth middleware test",
        score: 120,
        confidence: "strong",
        signals: ["filename similarity"]
      }
    ],
    suggestedCommands: []
  }), "deep");

  assert.ok(plan.manualChecks.some((check) => (
    check.type === "security-session"
    && check.paths.includes("src/auth/middleware.ts")
  )));
  assert.equal(plan.smokeChecks.some((check) => check.type === "frontend-ui"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "frontend-regression"), false);
  assert.ok(plan.confidenceExplanation.reasons.includes("domain matched: auth"));
  assert.equal(plan.confidenceExplanation.reasons.some((reason) => reason.includes("src/auth/middleware.ts")), false);
});

test("redis cache task with frontend utility avoids visible UI smoke", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "add redis cache",
    affectedFiles: [
      {
        path: "src/frontend/cacheKeyUtils.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/frontend/cacheKeyUtils.spec.ts",
        reason: "task route matched cache utility test",
        score: 92,
        confidence: "strong",
        signals: ["filename similarity"]
      }
    ],
    suggestedCommands: []
  }), "deep");

  assert.ok(plan.smokeChecks.some((check) => check.type === "cache-behavior"));
  assert.equal(plan.smokeChecks.some((check) => check.type === "frontend-ui"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "frontend-regression"), false);
});

test("auth middleware task with UI and backend files keeps both domain checks precise", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "improve auth middleware",
    affectedFiles: [
      {
        path: "src/auth/middleware.ts",
        reason: "task routing matched"
      },
      {
        path: "src/components/LoginPanel.tsx",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }), "deep");

  assert.ok(plan.smokeChecks.some((check) => check.type === "auth-flow"));
  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "frontend-ui"
    && check.paths.includes("src/components/LoginPanel.tsx")
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "security-session"
    && check.paths.includes("src/auth/middleware.ts")
  )));
  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "backend-behavior"
    && check.paths.includes("src/auth/middleware.ts")
  )));
});

[
  {
    name: "auth",
    task: "update auth middleware",
    affectedFiles: ["src/auth/middleware.ts"],
    affectedTests: ["tests/auth/middleware.spec.ts"],
    expectedReason: "domain matched: auth",
    expectedManual: "invalid-credentials"
  },
  {
    name: "login",
    task: "fix login redirect",
    affectedFiles: ["src/session/login.ts"],
    affectedTests: ["tests/session/login.spec.ts"],
    expectedReason: "domain matched: login",
    expectedManual: "invalid-credentials"
  },
  {
    name: "cache",
    task: "adjust cache invalidation",
    affectedFiles: ["src/cache/store.ts"],
    affectedTests: ["tests/cache/store.spec.ts"],
    expectedReason: "domain matched: cache",
    expectedSmoke: "cache-behavior"
  },
  {
    name: "redis",
    task: "handle redis reconnect",
    affectedFiles: ["src/adapters/redis.ts"],
    affectedTests: ["tests/adapters/redis.spec.ts"],
    expectedReason: "domain matched: redis",
    expectedManual: "cache-fallback"
  },
  {
    name: "database",
    task: "add database migration",
    affectedFiles: ["src/db/migrations/add-users.sql"],
    affectedTests: ["tests/db/migrations.spec.ts"],
    expectedReason: "domain matched: database",
    expectedManual: "schema-compatibility"
  },
  {
    name: "postgres",
    task: "fix postgres query timeout",
    affectedFiles: ["src/db/postgresClient.ts"],
    affectedTests: ["tests/db/postgresClient.spec.ts"],
    expectedReason: "domain matched: postgres",
    expectedManual: "data-rollback-impact"
  },
  {
    name: "workflow",
    task: "update ci workflow",
    affectedFiles: [".github/workflows/ci.yml"],
    affectedTests: [],
    expectedReason: "domain matched: workflow",
    expectedManual: "workflow-triggers-secrets"
  },
  {
    name: "github-integration",
    task: "update github api integration",
    affectedFiles: ["src/api/githubController.ts"],
    affectedTests: ["tests/api/githubController.spec.ts"],
    expectedReason: "domain matched: github-integration",
    expectedManual: "github-api-integration",
    expectedSmoke: "github-integration"
  },
  {
    name: "frontend",
    task: "fix frontend profile card",
    affectedFiles: ["src/ui/ProfileCard.tsx"],
    affectedTests: ["tests/ui/ProfileCard.spec.tsx"],
    expectedReason: "domain matched: frontend",
    expectedSmoke: "frontend-ui"
  },
  {
    name: "backend",
    task: "update backend api route",
    affectedFiles: ["src/api/users.ts"],
    affectedTests: ["tests/api/users.spec.ts"],
    expectedReason: "domain matched: backend",
    expectedSmoke: "backend-behavior"
  },
  {
    name: "config",
    task: "change config defaults",
    affectedFiles: ["src/config/defaults.ts"],
    affectedTests: ["tests/config/defaults.spec.ts"],
    expectedReason: "domain matched: config",
    expectedManual: "config-load"
  },
  {
    name: "context",
    task: "refresh rcc context routing",
    affectedFiles: ["docs/ai-context/TASK_ROUTING.md"],
    affectedTests: [],
    contextChanges: ["docs/ai-context/TASK_ROUTING.md"],
    expectedReason: "domain matched: context",
    expectedManual: "context-routing"
  }
].forEach((fixture) => {
  test(`createVerificationPlanFromImpact adds ${fixture.name} domain verification hints`, () => {
    const plan = createVerificationPlanFromImpact(impactAnalysis({
      task: fixture.task,
      affectedFiles: fixture.affectedFiles.map((filePath) => ({
        path: filePath,
        reason: "task routing matched"
      })),
      affectedTests: fixture.affectedTests.map((filePath) => ({
        path: filePath,
        reason: "task route matched domain test",
        score: 92,
        confidence: "strong",
        signals: ["filename similarity"]
      })),
      contextChanges: (fixture.contextChanges ?? []).map((filePath) => ({
        path: filePath,
        reason: "changed in working tree"
      })),
      suggestedCommands: fixture.affectedTests.length > 0
        ? [{
          command: `node --test ${fixture.affectedTests.join(" ")}`,
          type: "test",
          scope: "focused",
          confidence: "high",
          reason: "run affected tests directly"
        }]
        : [],
      confidenceExplanation: confidenceExplanation({
        evidence: {
          changedFiles: fixture.contextChanges ? fixture.contextChanges.length : fixture.affectedFiles.length,
          nonContextChangedFiles: fixture.contextChanges ? 0 : fixture.affectedFiles.length,
          contextChanges: fixture.contextChanges ? fixture.contextChanges.length : 0,
          affectedFiles: fixture.affectedFiles.length,
          affectedTests: fixture.affectedTests.length,
          contextOnlyChanges: false,
          testRelationship: fixture.affectedTests.length > 0 ? "strong" : "none"
        }
      })
    }));

    assert.ok(plan.confidenceExplanation.reasons.some((reason) => reason.startsWith(fixture.expectedReason)));
    if (fixture.expectedManual) {
      assert.ok(plan.manualChecks.some((check) => check.type === fixture.expectedManual));
    }
    if (fixture.expectedSmoke) {
      assert.ok(plan.smokeChecks.some((check) => check.type === fixture.expectedSmoke));
    }

    if (fixture.affectedTests.length > 0) {
      assert.deepEqual(plan.targetedTests.map((item) => item.path), fixture.affectedTests);
      assert.deepEqual(plan.targetedTestCommands.map((command) => command.command), [
        `node --test ${fixture.affectedTests.join(" ")}`
      ]);
    } else {
      assert.deepEqual(plan.targetedTestCommands, []);
    }
  });
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
    "No strongly related tests were found; do not add generic tests."
  ]);
  assert.equal(plan.manualChecks.some((check) => check.type === "affected-files"), false);
  assert.ok(plan.notes.includes("Docs-only impact detected; no focused test command suggested."));
  assert.ok(plan.notes.includes("Docs-only impact detected; verify documentation changes manually."));
});

test("login task with no strong tests reports no strongly related tests", () => {
  const impact = impactAnalysis({
    task: "fix login bug",
    affectedFiles: [
      {
        path: "src/auth/login.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/auth/login.spec.ts",
        reason: "weak domain-only auth match",
        score: 54,
        confidence: "medium",
        signals: ["domain match"]
      },
      {
        path: "tests/auth/session.spec.ts",
        reason: "weak nearby auth match",
        score: 32,
        confidence: "weak",
        signals: ["nearby test"]
      }
    ],
    suggestedCommands: [
      {
        command: "npm test",
        type: "test",
        scope: "project",
        confidence: "medium",
        reason: "fallback full verification for broad or package-level impact"
      }
    ],
    confidenceExplanation: confidenceExplanation({
      level: "medium",
      evidence: {
        affectedFiles: 1,
        affectedTests: 2,
        testRelationship: "weak"
      }
    })
  });

  const plan = createVerificationPlanFromImpact(impact);

  assert.deepEqual(plan.targetedTests, []);
  assert.deepEqual(plan.targetedTestCommands, []);
  assert.deepEqual(plan.validationChecklist, [
    "Verify login flow.",
    "Verify logout flow.",
    "Verify invalid credentials behavior.",
    "Verify session expiration behavior."
  ]);
  assert.equal(plan.targetedTestCommands.some((command) => command.command === "npm test"), false);
  assert.ok(plan.smokeChecks.some((check) => check.type === "auth-flow"));
});

test("redis task promotes only strong Redis and cache tests into runnable targeted commands", () => {
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
        reason: "direct redis cache test",
        score: 120,
        confidence: "strong",
        signals: ["task routing evidence", "filename similarity"]
      },
      {
        path: "tests/cache/fallback.test.ts",
        reason: "direct cache fallback test",
        score: 110,
        confidence: "strong",
        signals: ["same module"]
      },
      {
        path: "tests/api/public.spec.ts",
        reason: "weak generic API test",
        score: 20,
        confidence: "weak",
        signals: ["weak generic route penalty"]
      }
    ],
    suggestedCommands: [
      {
        command: "npm test",
        type: "test",
        scope: "project",
        confidence: "medium",
        reason: "fallback full verification for broad or package-level impact"
      },
      {
        command: "npm run build",
        type: "build",
        scope: "project",
        confidence: "medium",
        reason: "verify TypeScript and generated CLI output"
      }
    ]
  });

  const plan = createVerificationPlanFromImpact(impact);

  assert.deepEqual(plan.targetedTests.map((test) => test.path), [
    "tests/cache/redis.spec.ts",
    "tests/cache/fallback.test.ts"
  ]);
  assert.deepEqual(plan.targetedTests.map((test) => test.confidence), ["strong", "strong"]);
  assert.deepEqual(plan.targetedTestCommands.map((command) => command.command), [
    "node --test tests/cache/redis.spec.ts tests/cache/fallback.test.ts"
  ]);
  assert.equal(plan.targetedTestCommands.some((command) => command.command === "npm test"), false);
  assert.ok(plan.smokeChecks.some((check) => check.type === "cache-behavior"));
});

test("verification recommendations carry priorities without planner output", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "fix auth database schema compatibility",
    affectedFiles: [
      {
        path: "src/auth/session.ts",
        reason: "task routing matched"
      },
      {
        path: "src/db/migrations/add-session-index.sql",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/auth/session.spec.ts",
        reason: "strong auth test",
        score: 120,
        confidence: "strong",
        signals: ["task routing evidence", "filename similarity"]
      }
    ],
    suggestedCommands: [
      {
        command: "npm run build",
        type: "build",
        scope: "project",
        confidence: "medium",
        reason: "verify TypeScript and generated CLI output"
      }
    ]
  }), "deep");

  assert.equal(plan.targetedTests[0].priority, "critical");
  assert.equal("score" in plan.targetedTests[0], false);
  assert.equal("signals" in plan.targetedTests[0], false);
  assert.equal(plan.targetedTestCommands[0].priority, "critical");
  assert.equal(plan.buildCommands[0].priority, "high");
  assert.equal(plan.smokeChecks.find((check) => check.type === "auth-flow").priority, "high");
  assert.equal(plan.manualChecks.find((check) => check.type === "security-session").priority, "high");
  assert.equal(plan.manualChecks.find((check) => check.type === "schema-compatibility").priority, "critical");
  assert.equal(plan.manualChecks.find((check) => check.type === "data-rollback-impact").priority, "high");
  assert.equal("executionPlan" in plan, false);
});

test("context routing review is low priority unless only context files changed", () => {
  const mixedPlan = createVerificationPlanFromImpact(impactAnalysis({
    task: "refresh rcc context routing",
    affectedFiles: [
      {
        path: "src/cli/verify/buildVerify.ts",
        reason: "changed in working tree"
      }
    ],
    affectedTests: [],
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ],
    suggestedCommands: [],
    confidenceExplanation: confidenceExplanation({
      evidence: {
        changedFiles: 2,
        nonContextChangedFiles: 1,
        contextChanges: 1,
        affectedFiles: 1,
        affectedTests: 0,
        contextOnlyChanges: false,
        testRelationship: "none"
      }
    })
  }));
  const contextOnlyPlan = createVerificationPlanFromImpact(impactAnalysis({
    task: "refresh rcc context routing",
    affectedFiles: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ],
    suggestedCommands: [],
    confidenceExplanation: confidenceExplanation({
      evidence: {
        changedFiles: 1,
        nonContextChangedFiles: 0,
        contextChanges: 1,
        affectedFiles: 1,
        affectedTests: 0,
        contextOnlyChanges: true,
        testRelationship: "none"
      }
    })
  }));

  assert.equal(mixedPlan.manualChecks.find((check) => check.type === "context-routing").priority, "low");
  assert.equal(contextOnlyPlan.manualChecks.find((check) => check.type === "context-changes").priority, "medium");
  assert.equal("executionPlan" in contextOnlyPlan, false);
});

test("auth task caps strong targeted tests for small tasks", () => {
  const impact = impactAnalysis({
    task: "fix auth bug",
    affectedFiles: [
      {
        path: "src/auth/middleware.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      "tests/auth/middleware.spec.ts",
      "tests/auth/session.spec.ts",
      "tests/auth/login.spec.ts",
      "tests/auth/logout.spec.ts"
    ].map((filePath, index) => ({
      path: filePath,
      reason: "strong auth test",
      score: 120 - index,
      confidence: "strong",
      signals: ["task routing evidence", "filename similarity"]
    })),
    suggestedCommands: []
  });

  const plan = createVerificationPlanFromImpact(impact);

  assert.deepEqual(plan.targetedTests.map((test) => test.path), [
    "tests/auth/middleware.spec.ts",
    "tests/auth/session.spec.ts",
    "tests/auth/login.spec.ts"
  ]);
  assert.deepEqual(plan.targetedTestCommands.map((command) => command.command), [
    "node --test tests/auth/middleware.spec.ts tests/auth/session.spec.ts tests/auth/login.spec.ts"
  ]);
  assert.ok(plan.smokeChecks.some((check) => check.type === "auth-flow"));
});

test("workflow task keeps workflow and config checks without generic targeted tests", () => {
  const impact = impactAnalysis({
    task: "improve github action config",
    affectedFiles: [
      {
        path: ".github/workflows/ci.yml",
        reason: "task routing matched"
      },
      {
        path: "package.json",
        reason: "workflow config matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/api/public.spec.ts",
        reason: "weak generic route match",
        score: 18,
        confidence: "weak",
        signals: ["weak generic route penalty"]
      }
    ],
    suggestedCommands: [
      {
        command: "npm test",
        type: "test",
        scope: "project",
        confidence: "medium",
        reason: "fallback full verification for broad or package-level impact"
      },
      {
        command: "npm run build",
        type: "build",
        scope: "project",
        confidence: "medium",
        reason: "verify TypeScript and generated CLI output"
      }
    ],
    confidenceExplanation: confidenceExplanation({
      level: "medium",
      evidence: {
        affectedFiles: 2,
        affectedTests: 1,
        testRelationship: "weak"
      }
    })
  });

  const plan = createVerificationPlanFromImpact(impact);

  assert.deepEqual(plan.targetedTests, []);
  assert.deepEqual(plan.targetedTestCommands, []);
  assert.deepEqual(plan.validationChecklist, [
    "Verify workflow syntax.",
    "Verify workflow trigger conditions.",
    "Verify workflow permissions.",
    "Verify required secrets."
  ]);
  assert.ok(plan.smokeChecks.some((check) => check.type === "ci-workflow"));
  assert.ok(plan.manualChecks.some((check) => check.type === "workflow-lint"));
  assert.ok(plan.manualChecks.some((check) => check.type === "config-load"));
});

test("balanced verification normalizes overlapping checks and caps output", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "update frontend backend postgres github action config",
    affectedFiles: [
      {
        path: "src/ui/ProfileCard.tsx",
        reason: "task routing matched"
      },
      {
        path: "src/api/users.ts",
        reason: "task routing matched"
      },
      {
        path: "src/db/postgresClient.ts",
        reason: "task routing matched"
      },
      {
        path: ".github/workflows/ci.yml",
        reason: "task routing matched"
      },
      {
        path: "src/config/defaults.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }));

  assert.equal(plan.smokeChecks.length <= 2, true);
  assert.equal(plan.manualChecks.length <= 4, true);
  assert.equal(plan.manualChecks.some((check) => check.type === "frontend-regression"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "backend-contract"), false);
});

test("minimal verification keeps at most one smoke check and two manual checks", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "update auth postgres github action config",
    affectedFiles: [
      {
        path: "src/auth/session.ts",
        reason: "task routing matched"
      },
      {
        path: "src/db/postgresClient.ts",
        reason: "task routing matched"
      },
      {
        path: ".github/workflows/ci.yml",
        reason: "task routing matched"
      },
      {
        path: "src/config/defaults.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }), "minimal");

  assert.equal(plan.smokeChecks.length <= 1, true);
  assert.equal(plan.manualChecks.length <= 2, true);
});

test("deep verification deduplicates but does not apply balanced caps", () => {
  const plan = createVerificationPlanFromImpact(impactAnalysis({
    task: "update frontend backend postgres github action config",
    affectedFiles: [
      {
        path: "src/ui/ProfileCard.tsx",
        reason: "task routing matched"
      },
      {
        path: "src/api/users.ts",
        reason: "task routing matched"
      },
      {
        path: "src/db/postgresClient.ts",
        reason: "task routing matched"
      },
      {
        path: ".github/workflows/ci.yml",
        reason: "task routing matched"
      },
      {
        path: "src/config/defaults.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    suggestedCommands: []
  }), "deep");

  assert.equal(plan.manualChecks.some((check) => check.type === "frontend-regression"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "backend-contract"), false);
  assert.equal(plan.manualChecks.length > 4, true);
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
      paths: ["docs/ai-context/TASK_ROUTING.md"],
      priority: "medium"
    }
  ]);
  assert.deepEqual(plan.validationChecklist, [
    "Inspect context changes.",
    "Confirm RCC workflow/context changes are intentional.",
    "Run `rcc validate` if context files changed."
  ]);
  assert.ok(plan.notes.includes(
    "Context-only changes detected; verify focuses on RCC/context files and does not promote task-route estimates to targeted tests or smoke checks."
  ));
  assert.ok(plan.notes.includes("Context-only impact detected; verify context changes manually."));
});

test("planned mode promotes login task estimates without source changes", () => {
  const impact = impactAnalysis({
    task: "fix login bug",
    mode: "working-tree",
    affectedFiles: [
      {
        path: "src/auth/login.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/auth/login.spec.ts",
        reason: "task route matched auth test",
        score: 115,
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
        command: "node --test tests/auth/login.spec.ts",
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
    confidenceExplanation: confidenceExplanation({
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

  const plan = createPlannedVerificationPlanFromImpact(impact);

  assert.equal(plan.mode, "planned-task");
  assert.deepEqual(plan.targetedTests.map((test) => test.path), ["tests/auth/login.spec.ts"]);
  assert.deepEqual(plan.targetedTestCommands.map((command) => command.command), ["node --test tests/auth/login.spec.ts"]);
  assert.deepEqual(plan.buildCommands.map((command) => command.command), ["npm run build"]);
  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "auth-flow"
    && check.paths.includes("src/auth/login.ts")
  )));
  assert.equal(plan.manualChecks.some((check) => check.type === "context-routing"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "affected-files"), false);
  assert.equal(plan.confidenceExplanation.evidence.contextOnlyChanges, false);
  assert.equal(plan.confidenceExplanation.reasons[0], "task routing matched");
  assert.equal(plan.confidenceExplanation.reasons.includes("context-only changes detected"), false);
  assert.ok(plan.notes.includes(
    "Planned verification mode: plan uses task routing, impact analysis, and repository learning without requiring source code changes."
  ));
  assert.equal(plan.notes.some((note) => /context-only/i.test(note)), false);
  assert.equal(plan.notes.some((note) => /promoted task-route estimates/i.test(note)), false);
});

test("planned mode promotes redis task estimates without source changes", () => {
  const impact = impactAnalysis({
    task: "add redis cache",
    mode: "working-tree",
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ],
    confidenceExplanation: confidenceExplanation({
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

  const plan = createPlannedVerificationPlanFromImpact(impact);

  assert.equal(plan.mode, "planned-task");
  assert.deepEqual(plan.targetedTests.map((test) => test.path), ["tests/cache/redis.spec.ts"]);
  assert.deepEqual(plan.targetedTestCommands.map((command) => command.command), ["node --test tests/cache/redis.spec.ts"]);
  assert.deepEqual(plan.buildCommands.map((command) => command.command), ["npm run build"]);
  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "cache-behavior"
    && check.paths.includes("src/cache/redis.ts")
  )));
  assert.equal(plan.manualChecks.some((check) => check.type === "context-routing"), false);
  assert.equal(plan.confidenceExplanation.reasons.includes("domain matched: context"), false);
});

test("planned mode omits context-routing when no context changes exist", () => {
  const plan = createPlannedVerificationPlanFromImpact(impactAnalysis({
    task: "refresh rcc context routing",
    mode: "working-tree",
    affectedFiles: [
      {
        path: "src/cache/redis.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    contextChanges: [],
    suggestedCommands: [],
    confidenceExplanation: confidenceExplanation({
      evidence: {
        changedFiles: 0,
        nonContextChangedFiles: 0,
        contextChanges: 0,
        affectedFiles: 1,
        affectedTests: 0,
        contextOnlyChanges: false,
        testRelationship: "none"
      }
    })
  }));

  assert.equal(plan.mode, "planned-task");
  assert.equal(plan.manualChecks.some((check) => check.type === "context-routing"), false);
  assert.equal(plan.confidenceExplanation.reasons.includes("domain matched: context"), false);
});

test("planned mode promotes workflow task estimates without source changes", () => {
  const impact = impactAnalysis({
    task: "improve github action",
    mode: "working-tree",
    affectedFiles: [
      {
        path: ".github/workflows/ci.yml",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ],
    suggestedCommands: [
      {
        command: "npm run build",
        type: "build",
        scope: "project",
        confidence: "medium",
        reason: "verify TypeScript and generated CLI output"
      }
    ],
    confidenceExplanation: confidenceExplanation({
      evidence: {
        changedFiles: 1,
        nonContextChangedFiles: 0,
        contextChanges: 1,
        affectedFiles: 1,
        affectedTests: 0,
        contextOnlyChanges: true,
        testRelationship: "none"
      }
    })
  });

  const plan = createPlannedVerificationPlanFromImpact(impact);

  assert.equal(plan.mode, "planned-task");
  assert.deepEqual(plan.targetedTests, []);
  assert.deepEqual(plan.targetedTestCommands, []);
  assert.deepEqual(plan.buildCommands.map((command) => command.command), ["npm run build"]);
  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "ci-workflow"
    && check.paths.includes(".github/workflows/ci.yml")
  )));
  assert.equal(plan.manualChecks.some((check) => check.type === "context-routing"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "affected-files"), false);
});

test("planned auth verification output is normalized", () => {
  const plan = createPlannedVerificationPlanFromImpact(impactAnalysis({
    task: "update auth middleware",
    mode: "working-tree",
    affectedFiles: [
      {
        path: "src/auth/middleware.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/auth/middleware.spec.ts",
        reason: "task route matched auth test",
        score: 115,
        confidence: "strong",
        signals: ["task routing evidence", "filename similarity"]
      }
    ],
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ]
  }));

  assert.equal(plan.mode, "planned-task");
  assert.ok(plan.smokeChecks.some((check) => check.type === "auth-flow"));
  assert.ok(plan.manualChecks.some((check) => check.type === "invalid-credentials"));
  assert.equal(plan.manualChecks.some((check) => check.type === "context-routing"), false);
  assert.equal(plan.manualChecks.some((check) => check.type === "affected-files"), false);
  assert.equal(plan.manualChecks.length <= 4, true);
});

test("planned postgres verification output keeps database checks", () => {
  const plan = createPlannedVerificationPlanFromImpact(impactAnalysis({
    task: "fix postgres query timeout",
    mode: "working-tree",
    affectedFiles: [
      {
        path: "src/db/postgresClient.ts",
        reason: "task routing matched"
      }
    ],
    affectedTests: [
      {
        path: "tests/db/postgresClient.spec.ts",
        reason: "task route matched postgres test",
        score: 112,
        confidence: "strong",
        signals: ["task routing evidence", "filename similarity"]
      }
    ],
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ]
  }));

  assert.equal(plan.mode, "planned-task");
  assert.ok(plan.smokeChecks.some((check) => check.type === "database-behavior"));
  assert.ok(plan.manualChecks.some((check) => check.type === "schema-compatibility"));
  assert.ok(plan.manualChecks.some((check) => check.type === "data-rollback-impact"));
  assert.equal(plan.manualChecks.length <= 4, true);
});

test("planned github actions verification output is capped and executable", () => {
  const plan = createPlannedVerificationPlanFromImpact(impactAnalysis({
    task: "tighten github actions permissions",
    mode: "working-tree",
    affectedFiles: [
      {
        path: ".github/workflows/release.yaml",
        reason: "task routing matched"
      },
      {
        path: "package.json",
        reason: "workflow config matched"
      }
    ],
    affectedTests: [],
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ],
    suggestedCommands: []
  }));

  assert.equal(plan.mode, "planned-task");
  assert.ok(plan.smokeChecks.some((check) => check.type === "ci-workflow"));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "workflow-lint"
    && check.command === "actionlint .github/workflows/release.yaml"
  )));
  assert.ok(plan.manualChecks.some((check) => check.type === "workflow-triggers-secrets"));
  assert.equal(plan.manualChecks.some((check) => check.type === "context-routing"), false);
  assert.equal(plan.manualChecks.length <= 5, true);
});

test("planned mode keeps explicit context tasks secondary with context-only working tree", () => {
  const plan = createPlannedVerificationPlanFromImpact(impactAnalysis({
    task: "refresh rcc context routing",
    mode: "working-tree",
    affectedFiles: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "task routing matched"
      }
    ],
    affectedTests: [],
    contextChanges: [
      {
        path: "docs/ai-context/TASK_ROUTING.md",
        reason: "changed in working tree"
      }
    ],
    suggestedCommands: [],
    confidenceExplanation: confidenceExplanation({
      reasons: [
        "context-only changes detected",
        "task routing matched"
      ],
      evidence: {
        changedFiles: 1,
        nonContextChangedFiles: 0,
        contextChanges: 1,
        affectedFiles: 1,
        affectedTests: 0,
        contextOnlyChanges: true,
        testRelationship: "none"
      }
    })
  }));

  assert.equal(plan.mode, "planned-task");
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "context-routing"
    && check.priority === "low"
    && check.paths.includes("docs/ai-context/TASK_ROUTING.md")
  )));
  assert.equal(plan.confidenceExplanation.reasons.includes("domain matched: context"), true);
  assert.equal(plan.confidenceExplanation.reasons.includes("context-only changes detected"), false);
  assert.equal(
    plan.validationChecklist[plan.validationChecklist.length - 1],
    "Confirm RCC context changes are intentional."
  );
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

  assert.equal(plan.smokeChecks.some((check) => check.type === "ci-workflow"), false);
  assert.ok(plan.smokeChecks.some((check) => (
    check.type === "backend-behavior"
    && check.paths.includes("src/domain/service.ts")
  )));
  assert.ok(plan.manualChecks.some((check) => (
    check.type === "context-routing"
    && check.paths.includes(".github/workflows/ci.yml")
  )));
  assert.equal(plan.manualChecks.some((check) => check.type === "affected-files"), false);
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
  assert.equal(plan.manualChecks.some((check) => check.type === "affected-files"), false);
  assert.deepEqual(plan.validationChecklist, [
    "Verify cache miss behavior.",
    "Verify cache hit behavior.",
    "Verify cache invalidation behavior.",
    "Verify Redis/cache backend unavailable fallback."
  ]);
  assert.equal("affectedFiles" in plan, false);
  assert.equal("suggestedCommands" in plan, false);
});

test("buildVerificationPlanFromImpact matches buildVerificationPlan", async () => {
  const cwd = fixturePath("redis-cache");
  const task = "add redis cache";
  const impact = await buildImpactAnalysis(cwd, task, { taskOnly: true });
  const fromImpact = buildVerificationPlanFromImpact(impact);
  const fromCwdAndTask = await buildVerificationPlan(cwd, task, { taskOnly: true });

  assert.deepEqual(
    JSON.parse(JSON.stringify(fromImpact)),
    JSON.parse(JSON.stringify(fromCwdAndTask))
  );
});

test("buildVerificationPlanFromImpact preserves planned mode", async () => {
  const cwd = fixturePath("simple-auth");
  const task = "fix login bug";
  const impact = await buildImpactAnalysis(cwd, task, { taskOnly: true });
  const fromImpact = buildVerificationPlanFromImpact(impact, { planned: true });
  const fromCwdAndTask = await buildVerificationPlan(cwd, task, { planned: true, taskOnly: true });

  assert.equal(fromImpact.mode, "planned-task");
  assert.deepEqual(
    JSON.parse(JSON.stringify(fromImpact)),
    JSON.parse(JSON.stringify(fromCwdAndTask))
  );
});

test("verify --planned --json selects planned-task mode", () => {
  const result = runCli(["verify", "fix login bug", "--planned", "--json"], {
    cwd: fixturePath("simple-auth")
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");

  const plan = JSON.parse(result.stdout);

  assert.equal(plan.command, "verify");
  assert.equal(plan.task, "fix login bug");
  assert.equal(plan.mode, "planned-task");
  assert.equal(Array.isArray(plan.targetedTests), true);
  assert.equal(Array.isArray(plan.targetedTestCommands), true);
  assert.equal(Array.isArray(plan.buildCommands), true);
  assert.equal(Array.isArray(plan.smokeChecks), true);
  assert.equal(Array.isArray(plan.manualChecks), true);
});

test("verify --level minimal --json caps planned verification output", () => {
  const result = runCli(["verify", "fix login bug", "--planned", "--level", "minimal", "--json"], {
    cwd: fixturePath("simple-auth")
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");

  const plan = JSON.parse(result.stdout);

  assert.equal(plan.command, "verify");
  assert.equal(plan.mode, "planned-task");
  assert.equal(plan.smokeChecks.length <= 1, true);
  assert.equal(plan.manualChecks.length <= 2, true);
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
  assert.doesNotMatch(result.stdout, /Execution plan:/);
  assert.doesNotMatch(result.stdout, /estimatedMinutes|~\d+m/);
  assert.doesNotMatch(result.stdout, /Changed files:|Affected files:|Suggested commands:/);
  assert.doesNotMatch(result.stdout, /redis\.spec\.ts|worker\.spec\.ts|public\.spec\.ts/);
});

test("verify rejects invalid args", () => {
  const result = runCli(["verify", "--unknown"]);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Usage: rcc verify "<task>" \[--json\] \[--task-only\] \[--planned\]/);
});
