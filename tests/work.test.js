const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, utimes, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8"
  });
}

function sectionItems(output, heading, nextHeading) {
  const pattern = new RegExp(`${heading}:\\n(?<body>[\\s\\S]*?)\\n\\n${nextHeading}:`);
  const body = output.match(pattern)?.groups?.body ?? "";

  return body.split(/\r?\n/).filter((line) => line.startsWith("- "));
}

function sectionBody(output, heading, nextHeading) {
  const pattern = new RegExp(`${heading}:\\n(?<body>[\\s\\S]*?)\\n\\n${nextHeading}:`);
  return output.match(pattern)?.groups?.body ?? "";
}

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function setFixtureMtime(root, relativePath, date) {
  const fullPath = path.join(root, relativePath);
  await utimes(fullPath, date, date);
}

async function withFreshnessRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-freshness-"));
  const contextDate = new Date("2026-06-17T12:00:00.000Z");
  const oldDate = new Date("2026-06-17T11:00:00.000Z");

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      "# Task Routing\n\n- CLI work: read `src/index.ts` and `tests/index.test.js`.\n"
    );
    await writeFixtureFile(tempDir, "docs/ai-context/MODULE_INDEX.md", "# Module Index\n");
    await writeFixtureFile(tempDir, "docs/ai-context/PROJECT_MAP.md", "# Project Map\n");
    await writeFixtureFile(tempDir, "docs/ai-context/CHANGE_LOG.md", [
      "# Change Log",
      "",
      "| Date | Command | Files updated | Reason |",
      "| --- | --- | --- | --- |",
      "| 2026-06-17 | `repo-context-center map --write` | 13 context files | generated repo-specific context map |"
    ].join("\n"));
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");
    await writeFixtureFile(tempDir, "tests/index.test.js", "test('ok', () => {});\n");
    await writeFixtureFile(tempDir, "README.md", "# Fixture\n");

    for (const file of [
      "AGENTS.md",
      "docs/ai-context/TASK_ROUTING.md",
      "docs/ai-context/MODULE_INDEX.md",
      "docs/ai-context/PROJECT_MAP.md",
      "docs/ai-context/CHANGE_LOG.md"
    ]) {
      await setFixtureMtime(tempDir, file, contextDate);
    }
    for (const file of ["src/index.ts", "tests/index.test.js", "README.md"]) {
      await setFixtureMtime(tempDir, file, oldDate);
    }

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withWorkRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Auth or login work: read `src/auth/login.ts`, `tests/auth/login.test.ts`, and `docs/ai-context/RISK_REGISTER.md`."
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/RISK_REGISTER.md",
      [
        "# Risk Register",
        "",
        "| Area | Risk | Check |",
        "| --- | --- | --- |",
        "| `src/auth/login.ts` | Login regressions can block sign-in | Run `tests/auth/login.test.ts` |"
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/DECISIONS.md",
      [
        "# Decisions",
        "",
        "| Date | Decision | Reason | Status | Files |",
        "| --- | --- | --- | --- | --- |",
        "| 2026-06-16 | Keep login flow server-side | Avoid leaking session state | Active | src/auth/login.ts |"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withLookupRankingRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-ranking-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\nrole role role role role role role role role role\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Work command changes: read `src/cli/commands/work.ts`, `tests/work.test.js`, `src/core/workRouting.ts`, and `docs/ai-context/MODULE_INDEX.md`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "docs/ai-context/MODULE_INDEX.md", "# Module Index\n");
    await writeFixtureFile(
      tempDir,
      "src/cli/commands/work.ts",
      [
        "export function workCommand() {",
        "  const role = 'source';",
        "  return role;",
        "}",
        "// role role role role role role role role role role"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "tests/work.test.js", "test('work command', () => {});\n");
    await writeFixtureFile(
      tempDir,
      "src/core/repoFileClassifier.ts",
      [
        "export type RepoFileRole = 'source' | 'test' | 'config';",
        "export function classifyRepoFile(path) {",
        "  const role = path.includes('test') ? 'test' : 'source';",
        "  return { role };",
        "}",
        "// role role role role role role role role role role role role"
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "tests/repoFileClassifier.test.js",
      "test('role classification', () => { const role = 'source'; return role; });\n// role role role role role role role role role role\n"
    );
    await writeFixtureFile(
      tempDir,
      "tests/estimate.test.js",
      "test('unrelated estimate role wording', () => { const role = 'source'; return role; });\n// role role role role role role role role role role\n"
    );
    await writeFixtureFile(tempDir, "src/core/workRouting.ts", "export const routed = true;\n");
    await writeFixtureFile(tempDir, "src/features/work/index.ts", "export const folder = 'work';\n");
    await writeFixtureFile(tempDir, "src/cli/commands/other.ts", "export const note = 'work lookup hint';\n");
    await writeFixtureFile(tempDir, "docs/ai-context/WORK_LOG.md", "- Summary: work command history\n");
    await writeFixtureFile(tempDir, ".repo-context-center/config.json", "{\"work\":true}\n");
    await writeFixtureFile(tempDir, "fixtures/work.ts", "export const fixture = true;\n");
    await writeFixtureFile(tempDir, "dist/work.js", "export const generated = true;\n");
    await writeFixtureFile(tempDir, "tests/__snapshots__/work.test.js.snap", "work snapshot\n");
    await writeFixtureFile(tempDir, "archive/work.ts", "export const archived = true;\n");
    await writeFixtureFile(tempDir, "package.json", "{\"scripts\":{\"test\":\"node --test\"}}\n");
    await writeFixtureFile(tempDir, "package-lock.json", "{\"name\":\"fixture\"}\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withRecommendedRankingRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-recommend-ranking-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Package and build work: read `AGENTS.md`, `docs/ai-context/TASK_ROUTING.md`, and `docs/ai-context/MODULE_INDEX.md`.",
        "- Work command changes: read `src/cli/commands/work.ts` and `tests/work.test.js`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "docs/ai-context/MODULE_INDEX.md", "# Module Index\n");
    await writeFixtureFile(tempDir, "package.json", "{\"scripts\":{\"build\":\"tsc\"}}\n");
    await writeFixtureFile(tempDir, "package-lock.json", "{\"lockfileVersion\":3}\n");
    await writeFixtureFile(tempDir, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
    await writeFixtureFile(tempDir, "yarn.lock", "# yarn lockfile\n");
    await writeFixtureFile(tempDir, "tsconfig.json", "{\"compilerOptions\":{}}\n");
    await writeFixtureFile(tempDir, "vite.config.ts", "export default {};\n");
    await writeFixtureFile(tempDir, "src/cli/index.ts", "export function run() {}\n");
    await writeFixtureFile(tempDir, "src/cli/commands/work.ts", "export function workCommand() {}\n");
    await writeFixtureFile(tempDir, "src/cli/commands/done.ts", "export function doneCommand() {}\n");
    await writeFixtureFile(tempDir, "tests/work.test.js", "test('work command', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withSelfDevelopmentRoutingRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-self-dev-routing-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", [
      "# AGENTS.md",
      "",
      "- For this repository, prefer `node dist/cli/index.js <command>`.",
      "- Do not use global `rcc` to validate local changes."
    ].join("\n"));
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Workflow-domain tasklarda: read `src/core/taskIntent.ts` and `tests/taskIntent.test.js`.",
        "- RCC work output assembly: for task files, recommended files, lookup hints, targeted lookup hints, promoted lookup, weak semantic match, semantic source match, work brief, human output, output categorization, agent rules, context docs, or cheapest path, start with `src/cli/commands/work.ts` and `tests/work.test.js`. Use `src/core/taskIntent.ts` only when tokenization or intent classification must change."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "docs/ai-context/MODULE_INDEX.md", "# Module Index\n");
    await writeFixtureFile(
      tempDir,
      "src/cli/commands/work.ts",
      [
        "export function workCommand() {",
        "  return 'task files recommended files lookup hints targeted lookup hints promoted lookup weak semantic match semantic source match work brief human output output categorization agent rules context docs cheapest path';",
        "}"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "tests/work.test.js", "test('work command output assembly', () => {});\n");
    await writeFixtureFile(
      tempDir,
      "src/core/taskIntent.ts",
      [
        "export function analyzeTaskIntent() {",
        "  return 'workflow domain weak semantic source matches task files';",
        "}",
        "// workflow domain weak semantic source matches task files workflow domain weak semantic source matches task files"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "tests/taskIntent.test.js", "test('task intent', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withRiskClassificationRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-risk-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Package work: read `package.json`.",
        "- Auth work: read `src/auth/login.ts` and `tests/auth/login.test.ts`.",
        "- Workflow work: read `.github/workflows/ci.yml`.",
        "- Docs work: read `README.md`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "README.md", "# Fixture\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/RISK_REGISTER.md",
      [
        "# Risk Register",
        "",
        "| Area | Why risky | Focused checks |",
        "| --- | --- | --- |",
        "| `package.json` | Package script and build configuration changes can break local commands. | npm test |"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "package.json", "{\"scripts\":{\"build\":\"tsc\"},\"dependencies\":{}}\n");
    await writeFixtureFile(tempDir, "package-lock.json", "{\"lockfileVersion\":3}\n");
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");
    await writeFixtureFile(tempDir, ".github/workflows/ci.yml", "name: ci\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withWorkflowRankingRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-workflow-ranking-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Workflow risks: read `.github/workflows/ai-project-guardian.yml`, `docs/ai-context/RISK_REGISTER.md`, and `docs/ai-context/HOTSPOTS.md`.",
        "- RCC find command changes: read `src/cli/commands/find.ts` and `tests/find.test.js`."
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/RISK_REGISTER.md",
      [
        "# Risk Register",
        "",
        "| Area | Why risky | Focused checks |",
        "| --- | --- | --- |",
        "| `.github/workflows/ai-project-guardian.yml` | Workflow risks can block CI. | npm test |"
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/HOTSPOTS.md",
      [
        "# Hotspots",
        "",
        "| File | Why hot | Checks |",
        "| --- | --- | --- |",
        "| `.github/workflows/ai-project-guardian.yml` | workflow risk hotspot | npm test |"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, ".github/workflows/ai-project-guardian.yml", "name: ai-project-guardian\non: [push]\n");
    await writeFixtureFile(tempDir, ".github/workflows/ci.yml", "name: ci\non: [push]\n");
    await writeFixtureFile(tempDir, "package.json", "{\"scripts\":{\"workflow\":\"node scripts/workflow-risk.js\"},\"description\":\"workflow risk workflow risk workflow\"}\n");
    await writeFixtureFile(
      tempDir,
      "src/cli/commands/done.ts",
      [
        "export function doneCommand() {",
        "  return 'risk';",
        "}",
        "// risk risk risk risk risk risk risk risk risk risk risk risk risk risk risk risk"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "src/cli/commands/find.ts", "export function findCommand() {}\n");
    await writeFixtureFile(tempDir, "tests/find.test.js", "test('find command', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withGuidanceRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-guidance-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Login work: read `src/auth/login.ts` and `tests/auth/login.test.ts`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "docs/ai-context/MODULE_INDEX.md", "# Module Index\n");
    await writeFixtureFile(tempDir, "docs/ai-context/DEPENDENCY_MAP.md", "# Dependency Map\n");
    await writeFixtureFile(tempDir, "docs/ai-context/RISK_REGISTER.md", "# Risk Register\n");
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("work runs without arguments", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work"], { cwd: tempDir });

    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^Usage: rcc work "<task>"/);
    assert.doesNotMatch(result.stdout, /Unspecified task/);
  });
});

test("work accepts a task string and recommends focused files", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Task:\nfix login bug/);
    assert.match(result.stdout, /Freshness:\n(fresh|maybe_stale|stale|unknown) \d+\/100 — /);
    assert.match(result.stdout, /Cheapest path:\n1\. Inspect the task files listed below\.\n2\. Check supporting tests\.\n3\. If more search is needed, run: rcc find "login"\n4\. Avoid broad rg\/find until targeted lookup is exhausted\./);
    assert.match(result.stdout, /Task files:\n- src\/auth\/login\.ts/);
    assert.match(result.stdout, /Tests:\n- tests\/auth\/login\.test\.ts/);
    assert.match(result.stdout, /Agent rules:\n- AGENTS\.md/);
    assert.match(result.stdout, /Context if unclear:\n- docs\/ai-context\/TASK_ROUTING\.md/);
    assert.match(result.stdout, /Known risks:\n- high/);
    assert.match(result.stdout, /Lookup hints:\n1\. src\/auth\/login\.ts — matched filename stem "login"; high/);
    assert.match(result.stdout, /Next cheapest command:\nrcc find "login"/);
    assert.ok(result.stdout.indexOf("Task files:") < result.stdout.indexOf("Context if unclear:"));
    assert.match(result.stdout, /Done:\n```sh\nrcc done --summary "<summary>" --files auto --verify "<check>"\n```/);
    assert.doesNotMatch(result.stdout, /Recent logs:/);
    assert.doesNotMatch(result.stdout, /Read-first guidance:/);
    assert.doesNotMatch(result.stdout, /Fast lookup:/);
    assert.doesNotMatch(result.stdout, /rcc done "<summary>"/);
  });
});

test("work --json returns a valid machine-readable brief", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(brief.task, "fix login bug");
    assert.deepEqual(
      Object.keys(brief),
      [
        "schemaVersion",
        "command",
        "task",
        "contextBudget",
        "mapFreshness",
        "recommendedFiles",
        "relevantTests",
        "taskFiles",
        "supportingTests",
        "workflowDocs",
        "contextDocs",
        "cheapestPath",
        "avoid",
        "nextCheapestCommand",
        "promotedFromTargetedLookup",
        "relevantDecisions",
        "recentLogs",
        "risks",
        "readFirstGuidance",
        "readFirst",
        "targetedLookupHints",
        "tokenEstimate",
        "fastLookup",
        "nextCommand"
      ]
    );
    assert.equal(brief.schemaVersion, 1);
    assert.equal(brief.command, "work");
    assert.equal(brief.contextBudget, "balanced");
    assert.equal(typeof brief.mapFreshness.status, "string");
    assert.equal(typeof brief.mapFreshness.score, "number");
    assert.equal(typeof brief.mapFreshness.reason, "string");
    assert.ok("latestContextUpdate" in brief.mapFreshness);
    assert.ok("latestRelevantSourceChange" in brief.mapFreshness);
    assert.ok(brief.recommendedFiles.some((file) => file.path === "src/auth/login.ts"));
    assert.ok(brief.relevantTests.some((file) => file.path === "tests/auth/login.test.ts"));
    assert.equal(brief.taskFiles[0].path, "src/auth/login.ts");
    assert.ok(brief.supportingTests.some((file) => file.path === "tests/auth/login.test.ts"));
    assert.ok(brief.workflowDocs.some((file) => file.path === "AGENTS.md"));
    assert.ok(brief.contextDocs.some((file) => file.path === "docs/ai-context/TASK_ROUTING.md"));
    assert.deepEqual(brief.cheapestPath, [
      "Inspect the task files listed below.",
      "Check supporting tests.",
      'If more search is needed, run: rcc find "login"',
      "Avoid broad rg/find until targeted lookup is exhausted."
    ]);
    assert.ok(brief.avoid.some((item) => item.includes("broad rg/find")));
    assert.ok(brief.avoid.some((item) => item.includes("docs/ai-context")));
    assert.ok(brief.avoid.some((item) => item.includes("generated/assets/fixtures")));
    assert.ok(brief.avoid.some((item) => item.includes("full repository scans")));
    assert.equal(brief.nextCheapestCommand, 'rcc find "login"');
    assert.ok(brief.promotedFromTargetedLookup.some((hint) => hint.path === "src/auth/login.ts"));
    assert.ok(brief.targetedLookupHints.some((hint) => (
      hint.path === "src/auth/login.ts"
      && hint.reason
      && hint.signal
      && hint.confidence
      && typeof hint.score === "number"
    )));
    assert.ok(brief.relevantDecisions.some((decision) => decision.includes("Keep login flow server-side")));
    assert.equal(typeof brief.tokenEstimate.briefTokens, "number");
    assert.deepEqual(brief.readFirstGuidance.required, [
      {
        path: "AGENTS.md",
        reason: "repository agent workflow"
      }
    ]);
    assert.ok(brief.readFirst.includes("AGENTS.md"));
    assert.equal(Array.isArray(brief.readFirstGuidance.taskSpecific), true);
    assert.equal(Array.isArray(brief.readFirstGuidance.optionalIfUnclear), true);
    assert.equal(Array.isArray(brief.readFirstGuidance.skippedForNow), true);
    assert.equal(brief.fastLookup.command, 'rcc find "<keyword>"');
    assert.equal(brief.nextCommand.command, 'rcc done --summary "<summary>" --files auto --verify "<check>"');
    assert.equal(brief.nextCommand.when, "after meaningful work");
    assert.equal(result.stdout.trim().startsWith("{"), true);
    assert.equal(result.stdout.trim().endsWith("}"), true);
    assert.doesNotMatch(result.stdout, /repo-context-center work brief/);
  });
});

