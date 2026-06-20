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

function assertInvalidWorkArgs(args, cwd) {
  const result = runCli(args, { cwd });

  assert.notEqual(result.status, 0, args.join(" "));
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Usage: rcc work "<task>"/, args.join(" "));

  return result;
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

async function writeHandoffDecisionFixture(root) {
  await writeFixtureFile(
    root,
    "docs/ai-context/TASK_ROUTING.md",
    [
      "# Task Routing",
      "",
      "- Handoff implementation work: read `src/cli/handoff/buildHandoffBrief.ts`, `src/cli/handoff/renderJson.ts`, `src/cli/handoff/renderAgent.ts`, `src/cli/commands/handoff.ts`, and `tests/handoff.test.js`."
    ].join("\n")
  );
  await writeFixtureFile(
    root,
    "docs/ai-context/DECISIONS.md",
    [
      "# Decisions",
      "",
      "| Date | Decision | Reason | Status | Files |",
      "| --- | --- | --- | --- | --- |",
      "| 2026-06-16 | Keep billing webhook retries idempotent | Avoid duplicate invoices | Active | src/billing/webhook.ts |",
      "| 2026-06-17 | Keep handoff architecture guard close to the builder | Preserve agent handoff structure | Active | src/cli/handoff/buildHandoffBrief.ts |",
      "| 2026-06-18 | Keep handoff command thin through delegation | Avoid business logic in command handlers | Active | src/cli/commands/handoff.ts |",
      "| 2026-06-19 | Keep JSON renderer decision output compact | Preserve machine-readable handoff JSON | Active | src/cli/handoff/renderJson.ts |"
    ].join("\n")
  );
  await writeFixtureFile(root, "src/cli/handoff/buildHandoffBrief.ts", "export function buildHandoffBrief() {}\n");
  await writeFixtureFile(root, "src/cli/handoff/renderJson.ts", "export function renderHandoffJson() {}\n");
  await writeFixtureFile(root, "src/cli/handoff/renderAgent.ts", "export function renderHandoffAgent() {}\n");
  await writeFixtureFile(root, "src/cli/commands/handoff.ts", "export function handoffCommand() {}\n");
  await writeFixtureFile(root, "tests/handoff.test.js", "test('handoff', () => {});\n");
  await writeFixtureFile(root, "src/billing/webhook.ts", "export function webhook() {}\n");
}

async function withLookupRankingRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-ranking-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\nrole role role role role role role role role role\n");
    await writeFixtureFile(tempDir, "src/templates/generic/AGENTS.md", "Generic repo guidance\ncurrent RCC architecture\n");
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
    await writeFixtureFile(tempDir, "src/cli/commands/doctor.ts", "export const doctor = 'current RCC architecture architecture architecture';\n");
    await writeFixtureFile(tempDir, "src/cli/commands/other.ts", "export const note = 'work lookup hint';\n");
    await writeFixtureFile(tempDir, "src/core/scanner.ts", "export const scanner = 'current RCC architecture architecture architecture';\n");
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

async function withDocumentationRoutingRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-doc-routing-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(tempDir, "README.md", "# RCC\n\nAgent workflow and measurement capabilities for v0.9.\n");
    await writeFixtureFile(tempDir, "CHANGELOG.md", "# Changelog\n");
    await writeFixtureFile(tempDir, ".github/workflows/ai-project-guardian.yml", "name: ai-project-guardian\non: [push]\n");
    await writeFixtureFile(tempDir, ".github/workflows/ci.yml", "name: ci\non: [push]\n");
    await writeFixtureFile(tempDir, "package.json", "{\"name\":\"repo-context-center\",\"version\":\"0.9.0\",\"scripts\":{\"release\":\"npm publish\"}}\n");
    await writeFixtureFile(tempDir, "src/cli/commands/work.ts", "export function workCommand() {}\n");
    await writeFixtureFile(tempDir, "src/cli/commands/measure.ts", "export function measureCommand() {}\n");
    await writeFixtureFile(tempDir, "src/core/tokenEstimator.ts", "export function estimateTokens() {}\n");
    await writeFixtureFile(tempDir, "src/cli/index.ts", "export const commands = { work: true, measure: true };\n");
    await writeFixtureFile(tempDir, "tests/estimate.test.js", "test('measure token saving', () => {});\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Workflow risk detection: read `.github/workflows/ai-project-guardian.yml` and `.github/workflows/ci.yml`.",
        "- Measurement command: read `src/cli/commands/measure.ts`, `src/core/tokenEstimator.ts`, `src/cli/index.ts`, and `tests/estimate.test.js`."
      ].join("\n")
    );

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

