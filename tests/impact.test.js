const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const { normalizeImpactPath } = require("../dist/cli/impact/buildImpact");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8"
  });
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
}

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withImpactRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-impact-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Auth or login work: read `src/auth/login.ts`, `tests/auth/login.test.js`, and `package.json`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "package.json", JSON.stringify({ scripts: { test: "node --test tests/*.test.js" } }, null, 2));
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() { return true; }\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.js", "test('login', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withDocsOnlyImpactRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-impact-docs-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- README work: read `README.md`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "README.md", "# Project\n\nOld wording.\n");
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");
    await writeFixtureFile(tempDir, "tests/index.test.js", "test('ok', () => {});\n");

    runGit(["init"], tempDir);
    runGit(["config", "user.email", "test@example.com"], tempDir);
    runGit(["config", "user.name", "Test User"], tempDir);
    runGit(["add", "."], tempDir);
    runGit(["commit", "-m", "initial"], tempDir);

    await writeFixtureFile(tempDir, "README.md", "# Project\n\nBetter wording.\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withNamedImpactRepo(dirname, callback) {
  const parentDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-impact-named-"));
  const tempDir = path.join(parentDir, dirname);

  try {
    await mkdir(tempDir, { recursive: true });

    return await callback(tempDir);
  } finally {
    await rm(parentDir, { recursive: true, force: true });
  }
}

test("normalizeImpactPath keeps output relative to analyzed repo root", async () => {
  await withNamedImpactRepo("ai-project-guardian", async (cwd) => {
    await writeFixtureFile(cwd, "tests/markdownReport.test.ts", "test('markdown', () => {});\n");

    assert.equal(
      normalizeImpactPath("ai-project-guardian/tests/markdownReport.test.ts", cwd),
      "tests/markdownReport.test.ts"
    );
    assert.equal(
      normalizeImpactPath("tests/markdownReport.test.ts", cwd),
      "tests/markdownReport.test.ts"
    );
    assert.equal(
      normalizeImpactPath(path.join(cwd, "tests", "markdownReport.test.ts"), cwd),
      "tests/markdownReport.test.ts"
    );
    assert.equal(
      normalizeImpactPath("other-repo/tests/markdownReport.test.ts", cwd),
      "other-repo/tests/markdownReport.test.ts"
    );

    await writeFixtureFile(cwd, "ai-project-guardian/tests/nested.test.ts", "test('nested', () => {});\n");
    assert.equal(
      normalizeImpactPath("ai-project-guardian/tests/nested.test.ts", cwd),
      "ai-project-guardian/tests/nested.test.ts"
    );
  });

  await withNamedImpactRepo("Ai-project-guardian", async (cwd) => {
    await writeFixtureFile(cwd, "ai-project-guardian/tests/markdownReport.test.ts", "test('markdown', () => {});\n");

    assert.equal(
      normalizeImpactPath("ai-project-guardian/tests/markdownReport.test.ts", cwd),
      "tests/markdownReport.test.ts"
    );
  });
});