test("work classifies package tasks as medium risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "improve package scripts"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "medium");
  });
});

test("work classifies dependency tasks as medium risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "update dependencies"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "medium");
  });
});

test("work classifies docs tasks as low risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix typo in README"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "low");
  });
});

test("work classifies auth tasks as high risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix login authorization"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "high");
  });
});

test("work classifies deployment tasks as high risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "update deployment config"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "high");
  });
});

test("work classifies workflow tasks as high risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "update deployment workflow"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "high");
  });
});

test("work handles missing RCC files gracefully", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-empty-"));

  try {
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");

    const result = runCli(["work", "unknown task"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Freshness:\nunknown 0\/100 — Run npx repo-context-center init to generate context\.; continue with task files, then run `rcc map --write`\./);
    assert.match(result.stdout, /Lookup hints:\n- none\. use rcc find "<keyword>" for targeted lookup\./);
    assert.doesNotMatch(result.stdout, /Recent logs:/);
    assert.doesNotMatch(result.stdout, /Read-first guidance:/);
    assert.doesNotMatch(result.stdout, /Fast lookup:/);
    assert.match(result.stdout, /rcc find "<keyword>"/);
    assert.match(result.stdout, /```sh\nrcc done --summary "<summary>" --files auto --verify "<check>"\n```/);
    assert.doesNotMatch(result.stdout, /rcc done "<summary>"/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("work --json keeps stable fields when RCC data is missing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-json-empty-"));

  try {
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");

    const result = runCli(["work", "unknown task", "--json"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(brief.mapFreshness.status, "unknown");
    assert.equal(brief.mapFreshness.score, 0);
    assert.match(brief.mapFreshness.reason, /^Run npx repo-context-center init/);
    assert.equal(brief.mapFreshness.latestContextUpdate, null);
    assert.equal(brief.mapFreshness.latestRelevantSourceChange, null);
    assert.deepEqual(brief.relevantDecisions, []);
    assert.deepEqual(brief.recentLogs, []);
    assert.deepEqual(brief.readFirst, []);
    assert.deepEqual(brief.readFirstGuidance, {
      required: [],
      taskSpecific: [],
      optionalIfUnclear: [],
      skippedForNow: []
    });
    assert.deepEqual(brief.targetedLookupHints, []);
    assert.equal(Array.isArray(brief.cheapestPath), true);
    assert.ok(brief.cheapestPath.some((item) => item.includes('rcc find "unknown"')));
    assert.equal(Array.isArray(brief.avoid), true);
    assert.ok(brief.avoid.some((item) => item.includes("broad rg/find")));
    assert.equal(brief.nextCheapestCommand, 'rcc find "unknown"');
    assert.equal(brief.nextCommand.command, 'rcc done --summary "<summary>" --files auto --verify "<check>"');
    assert.equal(Array.isArray(brief.recommendedFiles), true);
    assert.equal(Array.isArray(brief.relevantTests), true);
    assert.equal(brief.tokenEstimate.briefTokens === null || Number.isInteger(brief.tokenEstimate.briefTokens), true);
    assert.equal(brief.fastLookup.guidance, "Prefer this before broad repo search when the target is unclear.");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("work prunes read-first guidance for a small focused task", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(brief.readFirstGuidance.required.map((item) => item.path), ["AGENTS.md"]);
    assert.ok(brief.targetedLookupHints.some((hint) => hint.path === "src/auth/login.ts"));
    assert.ok(!brief.readFirstGuidance.taskSpecific.some((item) => item.path === "docs/ai-context/MODULE_INDEX.md"));
    assert.ok(!brief.readFirstGuidance.taskSpecific.some((item) => item.path === "docs/ai-context/DEPENDENCY_MAP.md"));
    assert.ok(
      brief.readFirstGuidance.optionalIfUnclear.some((item) => item.path === "docs/ai-context/TASK_ROUTING.md")
        || brief.readFirstGuidance.skippedForNow.some((item) => item.path === "docs/ai-context/TASK_ROUTING.md")
    );
  });
});

test("work read-first guidance promotes risk context for security and freshness tasks", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix freshness reporting risk"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(brief.readFirstGuidance.taskSpecific.some((item) => (
      item.path === "docs/ai-context/RISK_REGISTER.md"
      && item.reason.includes("freshness/reporting")
    )));
    assert.ok(brief.readFirst.includes("docs/ai-context/RISK_REGISTER.md"));
  });
});