async function withLearningRoutingRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-learning-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(tempDir, "src/cli/commands/work.ts", "export function workCommand() {}\n");
    await writeFixtureFile(tempDir, "src/cli/commands/doctor.ts", "export function doctorCommand() {}\n");
    await writeFixtureFile(tempDir, "src/cli/work/renderAgent.ts", "export function renderWorkAgent() {}\n");
    await writeFixtureFile(tempDir, "src/cli/handoff/buildHandoffBrief.ts", "export function buildHandoffBrief() {}\n");
    await writeFixtureFile(tempDir, "src/cli/handoff/renderAgent.ts", "export function renderHandoffAgent() {}\n");
    await writeFixtureFile(tempDir, "src/cli/handoff/renderJson.ts", "export function renderHandoffJson() {}\n");
    await writeFixtureFile(tempDir, "tests/work.test.js", "test('work', () => {});\n");
    await writeFixtureFile(tempDir, "tests/handoff.test.js", "test('handoff', () => {});\n");
    await writeFixtureFile(tempDir, "tests/doctor.test.js", "test('doctor', () => {});\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/REPOSITORY_LEARNING.md",
      [
        "# Repository Learning",
        "",
        "<!-- repo-context-center:repository-learning:start -->",
        "## Generated Repo Map",
        "",
        "## Common File Relationships",
        "",
        "| Source | Related | Reason | Count |",
        "| --- | --- | --- | ---: |",
        "| handoff | `tests/handoff.test.js` | Observed in completed handoff work | 4 |",
        "| handoff | `src/cli/handoff/buildHandoffBrief.ts` | Observed in completed handoff work | 3 |",
        "| handoff | `src/cli/handoff/renderAgent.ts` | Observed in completed handoff work | 2 |",
        "| work | `src/cli/commands/work.ts` | Observed in completed work tasks | 4 |",
        "| work | `tests/work.test.js` | Observed in completed work tasks | 3 |",
        "| repo | `src/cli/commands/doctor.ts` | generic should not route alone | 9 |",
        "| handoff | `docs/ai-context/archive/WORK_LOG_ARCHIVE.md` | archive noise | 9 |",
        "| handoff | `dist/cli/index.js` | generated noise | 9 |",
        "| handoff | `src/one-off.ts` | one-off noise | 1 |",
        "",
        "## Frequently Modified Together",
        "",
        "| Files | Count | Recent summary |",
        "| --- | ---: | --- |",
        "| `src/cli/handoff/buildHandoffBrief.ts`, `tests/handoff.test.js` | 3 | Updated handoff brief |",
        "| `src/cli/commands/work.ts`, `tests/work.test.js` | 3 | Updated work route |",
        "",
        "## Verification Patterns",
        "",
        "| Scope | Command | Count |",
        "| --- | --- | ---: |",
        "| build | `npm run build` | 8 |",
        "| handoff | `node --test tests/handoff.test.js` | 4 |",
        "| work | `node --test tests/work.test.js` | 3 |",
        "| handoff | `node --test tests/one-off.test.js` | 1 |",
        "",
        "## Repository Habits",
        "",
        "- Verification commands are recorded with completed work (5/6).",
        "- Tests are commonly changed with related implementation work (4/6).",
        "- Follow-ups are captured when residual tasks remain (2/6).",
        "",
        "<!-- repo-context-center:repository-learning:end -->",
        ""
      ].join("\n")
    );

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("work runs without arguments", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = assertInvalidWorkArgs(["work"], tempDir);

    assert.doesNotMatch(result.stdout, /Unspecified task/);
  });
});

test("work rejects missing task with usage", async () => {
  await withWorkRepo(async (tempDir) => {
    assertInvalidWorkArgs(["work", "--json"], tempDir);
  });
});

test("work rejects invalid context budget with usage", async () => {
  await withWorkRepo(async (tempDir) => {
    assertInvalidWorkArgs(["work", "--context-budget", "wide", "fix login bug"], tempDir);
  });
});

test("work rejects invalid max-files with usage", async () => {
  await withWorkRepo(async (tempDir) => {
    for (const args of [
      ["work", "--max-files", "0", "fix login bug"],
      ["work", "--max-files", "many", "fix login bug"]
    ]) {
      assertInvalidWorkArgs(args, tempDir);
    }
  });
});

test("work rejects unknown flags with usage", async () => {
  await withWorkRepo(async (tempDir) => {
    assertInvalidWorkArgs(["work", "fix login bug", "--unknown"], tempDir);
  });
});

test("work accepts a task string and recommends focused files", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Task:\nfix login bug/);
    assert.match(result.stdout, /Freshness:\n(fresh|maybe_stale|stale|unknown) \d+\/100 — /);
    assert.match(result.stdout, /Primary files:\n- src\/auth\/login\.ts/);
    assert.match(result.stdout, /Tests:\n- tests\/auth\/login\.test\.ts/);
    assert.match(result.stdout, /Supporting files:\n- none\. Use only if primary files are insufficient\./);
    assert.match(result.stdout, /Agent rules:\n- AGENTS\.md/);
    assert.match(result.stdout, /Context if unclear:\n- docs\/ai-context\/TASK_ROUTING\.md/);
    assert.match(result.stdout, /Known risks:\n- high/);
    assert.match(result.stdout, /Next:\nStart with primary files\./);
    assert.match(result.stdout, /Do not rerun rcc work for the same task unless the task meaning changes\./);
    assert.match(result.stdout, /Use rcc find "login" only if primary\/supporting files are insufficient\./);
    assert.ok(result.stdout.indexOf("Primary files:") < result.stdout.indexOf("Tests:"));
    assert.ok(result.stdout.indexOf("Tests:") < result.stdout.indexOf("Supporting files:"));
    assert.ok(result.stdout.indexOf("Supporting files:") < result.stdout.indexOf("Agent rules:"));
    assert.ok(result.stdout.indexOf("Agent rules:") < result.stdout.indexOf("Context if unclear:"));
    assert.doesNotMatch(result.stdout, /Cheapest path:/);
    assert.doesNotMatch(result.stdout, /Lookup hints:/);
    assert.doesNotMatch(result.stdout, /Next cheapest command:/);
    assert.doesNotMatch(result.stdout, /Done:/);
    assert.doesNotMatch(result.stdout, /Recent logs:/);
    assert.doesNotMatch(result.stdout, /Read-first guidance:/);
    assert.doesNotMatch(result.stdout, /Fast lookup:/);
    assert.doesNotMatch(result.stdout, /rcc done "<summary>"/);
  });
});

test("work --json returns compact machine-readable startup JSON", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(
      Object.keys(brief),
      [
        "schemaVersion",
        "command",
        "task",
        "contextBudget",
        "freshness",
        "taskFiles",
        "primaryFiles",
        "supportingFiles",
        "tests",
        "agentRules",
        "readFirst",
        "contextIfUnclear",
        "nextLookup",
        "nextCommand",
        "reusePolicy",
        "tokens"
      ]
    );
    assert.equal(brief.schemaVersion, 1);
    assert.equal(brief.command, "work");
    assert.equal(brief.task, "fix login bug");
    assert.equal(brief.contextBudget, "balanced");
    assert.equal(typeof brief.freshness.status, "string");
    assert.equal(typeof brief.freshness.score, "number");
    assert.equal(typeof brief.freshness.reason, "string");
    assert.ok(brief.primaryFiles.some((file) => file.path === "src/auth/login.ts"));
    assert.deepEqual(brief.supportingFiles, []);
    assert.ok(brief.taskFiles.some((file) => file.path === "src/auth/login.ts"));
    assert.ok(brief.tests.some((file) => file.path === "tests/auth/login.test.ts"));
    assert.ok(brief.agentRules.some((file) => file.path === "AGENTS.md"));
    assert.ok(brief.readFirst.includes("AGENTS.md"));
    assert.ok(brief.contextIfUnclear.includes("docs/ai-context/TASK_ROUTING.md"));
    assert.equal(brief.nextLookup, 'rcc find "login"');
    assert.equal(brief.nextCommand, 'rcc done --summary "<summary>" --files auto --verify "<check>"');
    assert.equal(brief.reusePolicy, "Call once per task. Do not rerun work unless task meaning changes. Use rcc find if route is insufficient.");
    assert.equal(typeof brief.tokens.jsonEstimate, "number");
    assert.equal(result.stdout, `${JSON.stringify(brief, null, 2)}\n`);
    assert.equal(result.stdout.trim().startsWith("{"), true);
    assert.equal(result.stdout.trim().endsWith("}"), true);
    for (const omitted of [
      "recommendedFiles",
      "relevantTests",
      "promotedFromTargetedLookup",
      "targetedLookupHints",
      "recentLogs",
      "avoid",
      "readFirstGuidance",
      "affectedContextFiles"
    ]) {
      assert.equal(omitted in brief, false);
    }
  });
});