test("impact --json returns task-based affected files and commands", async () => {
  await withImpactRepo(async (cwd) => {
    const result = runCli(["impact", "update login flow", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stderr, "");
    assert.doesNotMatch(result.stdout, /```/);

    const analysis = JSON.parse(result.stdout);

    assert.equal(analysis.schemaVersion, 1);
    assert.equal(analysis.command, "impact");
    assert.equal(analysis.task, "update login flow");
    assert.equal(analysis.basis, "task");
    assert.deepEqual(Object.keys(analysis.summary).sort(), [
      "affectedFiles",
      "affectedTests",
      "changedFiles",
      "contextChanges",
      "suggestedCommands"
    ]);
    assert.deepEqual(analysis.summary, {
      changedFiles: analysis.changedFiles.length,
      contextChanges: analysis.contextChanges.length,
      affectedFiles: analysis.affectedFiles.length,
      affectedTests: analysis.affectedTests.length,
      suggestedCommands: analysis.suggestedCommands.length
    });
    assert.ok(Array.isArray(analysis.changedFiles));
    assert.ok(Array.isArray(analysis.contextChanges));
    assert.ok(Array.isArray(analysis.affectedFiles));
    assert.ok(Array.isArray(analysis.affectedTests));
    assert.ok(Array.isArray(analysis.suggestedCommands));
    assert.equal(analysis.confidence, analysis.confidenceExplanation.level);
    assert.equal(analysis.confidenceExplanation.evidence.taskRoutingMatched, true);
    assert.equal(analysis.confidenceExplanation.evidence.filenameStemMatched, true);
    assert.equal(analysis.confidenceExplanation.evidence.testRelationship, "strong");
    assert.ok(analysis.confidenceExplanation.reasons.includes("task routing matched"));
    assert.ok(analysis.confidenceExplanation.reasons.includes("filename stem matched"));
    assert.deepEqual(analysis.changedFiles, []);
    assert.ok(analysis.affectedFiles.some((file) => file.path === "src/auth/login.ts"));
    assert.ok(analysis.affectedTests.some((file) => file.path === "tests/auth/login.test.js"));
    const testCommand = analysis.suggestedCommands.find((item) => item.command.includes("tests/auth/login.test.js"));
    assert.ok(testCommand);
    assert.equal(testCommand.type, "test");
    assert.equal(testCommand.scope, "focused");
    assert.equal(testCommand.confidence, "high");
  });
});

test("impact includes git working-tree changes and paired tests", async () => {
  await withImpactRepo(async (cwd) => {
    runGit(["init"], cwd);
    runGit(["config", "user.email", "test@example.com"], cwd);
    runGit(["config", "user.name", "Test User"], cwd);
    runGit(["add", "."], cwd);
    runGit(["commit", "-m", "initial"], cwd);

    await writeFixtureFile(cwd, "src/auth/login.ts", "export function login() { return false; }\n");

    const result = runCli(["impact", "fix login regression", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const analysis = JSON.parse(result.stdout);

    assert.equal(analysis.basis, "changed-files-and-task");
    assert.equal(analysis.confidence, "high");
    assert.ok(analysis.confidenceExplanation.reasons.includes("changed files detected"));
    assert.ok(analysis.confidenceExplanation.reasons.includes("strong test relationship"));
    assert.equal(analysis.confidenceExplanation.evidence.nonContextChangedFiles, 1);
    assert.ok(analysis.changedFiles.some((file) => file.path === "src/auth/login.ts"));
    assert.ok(analysis.affectedFiles.some((file) => file.path === "src/auth/login.ts"));
    assert.ok(analysis.affectedTests.some((file) => file.path === "tests/auth/login.test.js"));
    assert.ok(analysis.suggestedCommands.some((item) => (
      item.command === "node --test tests/auth/login.test.js"
      && item.type === "test"
      && item.scope === "focused"
      && item.confidence === "high"
    )));
  });
});

test("impact normalizes learned prefixed test paths before focused command suggestions", async () => {
  await withNamedImpactRepo("ai-project-guardian", async (cwd) => {
    await writeFixtureFile(cwd, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(cwd, "src/reports/markdownReport.ts", "export function markdownReport() { return ''; }\n");
    await writeFixtureFile(cwd, "tests/markdownReport.test.ts", "test('markdown report', () => {});\n");
    await writeFixtureFile(
      cwd,
      "docs/ai-context/REPOSITORY_LEARNING.md",
      [
        "# Repository Learning",
        "",
        "## Common File Relationships",
        "",
        "| Source | Related | Reason | Count |",
        "| --- | --- | --- | ---: |",
        "| markdown report | ai-project-guardian/tests/markdownReport.test.ts | tested by | 2 |"
      ].join("\n")
    );

    const result = runCli(["impact", "change markdown report output contract", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const analysis = JSON.parse(result.stdout);
    const affectedTests = analysis.affectedTests.map((file) => file.path);

    assert.ok(affectedTests.includes("tests/markdownReport.test.ts"));
    assert.equal(affectedTests.some((file) => file.startsWith("ai-project-guardian/")), false);
    assert.ok(analysis.suggestedCommands.some((item) => item.command === "node --test tests/markdownReport.test.ts"));
    assert.equal(
      analysis.suggestedCommands.some((item) => item.command.includes("ai-project-guardian/tests/markdownReport.test.ts")),
      false
    );
  });
});

test("impact filters weak semantic source matches from affected files", () => {
  const result = runCli(["impact", "change report output contract", "--json"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");

  const analysis = JSON.parse(result.stdout);
  const affectedFiles = analysis.affectedFiles.map((file) => file.path);
  const changedFiles = analysis.changedFiles.map((file) => file.path);
  const weakAffectedFiles = analysis.affectedFiles.filter((file) => /weak semantic match/i.test(file.reason));

  assert.ok(analysis.affectedTests.some((file) => file.path === "tests/outputContract.test.js"));
  assert.deepEqual(weakAffectedFiles, []);
  assert.ok(analysis.notes.includes("Filtered weak semantic source candidates from affectedFiles."));
  if (analysis.affectedFiles.length === 0) {
    assert.ok(analysis.notes.includes("No high-confidence affected source files found."));
  }
  for (const filePath of [
    "src/cli/commands/estimate.ts",
    "src/cli/commands/measure.ts",
    "src/cli/commands/scan.ts",
    "src/cli/commands/validate.ts",
    "src/core/tokenEstimator.ts"
  ]) {
    if (changedFiles.includes(filePath)) {
      continue;
    }
    assert.equal(affectedFiles.includes(filePath), false, `${filePath} should not be reported as affected`);
  }
  assert.ok(analysis.suggestedCommands.some((item) => (
    item.command.includes("tests/outputContract.test.js")
    && item.type === "test"
    && item.scope === "focused"
  )));
});

test("impact suppresses npm test fallback for docs-only README changes", async () => {
  await withDocsOnlyImpactRepo(async (cwd) => {
    const result = runCli(["impact", "update README wording", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stderr, "");

    const analysis = JSON.parse(result.stdout);

    assert.ok(analysis.affectedFiles.some((file) => file.path === "README.md"));
    assert.deepEqual(analysis.affectedTests, []);
    assert.equal(analysis.suggestedCommands.some((item) => item.command === "npm test"), false);
    assert.ok(analysis.notes.includes("Docs-only impact detected; no focused test command suggested."));
  });
});

test("impact separates RCC and agent context changes from affected files", async () => {
  await withImpactRepo(async (cwd) => {
    await writeFixtureFile(cwd, ".repo-context-center/config.json", "{\"version\":1}\n");
    await writeFixtureFile(cwd, "CLAUDE.md", "Old Claude guidance\n");
    await writeFixtureFile(cwd, "GEMINI.md", "Old Gemini guidance\n");
    await writeFixtureFile(cwd, ".cursor/rules.md", "Old Cursor guidance\n");
    await writeFixtureFile(cwd, ".github/copilot-instructions.md", "Old Copilot guidance\n");

    runGit(["init"], cwd);
    runGit(["config", "user.email", "test@example.com"], cwd);
    runGit(["config", "user.name", "Test User"], cwd);
    runGit(["add", "-f", "."], cwd);
    runGit(["commit", "-m", "initial"], cwd);

    await writeFixtureFile(cwd, "docs/ai-context/TASK_ROUTING.md", "# Task Routing\n\n- Updated guidance.\n");
    await writeFixtureFile(cwd, ".repo-context-center/config.json", "{}\n");
    await writeFixtureFile(cwd, "CLAUDE.md", "Claude guidance\n");
    await writeFixtureFile(cwd, "GEMINI.md", "Gemini guidance\n");
    await writeFixtureFile(cwd, ".cursor/rules.md", "Cursor guidance\n");
    await writeFixtureFile(cwd, ".github/copilot-instructions.md", "Copilot guidance\n");
    await writeFixtureFile(cwd, "AGENTS.md", "Updated repo guidance\n");

    const result = runCli(["impact", "refresh agent context", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const analysis = JSON.parse(result.stdout);
    const contextPaths = [
      "docs/ai-context/TASK_ROUTING.md",
      ".repo-context-center/config.json",
      "CLAUDE.md",
      "GEMINI.md",
      ".cursor/rules.md",
      ".github/copilot-instructions.md",
      "AGENTS.md"
    ];

    for (const filePath of contextPaths) {
      assert.ok(analysis.contextChanges.some((file) => file.path === filePath), `${filePath} should be a context change`);
      assert.equal(analysis.affectedFiles.some((file) => file.path === filePath), false, `${filePath} should not be affected source`);
    }
    assert.notEqual(analysis.confidence, "high");
    assert.equal(analysis.confidenceExplanation.evidence.contextOnlyChanges, true);
    assert.equal(analysis.confidenceExplanation.evidence.nonContextChangedFiles, 0);
    assert.ok(analysis.confidenceExplanation.reasons.includes("context-only changes detected"));
    assert.ok(analysis.confidenceExplanation.reasons.includes("context changes do not raise confidence to high"));
  });
});

test("impact text output explains confidence evidence", async () => {
  await withImpactRepo(async (cwd) => {
    const result = runCli(["impact", "update login flow"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Confidence: medium/);
    assert.match(result.stdout, /Confidence evidence:\n- task routing matched\n- filename stem matched\n- strong test relationship/);
  });
});

test("impact ignores generic task words when matching affected filenames", async () => {
  await withImpactRepo(async (cwd) => {
    for (const filePath of [
      "src/fix.ts",
      "src/bug.ts",
      "src/issue.ts",
      "src/update.ts",
      "src/improve.ts",
      "src/change.ts",
      "src/refactor.ts",
      "src/cleanup.ts"
    ]) {
      await writeFixtureFile(cwd, filePath, "export const noisy = true;\n");
    }
    await writeFixtureFile(cwd, "src/cache/redis.ts", "export const cache = 'redis';\n");
    await writeFixtureFile(cwd, "src/docker/workflow.ts", "export const workflow = 'docker';\n");

    const result = runCli(["impact", "fix bug issue update improve change refactor cleanup login auth cache redis workflow docker", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const analysis = JSON.parse(result.stdout);
    const affectedFiles = analysis.affectedFiles.map((file) => file.path);

    for (const filePath of [
      "src/fix.ts",
      "src/bug.ts",
      "src/issue.ts",
      "src/update.ts",
      "src/improve.ts",
      "src/change.ts",
      "src/refactor.ts",
      "src/cleanup.ts"
    ]) {
      assert.equal(affectedFiles.includes(filePath), false, `${filePath} should not match generic task wording`);
    }
    assert.ok(affectedFiles.includes("src/auth/login.ts"));
    assert.ok(affectedFiles.includes("src/cache/redis.ts"));
    assert.ok(affectedFiles.includes("src/docker/workflow.ts"));
  });
});

test("impact scores import relationships when recommending affected tests", async () => {
  await withImpactRepo(async (cwd) => {
    await writeFixtureFile(
      cwd,
      "docs/ai-context/TASK_ROUTING.md",
      "# Task Routing\n\n- Checkout work: read `src/payments/checkout.ts`.\n"
    );
    await writeFixtureFile(cwd, "src/payments/checkout.ts", "export function checkout() { return true; }\n");
    await writeFixtureFile(
      cwd,
      "tests/integration/checkoutFlow.test.js",
      "import { checkout } from '../../src/payments/checkout';\ntest('checkout flow', () => checkout());\n"
    );
    await writeFixtureFile(cwd, "tests/integration/paymentFlow.test.js", "test('payment flow', () => {});\n");

    runGit(["init"], cwd);
    runGit(["config", "user.email", "test@example.com"], cwd);
    runGit(["config", "user.name", "Test User"], cwd);
    runGit(["add", "."], cwd);
    runGit(["commit", "-m", "initial"], cwd);

    await writeFixtureFile(cwd, "src/payments/checkout.ts", "export function checkout() { return false; }\n");

    const result = runCli(["impact", "fix checkout behavior", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const analysis = JSON.parse(result.stdout);
    const checkoutTest = analysis.affectedTests.find((file) => file.path === "tests/integration/checkoutFlow.test.js");

    assert.ok(checkoutTest);
    assert.match(checkoutTest.reason, /imports affected source/);
    assert.equal(analysis.affectedTests.some((file) => file.path === "tests/integration/paymentFlow.test.js"), false);
  });
});

test("impact suppresses weak generic affected test recommendations", async () => {
  await withImpactRepo(async (cwd) => {
    await writeFixtureFile(
      cwd,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Login work: read `src/auth/login.ts`, `tests/auth/login.test.js`, `tests/server/backend.test.js`, `tests/api/server.test.js`, `tests/cache/session.test.js`, `tests/workflow/smoke.test.js`, and `tests/docker/container.test.js`."
      ].join("\n")
    );
    await writeFixtureFile(cwd, "tests/server/backend.test.js", "test('backend', () => {});\n");
    await writeFixtureFile(cwd, "tests/api/server.test.js", "test('server api', () => {});\n");
    await writeFixtureFile(cwd, "tests/cache/session.test.js", "test('session cache', () => {});\n");
    await writeFixtureFile(cwd, "tests/workflow/smoke.test.js", "test('workflow smoke', () => {});\n");
    await writeFixtureFile(cwd, "tests/docker/container.test.js", "test('container', () => {});\n");

    const result = runCli(["impact", "fix login bug", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const analysis = JSON.parse(result.stdout);
    const affectedTests = analysis.affectedTests.map((file) => file.path);

    assert.deepEqual(affectedTests, ["tests/auth/login.test.js"]);
    assert.ok(analysis.affectedTests.length <= 5);
    assert.equal(analysis.affectedTests.some((file) => /weak generic route penalty/.test(file.reason)), false);
  });
});

test("impact combines co-change history with directory affinity for affected tests", async () => {
  await withImpactRepo(async (cwd) => {
    await writeFixtureFile(
      cwd,
      "docs/ai-context/TASK_ROUTING.md",
      "# Task Routing\n\n- Invoice work: read `src/billing/invoice.ts`.\n"
    );
    await writeFixtureFile(cwd, "src/billing/invoice.ts", "export function invoiceTotal() { return 1; }\n");
    await writeFixtureFile(cwd, "tests/billing/money.test.js", "test('money math', () => {});\n");
    await writeFixtureFile(cwd, "tests/billing/unrelated.test.js", "test('unrelated', () => {});\n");
    await writeFixtureFile(
      cwd,
      "docs/ai-context/WORK_LOG.md",
      [
        "# Work Log",
        "<!-- repo-context-center:work-log:start -->",
        "```json repo-context-center:done",
        JSON.stringify({
          schemaVersion: 1,
          command: "done",
          timestamp: "2026-01-01T00:00:00.000Z",
          summary: "Fixed invoice total with money regression coverage",
          files: ["src/billing/invoice.ts", "tests/billing/money.test.js"],
          verification: "node --test tests/billing/money.test.js",
          followUps: [],
          risks: []
        }, null, 2),
        "```",
        "```json repo-context-center:done",
        JSON.stringify({
          schemaVersion: 1,
          command: "done",
          timestamp: "2026-01-02T00:00:00.000Z",
          summary: "Adjusted invoice rounding with money regression coverage",
          files: ["src/billing/invoice.ts", "tests/billing/money.test.js"],
          verification: "node --test tests/billing/money.test.js",
          followUps: [],
          risks: []
        }, null, 2),
        "```",
        "<!-- repo-context-center:work-log:end -->"
      ].join("\n")
    );

    runGit(["init"], cwd);
    runGit(["config", "user.email", "test@example.com"], cwd);
    runGit(["config", "user.name", "Test User"], cwd);
    runGit(["add", "."], cwd);
    runGit(["commit", "-m", "initial"], cwd);

    await writeFixtureFile(cwd, "src/billing/invoice.ts", "export function invoiceTotal() { return 2; }\n");

    const result = runCli(["impact", "fix invoice total", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const analysis = JSON.parse(result.stdout);
    const moneyTest = analysis.affectedTests.find((file) => file.path === "tests/billing/money.test.js");

    assert.ok(moneyTest);
    assert.match(moneyTest.reason, /co-change history/);
    assert.match(moneyTest.reason, /same directory/);
    assert.equal(analysis.affectedTests.some((file) => file.path === "tests/billing/unrelated.test.js"), false);
  });
});

test("impact separates concatenated test paths in suggested commands", async () => {
  await withImpactRepo(async (cwd) => {
    await writeFixtureFile(
      cwd,
      "docs/ai-context/TASK_ROUTING.md",
      "# Task Routing\n\n- Alpha beta work: read `tests/alpha.test.jstests/beta.test.js`.\n"
    );
    await writeFixtureFile(cwd, "tests/alpha.test.js", "test('alpha', () => {});\n");
    await writeFixtureFile(cwd, "tests/beta.test.js", "test('beta', () => {});\n");

    const result = runCli(["impact", "fix alpha beta behavior", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const analysis = JSON.parse(result.stdout);
    const focusedCommand = analysis.suggestedCommands.find((item) => item.command.startsWith("node --test "));

    assert.ok(focusedCommand);
    assert.match(focusedCommand.command, /tests\/alpha\.test\.js tests\/beta\.test\.js/);
    assert.doesNotMatch(focusedCommand.command, /tests\/alpha\.test\.jstests\/beta\.test\.js/);
  });
});

test("impact rejects invalid args", () => {
  const result = runCli(["impact", "--unknown"]);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Usage: rcc impact "<task>"/);
});