test("work read-first guidance promotes dependency context for build and package tasks", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "update package build integration"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(brief.readFirstGuidance.taskSpecific.some((item) => (
      item.path === "docs/ai-context/DEPENDENCY_MAP.md"
    )));
    assert.ok(brief.readFirst.includes("docs/ai-context/DEPENDENCY_MAP.md"));
  });
});

test("work read-first guidance promotes module context for architecture and refactor tasks", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "refactor auth service architecture"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(brief.readFirstGuidance.taskSpecific.some((item) => (
      item.path === "docs/ai-context/MODULE_INDEX.md"
    )));
    assert.ok(brief.readFirst.includes("docs/ai-context/MODULE_INDEX.md"));
  });
});

test("work read-first guidance promotes task routing for ambiguous work", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "clean up"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(brief.readFirstGuidance.taskSpecific.some((item) => (
      item.path === "docs/ai-context/TASK_ROUTING.md"
    )));
  });
});

test("work --context-budget minimal keeps only AGENTS required", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--context-budget", "minimal", "fix freshness reporting risk"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(brief.readFirst, ["AGENTS.md"]);
    assert.deepEqual(brief.readFirstGuidance.required.map((item) => item.path), ["AGENTS.md"]);
    assert.equal(brief.readFirstGuidance.taskSpecific.length, 0);
    assert.ok(brief.readFirstGuidance.optionalIfUnclear.some((item) => item.path === "docs/ai-context/RISK_REGISTER.md"));
  });
});