test("work --agent prints valid compact JSON only", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug", "--agent"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, `${JSON.stringify(route)}\n`);
    assert.deepEqual(
      Object.keys(route),
      [
        "task",
        "primaryFiles",
        "supportingFiles",
        "tests",
        "readFirst",
        "next",
        "briefTokens"
      ]
    );
    assert.equal(route.task, "fix login bug");
    assert.deepEqual(route.primaryFiles, ["src/auth/login.ts"]);
    assert.deepEqual(route.supportingFiles, []);
    assert.deepEqual(route.tests, ["tests/auth/login.test.ts"]);
    assert.ok(route.readFirst.includes("AGENTS.md"));
    assert.equal(route.next, 'Start with primaryFiles. Do not rerun work for this task. Use rcc find "login" only if needed.');
    assert.equal(typeof route.briefTokens, "number");
    assert.doesNotMatch(result.stdout, /```|repo-context-center work brief|Primary files:/);
  });
});

test("work --agent compact output omits duplicated legacy arrays", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "--agent", "fix login bug"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    for (const omitted of [
      "recommendedFiles",
      "taskFiles",
      "lookupHints",
      "targetedLookupHints",
      "supportingTests",
      "workflowDocs",
      "contextDocs",
      "agentRules",
      "contextIfUnclear",
      "naiveTokens",
      "rccTokens",
      "estimatedSavingTokens",
      "estimatedSavingPercent"
    ]) {
      assert.equal(omitted in route, false);
    }
    assert.ok(route.primaryFiles.every((file) => typeof file === "string"));
    assert.ok(route.tests.every((file) => typeof file === "string"));
  });
});

test("work --agent --verbose includes route reasons without legacy arrays", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "--agent", "--verbose", "fix login bug"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(route.primaryFiles[0], {
      path: "src/auth/login.ts",
      reason: 'matched filename stem "login"'
    });
    assert.equal(typeof route.tests[0].path, "string");
    assert.equal(typeof route.tests[0].reason, "string");
    assert.equal("targetedLookupHints" in route, false);
  });
});

test("work --json --debug returns the detailed machine-readable brief", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "fix login bug"], { cwd: tempDir });
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
        "primaryFiles",
        "supportingFiles",
        "tests",
        "agentRules",
        "contextIfUnclear",
        "taskFiles",
        "supportingTests",
        "workflowDocs",
        "contextDocs",
        "cheapestPath",
        "avoid",
        "nextCheapestCommand",
        "promotedFromTargetedLookup",
        "learnedRelatedFiles",
        "learnedTests",
        "learnedVerification",
        "learnedHabits",
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
    assert.equal(brief.primaryFiles[0].path, "src/auth/login.ts");
    assert.deepEqual(brief.supportingFiles, []);
    assert.ok(brief.tests.some((file) => file.path === "tests/auth/login.test.ts"));
    assert.ok(brief.agentRules.some((file) => file.path === "AGENTS.md"));
    assert.ok(brief.contextIfUnclear.some((file) => file.path === "docs/ai-context/TASK_ROUTING.md"));
    assert.equal(brief.taskFiles[0].path, "src/auth/login.ts");
    assert.ok(brief.supportingTests.some((file) => file.path === "tests/auth/login.test.ts"));
    assert.ok(brief.workflowDocs.some((file) => file.path === "AGENTS.md"));
    assert.ok(brief.contextDocs.some((file) => file.path === "docs/ai-context/TASK_ROUTING.md"));
    assert.deepEqual(brief.cheapestPath, [
      "Inspect the primary files listed below.",
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
    assert.deepEqual(brief.learnedRelatedFiles, []);
    assert.deepEqual(brief.learnedTests, []);
    assert.deepEqual(brief.learnedVerification, []);
    assert.deepEqual(brief.learnedHabits, []);
    assert.ok(brief.targetedLookupHints.some((hint) => (
      hint.path === "src/auth/login.ts"
      && hint.reason
      && hint.signal
      && hint.confidence
      && typeof hint.score === "number"
    )));
    assert.ok(brief.relevantDecisions.some((decision) => decision.includes("Keep login flow server-side")));
    assert.equal(typeof brief.tokenEstimate.humanBriefTokens, "number");
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

test("work routing uses learned handoff relationships without adding learning to readFirst", async () => {
  await withLearningRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "improve handoff output"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const routedFiles = [
      ...brief.primaryFiles.map((file) => file.path),
      ...brief.supportingFiles.map((file) => file.path)
    ];
    const tests = brief.tests.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.ok(routedFiles.includes("src/cli/handoff/buildHandoffBrief.ts"), routedFiles.join("\n"));
    assert.ok(routedFiles.includes("src/cli/handoff/renderAgent.ts"), routedFiles.join("\n"));
    assert.ok(tests.includes("tests/handoff.test.js"), tests.join("\n"));
    assert.deepEqual(brief.learnedRelatedFiles, [
      "src/cli/handoff/buildHandoffBrief.ts",
      "src/cli/handoff/renderAgent.ts"
    ]);
    assert.deepEqual(brief.learnedTests, ["tests/handoff.test.js"]);
    assert.deepEqual(brief.learnedVerification, ["node --test tests/handoff.test.js"]);
    assert.deepEqual(brief.learnedHabits, [
      "Verification commands are recorded with completed work (5/6).",
      "Tests are commonly changed with related implementation work (4/6)."
    ]);
    assert.ok(brief.learnedRelatedFiles.length + brief.learnedTests.length <= 3);
    assert.ok(brief.learnedVerification.length <= 2);
    assert.ok(brief.learnedHabits.length <= 2);
    assert.ok(!brief.readFirst.includes("docs/ai-context/REPOSITORY_LEARNING.md"), JSON.stringify(brief.readFirst));
    assert.equal(brief.learnedRelatedFiles.some((file) => file.includes("archive") || file.startsWith("dist/")), false);
  });
});

test("work routing uses learned work relationships and tests", async () => {
  await withLearningRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "update work routing"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const primary = brief.primaryFiles.map((file) => file.path);
    const tests = brief.tests.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.ok(primary.includes("src/cli/commands/work.ts"), primary.join("\n"));
    assert.ok(tests.includes("tests/work.test.js"), tests.join("\n"));
    assert.deepEqual(brief.learnedRelatedFiles, ["src/cli/commands/work.ts"]);
    assert.deepEqual(brief.learnedTests, ["tests/work.test.js"]);
    assert.deepEqual(brief.learnedVerification, ["node --test tests/work.test.js"]);
    assert.deepEqual(brief.learnedHabits, [
      "Verification commands are recorded with completed work (5/6).",
      "Tests are commonly changed with related implementation work (4/6)."
    ]);
  });
});

test("work routing leaves unrelated tasks without learned hints", async () => {
  await withLearningRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "adjust billing invoices"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(brief.learnedRelatedFiles, []);
    assert.deepEqual(brief.learnedTests, []);
    assert.deepEqual(brief.learnedVerification, []);
    assert.deepEqual(brief.learnedHabits, []);
    assert.equal(brief.supportingFiles.some((file) => file.path === "src/cli/commands/doctor.ts"), false);
  });
});

test("work exact filename routing stays primary ahead of learned hints", async () => {
  await withLearningRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "fix doctor.ts work routing"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const primary = brief.primaryFiles.map((file) => file.path);
    const supporting = brief.supportingFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(primary[0], "src/cli/commands/doctor.ts");
    assert.ok(primary.includes("src/cli/commands/work.ts") || supporting.includes("src/cli/commands/work.ts"));
    assert.equal(brief.targetedLookupHints[0].signal, "exact-filename-match");
  });
});

test("work --agent stays compact when learned routing contributes files", async () => {
  await withLearningRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "--agent", "improve handoff output"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(
      Object.keys(route),
      [
        "task",
        "primaryFiles",
        "supportingFiles",
        "tests",
        "readFirst",
        "next",
        "briefTokens"
      ]
    );
    assert.ok(
      [...route.primaryFiles, ...route.supportingFiles].includes("src/cli/handoff/buildHandoffBrief.ts"),
      [...route.primaryFiles, ...route.supportingFiles].join("\n")
    );
    assert.ok(route.tests.includes("tests/handoff.test.js"), route.tests.join("\n"));
    assert.doesNotMatch(result.stdout, /Repository learning|learnedRelatedFiles|learnedVerification|learnedHabits/);
  });
});

test("work default output shows compact repository learning only for useful matches", async () => {
  await withLearningRoutingRepo(async (tempDir) => {
    const handoff = runCli(["work", "improve handoff output"], { cwd: tempDir });
    const unrelated = runCli(["work", "adjust billing invoices"], { cwd: tempDir });

    assert.equal(handoff.status, 0);
    assert.match(handoff.stdout, /Repository learning:\n- similar work often touches tests\/handoff\.test\.js/);
    assert.match(handoff.stdout, /similar changes usually verify with node --test tests\/handoff\.test\.js/);
    assert.ok(sectionBody(handoff.stdout, "Repository learning", "Next").split(/\r?\n/).filter((line) => line.startsWith("- ")).length <= 4);
    assert.equal(unrelated.status, 0);
    assert.doesNotMatch(unrelated.stdout, /Repository learning:/);
  });
});

test("work classifies package tasks as medium risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "improve package scripts"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "medium");
  });
});

test("work classifies dependency tasks as medium risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "update dependencies"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "medium");
  });
});

test("work classifies docs tasks as low risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "fix typo in README"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "low");
  });
});

test("work classifies auth tasks as high risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "fix login authorization"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "high");
  });
});

test("work classifies deployment tasks as high risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "update deployment config"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.risks[0].level, "high");
  });
});

test("work classifies workflow tasks as high risk", async () => {
  await withRiskClassificationRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "update deployment workflow"], { cwd: tempDir });
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
    assert.match(result.stdout, /Next:\nStart with primary files if listed\./);
    assert.match(result.stdout, /No strong primary files were found\./);
    assert.match(result.stdout, /Do not rerun rcc work for the same task unless the task meaning changes\./);
    assert.match(result.stdout, /Use rcc find "unknown" only if primary\/supporting files are insufficient\./);
    assert.doesNotMatch(result.stdout, /Recent logs:/);
    assert.doesNotMatch(result.stdout, /Read-first guidance:/);
    assert.doesNotMatch(result.stdout, /Fast lookup:/);
    assert.match(result.stdout, /rcc find "<keyword>"/);
    assert.doesNotMatch(result.stdout, /Done:/);
    assert.doesNotMatch(result.stdout, /rcc done "<summary>"/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("work --json keeps stable fields when RCC data is missing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-json-empty-"));

  try {
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");

    const result = runCli(["work", "unknown task", "--json", "--debug"], { cwd: tempDir });
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
    assert.equal(brief.tokenEstimate.humanBriefTokens === null || Number.isInteger(brief.tokenEstimate.humanBriefTokens), true);
    assert.equal(brief.fastLookup.guidance, "Prefer this before broad repo search when the target is unclear.");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("work prunes read-first guidance for a small focused task", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "fix login bug"], { cwd: tempDir });
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

test("work read-first guidance default balanced keeps AGENTS required and TASK_ROUTING optional", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.contextBudget, "balanced");
    assert.deepEqual(brief.readFirstGuidance.required, [
      {
        path: "AGENTS.md",
        reason: "repository agent workflow"
      }
    ]);
    assert.ok(brief.readFirstGuidance.optionalIfUnclear.some((item) => (
      item.path === "docs/ai-context/TASK_ROUTING.md"
      && item.reason === "routing appears strong, but use if targeted hints are insufficient"
    )));
    assert.ok(!brief.readFirst.includes("docs/ai-context/TASK_ROUTING.md"), JSON.stringify(brief.readFirst));
  });
});

test("work read-first guidance minimal budget keeps signaled docs optional", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "--context-budget", "minimal", "fix freshness reporting risk"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(brief.readFirst, ["AGENTS.md"]);
    assert.deepEqual(brief.readFirstGuidance.taskSpecific, []);
    assert.ok(brief.readFirstGuidance.optionalIfUnclear.some((item) => item.path === "docs/ai-context/RISK_REGISTER.md"));
    assert.ok(brief.readFirstGuidance.optionalIfUnclear.some((item) => item.path === "docs/ai-context/TASK_ROUTING.md"));
  });
});

test("work read-first guidance deep budget includes broader context in readFirst", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "--context-budget", "deep", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(brief.readFirst.includes("AGENTS.md"), JSON.stringify(brief.readFirst));
    assert.ok(brief.readFirst.includes("docs/ai-context/TASK_ROUTING.md"), JSON.stringify(brief.readFirst));
    assert.ok(brief.readFirstGuidance.taskSpecific.some((item) => item.path === "docs/ai-context/MODULE_INDEX.md"));
    assert.ok(brief.readFirstGuidance.optionalIfUnclear.some((item) => item.path === "docs/ai-context/DEPENDENCY_MAP.md"));
    assert.ok(brief.readFirstGuidance.optionalIfUnclear.some((item) => item.path === "docs/ai-context/RISK_REGISTER.md"));
  });
});

test("work read-first guidance requires AGENTS.md when present", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "clean up"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(brief.readFirstGuidance.required.map((item) => item.path), ["AGENTS.md"]);
    assert.deepEqual(brief.readFirst, ["AGENTS.md", "docs/ai-context/TASK_ROUTING.md"]);
  });
});

test("work read-first guidance keeps TASK_ROUTING optional when routing is strong", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.readFirstGuidance.taskSpecific.some((item) => item.path === "docs/ai-context/TASK_ROUTING.md"), false);
    assert.ok(brief.readFirstGuidance.optionalIfUnclear.some((item) => item.path === "docs/ai-context/TASK_ROUTING.md"));
  });
});

test("work read-first guidance promotes risk context for security and freshness tasks", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "fix freshness reporting risk"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "update package build integration"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "refactor auth service architecture"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "clean up"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(brief.readFirstGuidance.taskSpecific.some((item) => (
      item.path === "docs/ai-context/TASK_ROUTING.md"
    )));
  });
});

test("work --context-budget minimal keeps only AGENTS required", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "--context-budget", "minimal", "fix freshness reporting risk"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "--context-budget", "balanced", "fix login bug"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "--context-budget", "deep", "fix login bug"], { cwd: tempDir });
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
    const minimal = runCli(["work", "fix login bug", "--json", "--debug", "--context-budget", "minimal"], { cwd: tempDir });
    const deep = runCli(["work", "fix login bug", "--context-budget", "deep", "--json", "--debug"], { cwd: tempDir });
    const maxFiles = runCli(["work", "fix login bug", "--json", "--debug", "--max-files", "1"], { cwd: tempDir });

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
    const result = runCli(["work", "fix login bug", "--json", "--debug"], { cwd: tempDir });
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

    const result = runCli(["work", "--json", "--debug", "update cli"], { cwd: tempDir });
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

test("work freshness uses map generation date from changelog metadata", async () => {
  await withFreshnessRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "docs/ai-context/CHANGE_LOG.md", [
      "# Change Log",
      "",
      "| Date | Command | Files updated | Reason |",
      "| --- | --- | --- | --- |",
      "| 2026-06-18 | `repo-context-center map --write` | 13 context files | generated repo-specific context map |"
    ].join("\n"));
    await setFixtureMtime(tempDir, "docs/ai-context/CHANGE_LOG.md", new Date("2026-06-17T11:00:00.000Z"));
    await setFixtureMtime(tempDir, "src/index.ts", new Date("2026-06-17T13:00:00.000Z"));

    const result = runCli(["work", "--json", "--debug", "update cli"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.mapFreshness.status, "fresh");
    assert.equal(brief.mapFreshness.latestContextUpdate, "2026-06-18T00:00:00.000Z");
    assert.equal(brief.mapFreshness.latestRelevantSourceChange, "2026-06-17T13:00:00.000Z");
  });
});

test("work freshness changes after touching a source file", async () => {
  await withFreshnessRepo(async (tempDir) => {
    const fresh = JSON.parse(runCli(["work", "--json", "--debug", "update cli"], { cwd: tempDir }).stdout);
    assert.equal(fresh.mapFreshness.status, "fresh");

    await setFixtureMtime(tempDir, "src/index.ts", new Date("2026-06-17T13:00:00.000Z"));

    const stale = JSON.parse(runCli(["work", "--json", "--debug", "update cli"], { cwd: tempDir }).stdout);
    assert.equal(stale.mapFreshness.status, "stale");
    assert.ok(stale.mapFreshness.affectedFiles.includes("src/index.ts"));
  });
});

test("work --json ranks exact command hints above folder and weak matches", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "Improve work command lookup hints"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "Improve work command lookup hints"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "Improve work command lookup hints"], { cwd: tempDir });
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

    const result = runCli(["work", "--json", "--debug", "Improve work command lookup hints"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "Role lerle ilgili bug ihtimallerini bul"], { cwd: tempDir });
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
    const taskFiles = sectionBody(result.stdout, "Primary files", "Tests");
    const supportingTests = sectionBody(result.stdout, "Tests", "Agent rules");
    const supportingFiles = sectionBody(result.stdout, "Supporting files", "Agent rules");
    const workflowDocs = sectionBody(result.stdout, "Agent rules", "Context if unclear");
    const contextDocs = sectionBody(result.stdout, "Context if unclear", "Next");

    assert.equal(result.status, 0);
    assert.ok(result.stdout.indexOf("Primary files:") < result.stdout.indexOf("Context if unclear:"));
    assert.ok(result.stdout.indexOf("Primary files:") < result.stdout.indexOf("Tests:"));
    assert.ok(result.stdout.indexOf("Tests:") < result.stdout.indexOf("Supporting files:"));
    assert.match(taskFiles, /src\/core\/repoFileClassifier\.ts/);
    assert.match(taskFiles, /src\/cli\/commands\/work\.ts/);
    assert.doesNotMatch(taskFiles, /AGENTS\.md/);
    assert.doesNotMatch(taskFiles, /docs\/ai-context/);
    assert.match(supportingFiles, /none/);
    assert.match(supportingTests, /tests\/repoFileClassifier\.test\.js/);
    assert.doesNotMatch(supportingTests, /tests\/estimate\.test\.js/);
    assert.match(workflowDocs, /AGENTS\.md/);
    assert.match(contextDocs, /docs\/ai-context\/TASK_ROUTING\.md/);
    assert.match(contextDocs, /docs\/ai-context\/MODULE_INDEX\.md/);
    assert.doesNotMatch(result.stdout, /Read-first guidance:/);
    assert.doesNotMatch(result.stdout, /Recommended:\nrcc map --write/);
    assert.doesNotMatch(result.stdout, /Lookup hints:/);
    assert.match(result.stdout, /Next:\nStart with primary files\./);
    assert.match(result.stdout, /Do not rerun rcc work for the same task unless the task meaning changes\./);
    assert.match(result.stdout, /Use rcc find "role" only if primary\/supporting files are insufficient\./);
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

    const result = runCli(["work", "--json", "--debug", "role"], { cwd: tempDir });
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

    const result = runCli(["work", "--json", "--debug", "improve package scripts"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "improve package scripts"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "update build configuration"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "fix work command"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.recommendedFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(paths[0], "src/cli/commands/work.ts", paths.join("\n"));
    assert.ok(paths.indexOf("src/cli/commands/work.ts") < paths.indexOf("src/cli/index.ts"), paths.join("\n"));
  });
});

test("work --json routes RCC work output assembly tasks to work command implementation", async () => {
  await withSelfDevelopmentRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "Workflow-domain tasklarda weak semantic source matches'i task files listesinden çıkar"], { cwd: tempDir });
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

test("work categorizes exact AGENTS filename matches as primary files", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "recalibrate AGENTS.md for current RCC architecture"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const primaryPaths = brief.primaryFiles.map((file) => file.path);
    const supportingPaths = brief.supportingFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.ok(primaryPaths.includes("AGENTS.md"), primaryPaths.join("\n"));
    assert.ok(primaryPaths.includes("src/templates/generic/AGENTS.md"), primaryPaths.join("\n"));
    assert.ok(!supportingPaths.includes("AGENTS.md"), supportingPaths.join("\n"));
    assert.ok(!supportingPaths.includes("src/templates/generic/AGENTS.md"), supportingPaths.join("\n"));
    assert.ok(primaryPaths.indexOf("AGENTS.md") < supportingPaths.indexOf("src/cli/commands/doctor.ts") || !supportingPaths.includes("src/cli/commands/doctor.ts"));
    assert.ok(!primaryPaths.includes("src/cli/commands/doctor.ts"), primaryPaths.join("\n"));
    assert.ok(!primaryPaths.includes("src/core/scanner.ts"), primaryPaths.join("\n"));
  });
});

test("work --agent exact filename task puts AGENTS files in primaryFiles", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "recalibrate AGENTS.md for current RCC architecture", "--agent"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(route.primaryFiles.includes("AGENTS.md"), route.primaryFiles.join("\n"));
    assert.ok(route.primaryFiles.includes("src/templates/generic/AGENTS.md"), route.primaryFiles.join("\n"));
    assert.ok(!route.primaryFiles.includes("src/cli/commands/doctor.ts"), route.primaryFiles.join("\n"));
    assert.ok(route.readFirst.includes("AGENTS.md"), route.readFirst.join("\n"));
    assert.equal(route.next, 'Start with primaryFiles. Do not rerun work for this task. Use rcc find "agents.md" only if needed.');
  });
});

test("work categorizes workflow risk files as primary over weak semantic source matches", async () => {
  await withWorkflowRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "fix workflow risk detection"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const primaryPaths = brief.primaryFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.ok(primaryPaths.includes(".github/workflows/ai-project-guardian.yml"), primaryPaths.join("\n"));
    assert.ok(primaryPaths.includes(".github/workflows/ci.yml"), primaryPaths.join("\n"));
    assert.equal(primaryPaths.includes("src/cli/commands/done.ts"), false, primaryPaths.join("\n"));
  });
});

test("work --agent workflow task keeps weak semantic source matches out of primaryFiles", async () => {
  await withWorkflowRankingRepo(async (tempDir) => {
    const result = runCli(["work", "fix workflow risk detection", "--agent"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(route.primaryFiles.includes(".github/workflows/ai-project-guardian.yml"), route.primaryFiles.join("\n"));
    assert.ok(route.primaryFiles.includes(".github/workflows/ci.yml"), route.primaryFiles.join("\n"));
    assert.equal(route.primaryFiles.includes("src/cli/commands/done.ts"), false, route.primaryFiles.join("\n"));
    assert.equal(route.primaryFiles.some((file) => file.startsWith("src/cli/commands/")), false, route.primaryFiles.join("\n"));
  });
});

test("work --agent prioritizes explicit README target over version and workflow words", async () => {
  await withDocumentationRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "update README for v0.9 workflow and measurement capabilities", "--agent"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(route.primaryFiles.includes("README.md"), route.primaryFiles.join("\n"));
    assert.equal(route.primaryFiles[0].startsWith(".github/workflows/"), false, route.primaryFiles.join("\n"));
    assert.ok(route.primaryFiles.indexOf("package.json") === -1 || route.primaryFiles.indexOf("README.md") < route.primaryFiles.indexOf("package.json"), route.primaryFiles.join("\n"));
    assert.deepEqual(route.tests, [], route.tests.join("\n"));
    assert.ok(route.briefTokens < 220, String(route.briefTokens));
  });
});

test("work --agent treats agent workflow README task as documentation", async () => {
  await withDocumentationRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "document the new agent workflow in README", "--agent"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(route.primaryFiles.includes("README.md"), route.primaryFiles.join("\n"));
    assert.equal(route.primaryFiles.some((file) => file.startsWith(".github/workflows/")), false, route.primaryFiles.join("\n"));
  });
});

test("work --agent keeps GitHub Actions workflow task on workflow files", async () => {
  await withDocumentationRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "fix workflow risk detection", "--agent"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(route.primaryFiles.includes(".github/workflows/ai-project-guardian.yml"), route.primaryFiles.join("\n"));
    assert.ok(route.primaryFiles.includes(".github/workflows/ci.yml"), route.primaryFiles.join("\n"));
    assert.equal(route.primaryFiles.includes("README.md"), false, route.primaryFiles.join("\n"));
  });
});

test("work categorizes output assembly implementation as primary and tests separately", async () => {
  await withSelfDevelopmentRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "improve rcc work output assembly"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const primaryPaths = brief.primaryFiles.map((file) => file.path);
    const testPaths = brief.tests.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.ok(primaryPaths.includes("src/cli/commands/work.ts"), primaryPaths.join("\n"));
    assert.ok(testPaths.includes("tests/work.test.js"), testPaths.join("\n"));
    assert.equal(primaryPaths.includes("tests/work.test.js"), false, primaryPaths.join("\n"));
  });
});

test("work --json ranks workflow domain files over bare find action verb", async () => {
  await withWorkflowRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "find Workflow risks"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "find Workflow risks"], { cwd: tempDir });
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
    const taskFiles = sectionItems(result.stdout, "Primary files", "Supporting files");
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
    const result = runCli(["work", "--json", "--debug", "Role lerle ilgili bug ihtimallerini bul"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "fix rcc find command"], { cwd: tempDir });
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

test("work --json routes token measurement tasks to measure command and estimator", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-token-measure-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(tempDir, "docs/ai-context/TASK_ROUTING.md", "# Task Routing\n");
    await writeFixtureFile(tempDir, "src/cli/commands/measure.ts", "export function measureCommand() {}\n");
    await writeFixtureFile(tempDir, "src/core/tokenEstimator.ts", "export function estimateTokens() {}\n");
    await writeFixtureFile(tempDir, "tests/estimate.test.js", "test('measure token estimate', () => {});\n");
    await writeFixtureFile(tempDir, "src/cli/commands/estimate.ts", "export const mode = 'mode mode mode mode mode mode mode mode mode mode';\n");
    await writeFixtureFile(tempDir, "src/core/taskIntent.ts", "export const token = 'token token token token token token token token token token';\n");

    const result = runCli(["work", "--json", "--debug", "add token measurement mode"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const taskPaths = brief.taskFiles.map((file) => file.path);
    const testPaths = brief.supportingTests.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.deepEqual(taskPaths.slice(0, 2), [
      "src/cli/commands/measure.ts",
      "src/core/tokenEstimator.ts"
    ], taskPaths.join("\n"));
    assert.ok(testPaths.includes("tests/estimate.test.js"), testPaths.join("\n"));
    assert.equal(taskPaths.includes("src/cli/commands/estimate.ts"), false, taskPaths.join("\n"));
    assert.equal(taskPaths.includes("src/core/taskIntent.ts"), false, taskPaths.join("\n"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("work --agent routes rcc measure token saving task to measure command", async () => {
  await withDocumentationRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "improve rcc measure token saving calculation", "--agent"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(route.primaryFiles.includes("src/cli/commands/measure.ts"), route.primaryFiles.join("\n"));
    assert.ok(route.tests.includes("tests/estimate.test.js"), route.tests.join("\n"));
    assert.ok(
      route.primaryFiles.includes("src/core/tokenEstimator.ts") || route.supportingFiles.includes("src/core/tokenEstimator.ts"),
      [...route.primaryFiles, ...route.supportingFiles].join("\n")
    );
    assert.equal(route.primaryFiles.some((file) => file.startsWith(".github/workflows/")), false, route.primaryFiles.join("\n"));
  });
});

test("work --agent does not treat README roadmap version as release work", async () => {
  await withDocumentationRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "update README for v1.0 roadmap", "--agent"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(route.primaryFiles.includes("README.md"), route.primaryFiles.join("\n"));
    assert.equal(route.primaryFiles.includes("package.json"), false, route.primaryFiles.join("\n"));
  });
});

test("work --agent promotes package files for explicit npm release task", async () => {
  await withDocumentationRoutingRepo(async (tempDir) => {
    const result = runCli(["work", "prepare npm release for v1.0", "--agent"], { cwd: tempDir });
    const route = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(route.primaryFiles.includes("package.json"), route.primaryFiles.join("\n"));
    assert.ok(route.primaryFiles.includes("CHANGELOG.md") || route.supportingFiles.includes("CHANGELOG.md"), [...route.primaryFiles, ...route.supportingFiles].join("\n"));
  });
});

test("work --json routes local/global RCC warning tasks to doctor command and CLI dispatch", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-doctor-routing-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(tempDir, "docs/ai-context/TASK_ROUTING.md", "# Task Routing\n");
    await writeFixtureFile(tempDir, "src/cli/commands/doctor.ts", "export function doctorCommand() {}\n");
    await writeFixtureFile(tempDir, "src/cli/index.ts", "export const commands = { doctor: true };\n");
    await writeFixtureFile(tempDir, "tests/cli.test.js", "test('doctor warning', () => {});\n");
    await writeFixtureFile(tempDir, "src/core/config.ts", "export const warning = 'local global rcc warning warning warning warning warning';\n");
    await writeFixtureFile(tempDir, "package.json", "{\"name\":\"repo-context-center\",\"version\":\"0.0.0\"}\n");

    const result = runCli(["work", "--json", "--debug", "improve local vs global rcc warning"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const taskPaths = brief.taskFiles.map((file) => file.path);
    const testPaths = brief.supportingTests.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.deepEqual(taskPaths.slice(0, 2), [
      "src/cli/commands/doctor.ts",
      "src/cli/index.ts"
    ], taskPaths.join("\n"));
    assert.ok(testPaths.includes("tests/cli.test.js"), testPaths.join("\n"));
    assert.equal(taskPaths.includes("src/core/config.ts"), false, taskPaths.join("\n"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("work --json gives action verbs little direct filename boost", async () => {
  await withWorkflowRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "search Workflow risks"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "inspect ci release risk"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "improve package scripts"], { cwd: tempDir });
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
    const result = runCli(["work", "--json", "--debug", "fix work command"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const recommendedPaths = brief.recommendedFiles.map((file) => file.path);
    const testPaths = brief.relevantTests.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(recommendedPaths[0], "src/cli/commands/work.ts", recommendedPaths.join("\n"));
    assert.ok(testPaths.includes("tests/work.test.js"), testPaths.join("\n"));
    assert.ok(!recommendedPaths.slice(0, 2).includes("tests/work.test.js"), recommendedPaths.join("\n"));
  });
});

test("work json lookup hints include reason and confidence", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--debug", "Improve work command lookup hints"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const hint = brief.targetedLookupHints.find((item) => item.path === "src/cli/commands/work.ts");

    assert.equal(result.status, 0);
    assert.equal(hint.reason, 'matched command name "work"');
    assert.equal(hint.confidence, "high");
  });
});

test("work json recommends done with auto file detection", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.nextCommand, 'rcc done --summary "<summary>" --files auto --verify "<check>"');
  });
});

test("work human output promotes AGENTS route files instead of showing lookup hints", () => {
  const result = runCli(["work", "recalibrate AGENTS.md for current RCC architecture"]);
  const primaryFiles = sectionBody(result.stdout, "Primary files", "Tests");

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /Read-first guidance:/);
  assert.doesNotMatch(result.stdout, /Lookup hints:/);
  assert.match(primaryFiles, /AGENTS\.md/);
  assert.match(primaryFiles, /src\/templates\/generic\/AGENTS\.md/);
  assert.doesNotMatch(primaryFiles, /docs\/ai-context/);
  assert.match(result.stdout, /Next:\nStart with primary files\./);
  assert.match(result.stdout, /Do not rerun rcc work for the same task unless the task meaning changes\./);
  assert.match(result.stdout, /Use rcc find "agents\.md" only if primary\/supporting files are insufficient\./);
});

test("work suggests --files auto in the next done command", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(brief.nextCommand, 'rcc done --summary "<summary>" --files auto --verify "<check>"');
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
    assert.match(result.stdout, /Primary files:\n- none\. No focused task files were identified\. Use Next before broad search\./);
    assert.match(result.stdout, /Agent rules:\n- AGENTS\.md/);
    assert.match(result.stdout, /Context if unclear:\n- docs\/ai-context\/TASK_ROUTING\.md\n- docs\/ai-context\/MODULE_INDEX\.md\n- docs\/ai-context\/HOTSPOTS\.md/);
    assert.match(result.stdout, /Lookup hints:\n1\. AGENTS\.md — referenced by task routing guidance; medium/);
    assert.match(result.stdout, /Next:\nStart with primary files if listed\./);
    assert.match(result.stdout, /No strong primary files were found\./);
    assert.match(result.stdout, /Do not rerun rcc work for the same task unless the task meaning changes\./);
    assert.match(result.stdout, /Use rcc find "billing" only if primary\/supporting files are insufficient\./);
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

test("work reads recent memory logs from work, change, and lessons files", async () => {
  await withWorkRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "docs/ai-context/WORK_LOG.md", [
      "# Work Log",
      "",
      "- Summary: fixed login issue"
    ].join("\n"));
    await writeFixtureFile(tempDir, "docs/ai-context/CHANGE_LOG.md", [
      "# Change Log",
      "",
      "| Date | Command | Files updated | Reason |",
      "| --- | --- | --- | --- |",
      "| 2026-06-18 | `repo-context-center log` | `src/auth/login.ts` | login change |"
    ].join("\n"));
    await writeFixtureFile(tempDir, "docs/ai-context/LESSONS_LEARNED.md", [
      "# Lessons Learned",
      "",
      "- login lesson"
    ].join("\n"));

    const result = runCli(["work", "--json", "--debug", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(brief.recentLogs, [
      "Work: fixed login issue",
      "Change: 2026-06-18 | repo-context-center log | src/auth/login.ts | login change",
      "Lesson: login lesson"
    ]);
  });
});

test("work matches handoff decisions from normalized task and file module terms", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-decisions-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeHandoffDecisionFixture(tempDir);

    const result = runCli(["work", "--json", "--debug", "continue agent handover implementation"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(brief.relevantDecisions.some((decision) => decision.includes("Keep handoff architecture guard")));
    assert.ok(brief.relevantDecisions.some((decision) => decision.includes("Keep handoff command thin")));
    assert.ok(brief.relevantDecisions.some((decision) => decision.includes("Keep JSON renderer decision output compact")));
    assert.equal(brief.relevantDecisions.some((decision) => decision.includes("billing webhook")), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("work does not include decision fallback for unrelated tasks", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-decisions-unrelated-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeHandoffDecisionFixture(tempDir);

    const result = runCli(["work", "--json", "--debug", "update marketing copy"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(brief.relevantDecisions, []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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
    assert.match(result.stdout, /Primary files:/);
    assert.match(result.stdout, /Tests:/);
    assert.match(result.stdout, /Supporting files:/);
    assert.match(result.stdout, /Agent rules:/);
    assert.match(result.stdout, /Context if unclear:/);
    assert.match(result.stdout, /Next:/);
    assert.doesNotMatch(result.stdout, /Cheapest path:/);
    assert.doesNotMatch(result.stdout, /Lookup hints:/);
    assert.doesNotMatch(result.stdout, /Next cheapest command:/);
    assert.doesNotMatch(result.stdout, /Done:/);
    assert.doesNotMatch(result.stdout, /Recent logs:/);
    assert.doesNotMatch(result.stdout, /Read-first guidance:/);
    assert.doesNotMatch(result.stdout, /Fast lookup:/);
  });
});