test("work --json supports balanced context budget explicitly", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--context-budget", "balanced", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.contextBudget, "balanced");
    assert.deepEqual(brief.readFirstGuidance.required.map((item) => item.path), ["AGENTS.md"]);
    assert.equal(Array.isArray(brief.readFirstGuidance.taskSpecific), true);
    assert.equal(Array.isArray(brief.readFirstGuidance.optionalIfUnclear), true);
    assert.equal(Array.isArray(brief.readFirstGuidance.skippedForNow), true);
  });
});

test("work --context-budget deep keeps broader read-first guidance", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--context-budget", "deep", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const broadGuidance = [
      ...brief.readFirstGuidance.taskSpecific,
      ...brief.readFirstGuidance.optionalIfUnclear
    ].map((item) => item.path);

    assert.equal(result.status, 0);
    assert.ok(brief.readFirst.includes("AGENTS.md"));
    assert.ok(brief.readFirst.includes("docs/ai-context/TASK_ROUTING.md"));
    assert.ok(broadGuidance.includes("docs/ai-context/MODULE_INDEX.md"));
    assert.ok(broadGuidance.includes("docs/ai-context/DEPENDENCY_MAP.md"));
    assert.ok(broadGuidance.includes("docs/ai-context/RISK_REGISTER.md"));
  });
});

test("work --json accepts option order and max-files", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const minimal = runCli(["work", "fix login bug", "--json", "--context-budget", "minimal"], { cwd: tempDir });
    const deep = runCli(["work", "fix login bug", "--context-budget", "deep", "--json"], { cwd: tempDir });
    const maxFiles = runCli(["work", "fix login bug", "--json", "--max-files", "1"], { cwd: tempDir });

    assert.equal(minimal.status, 0);
    assert.equal(JSON.parse(minimal.stdout).contextBudget, "minimal");
    assert.equal(deep.status, 0);
    assert.equal(JSON.parse(deep.stdout).contextBudget, "deep");
    assert.equal(maxFiles.status, 0);
    assert.equal(Array.isArray(JSON.parse(maxFiles.stdout).recommendedFiles), true);
  });
});

test("work --json prints only parseable formatted JSON", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug", "--json"], { cwd: tempDir });
    const parsed = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, `${JSON.stringify(parsed, null, 2)}\n`);
    assert.equal(result.stdout[0], "{");
    assert.equal(result.stdout.at(-2), "}");
  });
});

test("work reports fresh map freshness when context is newer than repo changes", async () => {
  await withFreshnessRepo(async (tempDir) => {
    const result = runCli(["work", "update cli"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Freshness:\nfresh 100\/100 — context is current; continue with task files\./);
    assert.doesNotMatch(result.stdout, /Recommended:\nrcc map --write/);
  });
});

test("work reports stale map freshness when important source files changed", async () => {
  await withFreshnessRepo(async (tempDir) => {
    await setFixtureMtime(tempDir, "src/index.ts", new Date("2026-06-17T13:00:00.000Z"));

    const result = runCli(["work", "update cli"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Freshness:\nstale 35\/100 — important files changed after context generation; continue with task files, then run `rcc map --write`\./);
  });
});

test("work reports maybe_stale map freshness when unclear repo files changed", async () => {
  await withFreshnessRepo(async (tempDir) => {
    await setFixtureMtime(tempDir, "README.md", new Date("2026-06-17T13:00:00.000Z"));

    const result = runCli(["work", "update cli"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Freshness:\nmaybe_stale 68\/100 — some repo files changed after context generation; continue with task files, then run `rcc map --write`\./);
  });
});

test("work --json includes structured freshness output", async () => {
  await withFreshnessRepo(async (tempDir) => {
    await setFixtureMtime(tempDir, "src/index.ts", new Date("2026-06-17T13:00:00.000Z"));

    const result = runCli(["work", "--json", "update cli"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.mapFreshness.status, "stale");
    assert.equal(brief.mapFreshness.score, 35);
    assert.match(brief.mapFreshness.reason, /Important source/);
    assert.equal(brief.mapFreshness.latestContextUpdate, "2026-06-17T12:00:00.000Z");
    assert.equal(brief.mapFreshness.latestRelevantSourceChange, "2026-06-17T13:00:00.000Z");
    assert.deepEqual(brief.mapFreshness.affectedFiles, ["src/index.ts"]);
    assert.ok(brief.mapFreshness.affectedContextFiles.includes("docs/ai-context/TASK_ROUTING.md"));
  });
});

test("work freshness changes after touching a source file", async () => {
  await withFreshnessRepo(async (tempDir) => {
    const fresh = JSON.parse(runCli(["work", "--json", "update cli"], { cwd: tempDir }).stdout);
    assert.equal(fresh.mapFreshness.status, "fresh");

    await setFixtureMtime(tempDir, "src/index.ts", new Date("2026-06-17T13:00:00.000Z"));

    const stale = JSON.parse(runCli(["work", "--json", "update cli"], { cwd: tempDir }).stdout);
    assert.equal(stale.mapFreshness.status, "stale");
    assert.ok(stale.mapFreshness.affectedFiles.includes("src/index.ts"));
  });
});

test("work --json ranks exact command hints above folder and weak matches", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "Improve work command lookup hints"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.targetedLookupHints.map((hint) => hint.path);

    assert.equal(result.status, 0);
    assert.equal(paths[0], "src/cli/commands/work.ts");
    assert.ok(
      paths.indexOf("src/cli/commands/work.ts") < paths.indexOf("src/features/work/index.ts"),
      paths.join("\n")
    );
    assert.equal(brief.targetedLookupHints[0].reason, 'matched command name "work"');
    assert.equal(brief.targetedLookupHints[0].signal, "command-name-match");
    assert.equal(brief.targetedLookupHints[0].confidence, "high");
    assert.equal(typeof brief.targetedLookupHints[0].score, "number");
  });
});

test("work --json keeps paired tests near source hints", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "Improve work command lookup hints"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.targetedLookupHints.map((hint) => hint.path);
    const sourceIndex = paths.indexOf("src/cli/commands/work.ts");
    const testIndex = paths.indexOf("tests/work.test.js");

    assert.equal(result.status, 0);
    assert.notEqual(sourceIndex, -1, paths.join("\n"));
    assert.notEqual(testIndex, -1, paths.join("\n"));
    assert.ok(testIndex - sourceIndex <= 2, paths.join("\n"));
    assert.match(brief.targetedLookupHints[testIndex].reason, /paired test/);
    assert.equal(brief.targetedLookupHints[testIndex].signal, "paired-test");
    assert.equal(brief.targetedLookupHints[testIndex].confidence, "high");
  });
});

test("work --json penalizes context, generated, fixture, snapshot, archive, lock, and duplicate lookup paths", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "Improve work command lookup hints"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.targetedLookupHints.map((hint) => hint.path);

    assert.equal(result.status, 0);
    assert.equal(new Set(paths).size, paths.length);
    assert.ok(!paths.some((file) => file.startsWith("docs/ai-context/")), paths.join("\n"));
    assert.ok(!paths.some((file) => file.startsWith(".repo-context-center/")), paths.join("\n"));
    assert.ok(!paths.some((file) => file.startsWith("fixtures/")), paths.join("\n"));
    assert.ok(!paths.some((file) => file.startsWith("dist/")), paths.join("\n"));
    assert.ok(!paths.some((file) => file.startsWith("archive/")), paths.join("\n"));
    assert.ok(!paths.some((file) => file.includes("__snapshots__")), paths.join("\n"));
    assert.ok(!paths.includes("package-lock.json"), paths.join("\n"));
    assert.ok(brief.targetedLookupHints.every((hint) => (
      hint.reason
      && hint.signal
      && hint.confidence
      && typeof hint.score === "number"
    )));
  });
});

test("work --json does not promote generated, fixture, snapshot, asset, archive, or lock lookup noise", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "assets/work.svg", "<svg>work work work work work</svg>\n");

    const result = runCli(["work", "--json", "Improve work command lookup hints"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const promotedPaths = brief.promotedFromTargetedLookup.map((hint) => hint.path);

    assert.equal(result.status, 0);
    assert.ok(!promotedPaths.some((file) => file.startsWith("fixtures/")), promotedPaths.join("\n"));
    assert.ok(!promotedPaths.some((file) => file.startsWith("dist/")), promotedPaths.join("\n"));
    assert.ok(!promotedPaths.some((file) => file.startsWith("archive/")), promotedPaths.join("\n"));
    assert.ok(!promotedPaths.some((file) => file.includes("__snapshots__")), promotedPaths.join("\n"));
    assert.ok(!promotedPaths.some((file) => file.startsWith("assets/")), promotedPaths.join("\n"));
    assert.ok(!promotedPaths.includes("package-lock.json"), promotedPaths.join("\n"));
  });
});

test("work --json promotes role task source and tests ahead of docs", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "Role lerle ilgili bug ihtimallerini bul"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const recommendedPaths = brief.recommendedFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(brief.nextCheapestCommand, 'rcc find "role"');
    assert.ok(brief.taskFiles.some((file) => file.path === "src/core/repoFileClassifier.ts"), JSON.stringify(brief.taskFiles));
    assert.ok(brief.taskFiles.some((file) => file.path === "src/cli/commands/work.ts"), JSON.stringify(brief.taskFiles));
    assert.ok(brief.supportingTests.some((file) => file.path === "tests/repoFileClassifier.test.js"), JSON.stringify(brief.supportingTests));
    assert.ok(!brief.supportingTests.some((file) => file.path === "tests/estimate.test.js"), JSON.stringify(brief.supportingTests));
    assert.ok(recommendedPaths.includes("src/core/repoFileClassifier.ts"), recommendedPaths.join("\n"));
    assert.ok(recommendedPaths.includes("src/cli/commands/work.ts"), recommendedPaths.join("\n"));
    assert.ok(recommendedPaths.includes("tests/repoFileClassifier.test.js"), recommendedPaths.join("\n"));
    assert.ok(!recommendedPaths.includes("tests/estimate.test.js"), recommendedPaths.join("\n"));
    assert.ok(!recommendedPaths.includes("AGENTS.md"), recommendedPaths.join("\n"));
    assert.ok(!recommendedPaths.some((file) => file.startsWith("docs/ai-context/")), recommendedPaths.join("\n"));
    assert.ok(brief.workflowDocs.some((file) => file.path === "AGENTS.md"), JSON.stringify(brief.workflowDocs));
    assert.ok(brief.contextDocs.some((file) => file.path === "docs/ai-context/TASK_ROUTING.md"), JSON.stringify(brief.contextDocs));
    assert.ok(brief.contextDocs.some((file) => file.path === "docs/ai-context/MODULE_INDEX.md"), JSON.stringify(brief.contextDocs));
    assert.ok(!brief.readFirst.includes("docs/ai-context/TASK_ROUTING.md"), JSON.stringify(brief.readFirst));
    assert.ok(brief.avoid.some((item) => item.includes("broad rg/find")));
  });
});

test("work human output separates docs for Turkish role investigation", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "Role lerle ilgili bug ihtimallerini bul"], { cwd: tempDir });
    const taskFiles = sectionBody(result.stdout, "Task files", "Tests");
    const supportingTests = sectionBody(result.stdout, "Tests", "Agent rules");
    const workflowDocs = sectionBody(result.stdout, "Agent rules", "Context if unclear");
    const contextDocs = sectionBody(result.stdout, "Context if unclear", "Lookup hints");

    assert.equal(result.status, 0);
    assert.ok(result.stdout.indexOf("Task files:") < result.stdout.indexOf("Context if unclear:"));
    assert.ok(result.stdout.indexOf("Cheapest path:") < result.stdout.indexOf("Lookup hints:"));
    assert.match(taskFiles, /src\/core\/repoFileClassifier\.ts/);
    assert.match(taskFiles, /src\/cli\/commands\/work\.ts/);
    assert.doesNotMatch(taskFiles, /AGENTS\.md/);
    assert.doesNotMatch(taskFiles, /docs\/ai-context/);
    assert.match(supportingTests, /tests\/repoFileClassifier\.test\.js/);
    assert.doesNotMatch(supportingTests, /tests\/estimate\.test\.js/);
    assert.match(workflowDocs, /AGENTS\.md/);
    assert.match(contextDocs, /docs\/ai-context\/TASK_ROUTING\.md/);
    assert.match(contextDocs, /docs\/ai-context\/MODULE_INDEX\.md/);
    assert.doesNotMatch(result.stdout, /Read-first guidance:/);
    assert.doesNotMatch(result.stdout, /Recommended:\nrcc map --write/);
    assert.match(result.stdout, /Next cheapest command:\nrcc find "role"/);
  });
});

test("work --json role tie-break keeps source ahead of package and noise roles", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-role-order-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(tempDir, "docs/ai-context/TASK_ROUTING.md", "# Task Routing\n");
    await writeFixtureFile(tempDir, "src/auth.ts", "export const value = 'role';\n// role role role role role role role role role role role role role role role role\n");
    await writeFixtureFile(tempDir, "package.json", "{\"name\":\"fixture\",\"description\":\"role role role role role role role role role role role role role role role role\"}\n");
    await writeFixtureFile(tempDir, "dist/role.js", "const role = 'role';\n// role role role role role role role role\n");
    await writeFixtureFile(tempDir, "src/logo.svg", "<svg>role role role role role role role role</svg>\n");

    const result = runCli(["work", "--json", "role"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.recommendedFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.ok(paths.indexOf("src/auth.ts") !== -1, paths.join("\n"));
    assert.ok(paths.indexOf("package.json") !== -1, paths.join("\n"));
    assert.ok(paths.indexOf("src/auth.ts") < paths.indexOf("package.json"), paths.join("\n"));
    assert.ok(!paths.includes("dist/role.js"), paths.join("\n"));
    assert.ok(!paths.includes("src/logo.svg"), paths.join("\n"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("work --json ranks exact filename above weak semantic matches", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "src/notes/unrelated.ts", "export const text = 'package package package package package';\n");

    const result = runCli(["work", "--json", "improve package scripts"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.targetedLookupHints.map((hint) => hint.path);

    assert.equal(result.status, 0);
    assert.equal(paths[0], "package.json", paths.join("\n"));
    assert.equal(brief.targetedLookupHints[0].signal, "filename-match");
    assert.ok(paths.indexOf("package.json") < paths.indexOf("src/notes/unrelated.ts"), paths.join("\n"));
    assert.equal(brief.targetedLookupHints.find((hint) => hint.path === "src/notes/unrelated.ts").signal, "semantic-match");
  });
});

test("work --json ranks package task package.json first", async () => {
  await withRecommendedRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "improve package scripts"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.recommendedFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(paths[0], "package.json", paths.join("\n"));
    assert.equal(new Set(paths).size, paths.length);
    assert.ok(paths.indexOf("package.json") < paths.indexOf("AGENTS.md"), paths.join("\n"));
    assert.ok(paths.includes("docs/ai-context/TASK_ROUTING.md"), paths.join("\n"));
  });
});

test("work --json ranks build task build and config files first", async () => {
  await withRecommendedRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "update build configuration"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.recommendedFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.ok(["tsconfig.json", "vite.config.ts"].includes(paths[0]), paths.join("\n"));
    assert.ok(paths.indexOf(paths[0]) < paths.indexOf("AGENTS.md"), paths.join("\n"));
    assert.ok(paths.some((file) => ["tsconfig.json", "vite.config.ts"].includes(file)), paths.join("\n"));
  });
});

test("work --json ranks matching command implementation first", async () => {
  await withRecommendedRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix work command"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.recommendedFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(paths[0], "src/cli/commands/work.ts", paths.join("\n"));
    assert.ok(paths.indexOf("src/cli/commands/work.ts") < paths.indexOf("src/cli/index.ts"), paths.join("\n"));
  });
});

test("work --json routes RCC work output assembly tasks to work command implementation", async () => {
  await withSelfDevelopmentRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "Workflow-domain tasklarda weak semantic source matches'i task files listesinden çıkar"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const recommendedPaths = brief.recommendedFiles.map((file) => file.path);
    const taskPaths = brief.taskFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(taskPaths[0], "src/cli/commands/work.ts", taskPaths.join("\n"));
    assert.ok(recommendedPaths.includes("src/cli/commands/work.ts"), recommendedPaths.join("\n"));
    assert.ok(recommendedPaths.includes("tests/work.test.js"), recommendedPaths.join("\n"));
    assert.ok(brief.supportingTests.some((file) => file.path === "tests/work.test.js"), JSON.stringify(brief.supportingTests));

    const taskIntentIndex = taskPaths.indexOf("src/core/taskIntent.ts");
    assert.ok(taskIntentIndex === -1 || taskIntentIndex > taskPaths.indexOf("src/cli/commands/work.ts"), taskPaths.join("\n"));
  });
});

test("work --json ranks workflow domain files over bare find action verb", async () => {
  await withWorkflowRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "find Workflow risks"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const taskPaths = brief.taskFiles.map((file) => file.path);
    const hintPaths = brief.targetedLookupHints.map((hint) => hint.path);

    assert.equal(result.status, 0);
    assert.equal(brief.nextCheapestCommand, 'rcc find "workflow"');
    assert.deepEqual(taskPaths.slice(0, 3), [
      ".github/workflows/ai-project-guardian.yml",
      ".github/workflows/ci.yml",
      "package.json"
    ], taskPaths.join("\n"));
    assert.ok(taskPaths.indexOf("src/cli/commands/done.ts") === -1 || taskPaths.indexOf("package.json") < taskPaths.indexOf("src/cli/commands/done.ts"), taskPaths.join("\n"));
    assert.equal(brief.targetedLookupHints.find((hint) => hint.path === "src/cli/commands/done.ts")?.signal, "semantic-match");
    assert.ok(!taskPaths.includes("src/cli/commands/find.ts") || taskPaths.indexOf(".github/workflows/ai-project-guardian.yml") < taskPaths.indexOf("src/cli/commands/find.ts"), taskPaths.join("\n"));
    assert.ok(!hintPaths.includes("src/cli/commands/find.ts") || hintPaths.indexOf(".github/workflows/ai-project-guardian.yml") < hintPaths.indexOf("src/cli/commands/find.ts"), hintPaths.join("\n"));
    assert.ok(brief.contextDocs.some((file) => file.path === "docs/ai-context/RISK_REGISTER.md"), JSON.stringify(brief.contextDocs));
    assert.ok(brief.contextDocs.some((file) => file.path === "docs/ai-context/HOTSPOTS.md"), JSON.stringify(brief.contextDocs));
  });
});

test("work --json does not let weak semantic source matches outrank workflow package files", async () => {
  await withWorkflowRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "find Workflow risks"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const taskPaths = brief.taskFiles.map((file) => file.path);
    const weakSourceHint = brief.targetedLookupHints.find((hint) => hint.path === "src/cli/commands/done.ts");

    assert.equal(result.status, 0);
    assert.equal(taskPaths.includes("src/cli/commands/done.ts"), false, taskPaths.join("\n"));
    assert.equal(weakSourceHint?.signal, "semantic-match");
    assert.match(weakSourceHint?.reason ?? "", /weak semantic match/);
    for (const file of [
      ".github/workflows/ai-project-guardian.yml",
      ".github/workflows/ci.yml",
      "package.json"
    ]) {
      assert.ok(taskPaths.indexOf(file) !== -1, taskPaths.join("\n"));
    }
  });
});

test("work human output keeps workflow task files out of agent rules", async () => {
  await withWorkflowRankingRepo(async (tempDir) => {
    const result = runCli(["work", "find Workflow risks"], { cwd: tempDir });
    const taskFiles = sectionItems(result.stdout, "Task files", "Tests");
    const agentRules = sectionItems(result.stdout, "Agent rules", "Context if unclear");
    const taskPaths = taskFiles.map((line) => line.replace(/^- /, "").replace(/\s+\(.+$/, ""));
    const agentRulePaths = agentRules.map((line) => line.replace(/^- /, "").replace(/\s+\(.+$/, ""));

    assert.equal(result.status, 0);
    assert.ok(taskPaths.includes(".github/workflows/ai-project-guardian.yml"), taskPaths.join("\n"));
    assert.ok(taskPaths.includes(".github/workflows/ci.yml"), taskPaths.join("\n"));
    assert.ok(taskPaths.includes("package.json"), taskPaths.join("\n"));
    assert.ok(agentRulePaths.includes("AGENTS.md"), agentRulePaths.join("\n"));
    assert.ok(!agentRulePaths.includes(".github/workflows/ai-project-guardian.yml"), agentRulePaths.join("\n"));
    assert.ok(!agentRulePaths.includes(".github/workflows/ci.yml"), agentRulePaths.join("\n"));
    assert.ok(!agentRulePaths.includes("package.json"), agentRulePaths.join("\n"));
    assert.equal(new Set([...taskPaths, ...agentRulePaths]).size, taskPaths.length + agentRulePaths.length);
    assert.doesNotMatch(result.stdout, /Workflow \/ agent rules:/);
  });
});

test("work targeted lookup hints rank Turkish role task files before AGENTS", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "Role lerle ilgili bug ihtimallerini bul"], { cwd: tempDir });
    const paths = JSON.parse(result.stdout).targetedLookupHints.map((hint) => hint.path);
    const agentsIndex = paths.indexOf("AGENTS.md");

    assert.equal(result.status, 0);
    assert.notEqual(agentsIndex, -1, paths.join("\n"));
    for (const file of [
      "src/cli/commands/work.ts",
      "src/core/repoFileClassifier.ts",
      "tests/repoFileClassifier.test.js"
    ]) {
      assert.ok(paths.indexOf(file) !== -1, paths.join("\n"));
      assert.ok(paths.indexOf(file) < agentsIndex, paths.join("\n"));
    }
  });
});

test("work --json keeps explicit rcc find command tasks focused on find implementation", async () => {
  await withWorkflowRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix rcc find command"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.recommendedFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(brief.nextCheapestCommand, 'rcc find "find"');
    assert.equal(paths[0], "src/cli/commands/find.ts", paths.join("\n"));
    assert.equal(brief.taskFiles[0].path, "src/cli/commands/find.ts");
    assert.ok(brief.taskFiles.some((file) => file.path === "src/cli/commands/find.ts"), JSON.stringify(brief.taskFiles));
    assert.ok(brief.supportingTests.some((file) => file.path === "tests/find.test.js"), JSON.stringify(brief.supportingTests));
  });
});

test("work --json gives action verbs little direct filename boost", async () => {
  await withWorkflowRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "search Workflow risks"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const taskPaths = brief.taskFiles.map((file) => file.path);
    const actionHint = brief.targetedLookupHints.find((hint) => hint.path === "src/cli/commands/find.ts");

    assert.equal(result.status, 0);
    assert.equal(brief.nextCheapestCommand, 'rcc find "workflow"');
    assert.equal(taskPaths[0], ".github/workflows/ai-project-guardian.yml", taskPaths.join("\n"));
    assert.equal(actionHint, undefined);
  });
});

test("work --json lets domain tokens dominate workflow ranking", async () => {
  await withWorkflowRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "inspect ci release risk"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.taskFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(brief.nextCheapestCommand, 'rcc find "ci"');
    assert.ok(paths[0].startsWith(".github/workflows/"), paths.join("\n"));
    assert.ok(!paths.slice(0, 2).includes("src/cli/commands/find.ts"), paths.join("\n"));
  });
});

test("work --json keeps RCC docs from outranking strong task matches", async () => {
  await withRecommendedRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "improve package scripts"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.recommendedFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(paths[0], "package.json", paths.join("\n"));
    assert.ok(paths.indexOf("package.json") < paths.indexOf("docs/ai-context/TASK_ROUTING.md"), paths.join("\n"));
    assert.ok(brief.readFirstGuidance.skippedForNow.some((item) => item.path === "docs/ai-context/MODULE_INDEX.md"), paths.join("\n"));
  });
});

test("work --json keeps paired tests visible without letting them dominate", async () => {
  await withRecommendedRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix work command"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const recommendedPaths = brief.recommendedFiles.map((file) => file.path);
    const testPaths = brief.relevantTests.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(recommendedPaths[0], "src/cli/commands/work.ts", recommendedPaths.join("\n"));
    assert.ok(testPaths.includes("tests/work.test.js"), testPaths.join("\n"));
    assert.ok(!recommendedPaths.slice(0, 2).includes("tests/work.test.js"), recommendedPaths.join("\n"));
  });
});

test("work human lookup hints include reason and confidence", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "Improve work command lookup hints"], { cwd: tempDir });
    const hints = sectionBody(result.stdout, "Lookup hints", "Next cheapest command");

    assert.equal(result.status, 0);
    assert.match(hints, /1\. src\/cli\/commands\/work\.ts/);
    assert.match(hints, /matched command name "work"; high/);
  });
});

test("work output recommends done with auto file detection", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Done:\n```sh\nrcc done --summary "<summary>" --files auto --verify "<check>"\n```/);
    assert.doesNotMatch(result.stdout, /--files "<files>"/);
  });
});

test("work includes deterministic targeted lookup hints for duplicate AGENTS workflow tasks", () => {
  const result = runCli(["work", "Fix duplicate AGENTS workflow instructions"]);
  const hints = sectionBody(result.stdout, "Lookup hints", "Next cheapest command");

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /Read-first guidance:/);
  assert.ok(result.stdout.indexOf("Lookup hints:") < result.stdout.indexOf("Next cheapest command:"));
  assert.ok(hints.split(/\r?\n/).filter((line) => /^\d+\. /.test(line)).length <= 3, hints);
  assert.match(hints, /AGENTS\.md/);
  assert.match(hints, /src\/templates\/generic\/AGENTS\.md/);
  assert.match(hints, /; high/);
  assert.ok(!hints.includes("docs/ai-context/"), hints);
});

test("work suggests --files auto in the next done command", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });
    const nextDoneCommand = result.stdout.match(
      /Done:\n```sh\n(?<command>rcc done .+)\n```/
    )?.groups?.command;

    assert.equal(result.status, 0);
    assert.equal(nextDoneCommand, 'rcc done --summary "<summary>" --files auto --verify "<check>"');
  });
});

test("work recommends RCC context files when context matches but source is missing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-context-fallback-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Billing work: read `src/billing/missing.ts`, `tests/billing/missing.test.ts`, and `docs/ai-context/MODULE_INDEX.md`."
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
        "| `src/billing` | Billing module | billing, invoice work |"
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/HOTSPOTS.md",
      [
        "# Hotspots",
        "",
        "| Hotspot | Why | Safer Move |",
        "| --- | --- | --- |",
        "| `src/billing/missing.ts` | Billing changes are sensitive | Read billing context first |"
      ].join("\n")
    );

    const result = runCli(["work", "fix billing issue"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Task files:\n- none\. No focused task files were identified\. Use the next cheapest command before broad search\./);
    assert.match(result.stdout, /Agent rules:\n- AGENTS\.md/);
    assert.match(result.stdout, /Context if unclear:\n- docs\/ai-context\/TASK_ROUTING\.md\n- docs\/ai-context\/MODULE_INDEX\.md\n- docs\/ai-context\/HOTSPOTS\.md/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("work shows duplicate decisions only once", async () => {
  await withWorkRepo(async (tempDir) => {
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/DECISIONS.md",
      [
        "# Decisions",
        "",
        "| Date | Decision | Reason | Status | Files |",
        "| --- | --- | --- | --- | --- |",
        "| 2026-06-16 | Keep login flow server-side | Avoid leaking session state | Active | src/auth/login.ts |",
        "| 2026-06-17 | Keep login flow server-side | Avoid leaking session state | Active | src/auth/login.ts |"
      ].join("\n")
    );

    const result = runCli(["work", "--context-budget", "deep", "fix login bug"], { cwd: tempDir });
    const matches = result.stdout.match(/Keep login flow server-side/g) ?? [];

    assert.equal(result.status, 0);
    assert.equal(matches.length, 1);
  });
});

test("work output is concise and agent-oriented", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });
    const lines = result.stdout.trim().split(/\r?\n/);
    const roughTokens = Math.ceil(result.stdout.length / 4);

    assert.equal(result.status, 0);
    assert.ok(lines.length <= 90, `work output has ${lines.length} lines`);
    assert.ok(roughTokens <= 450, `work output is roughly ${roughTokens} tokens`);
    assert.doesNotMatch(result.stdout, /generate code/i);
    assert.match(result.stdout, /Freshness:/);
    assert.match(result.stdout, /Cheapest path:/);
    assert.match(result.stdout, /Task files:/);
    assert.match(result.stdout, /Tests:/);
    assert.match(result.stdout, /Agent rules:/);
    assert.match(result.stdout, /Context if unclear:/);
    assert.match(result.stdout, /Lookup hints:/);
    assert.match(result.stdout, /Done:/);
    assert.doesNotMatch(result.stdout, /Recent logs:/);
    assert.doesNotMatch(result.stdout, /Read-first guidance:/);
    assert.doesNotMatch(result.stdout, /Fast lookup:/);
  });
});
