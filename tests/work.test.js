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
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Work command changes: read `src/cli/commands/work.ts`, `tests/work.test.js`, and `src/core/workRouting.ts`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "src/cli/commands/work.ts", "export function workCommand() {}\n");
    await writeFixtureFile(tempDir, "tests/work.test.js", "test('work command', () => {});\n");
    await writeFixtureFile(tempDir, "src/core/workRouting.ts", "export const routed = true;\n");
    await writeFixtureFile(tempDir, "src/features/work/index.ts", "export const folder = 'work';\n");
    await writeFixtureFile(tempDir, "src/cli/commands/other.ts", "export const note = 'work lookup hint';\n");
    await writeFixtureFile(tempDir, "docs/ai-context/WORK_LOG.md", "- Summary: work command history\n");
    await writeFixtureFile(tempDir, ".repo-context-center/config.json", "{\"work\":true}\n");
    await writeFixtureFile(tempDir, "fixtures/work.ts", "export const fixture = true;\n");
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
    assert.match(result.stdout, /Task intent:\nfix login bug/);
    assert.match(result.stdout, /Map freshness:\nStatus: (fresh|maybe_stale|stale|unknown)\nScore: \d+\/100\nReason: /);
    assert.match(result.stdout, /Recommended files to inspect first:\n- src\/auth\/login\.ts/);
    assert.match(result.stdout, /Relevant tests or test folders:\n- tests\/auth\/login\.test\.ts/);
    assert.match(result.stdout, /Relevant decisions:\n- 2026-06-16 \| Keep login flow server-side/);
    assert.match(result.stdout, /Recent logs:\n- none\. no recent log was found\./);
    assert.match(result.stdout, /Token estimate:\n- roughly \d+ tokens for this brief\./);
    assert.match(result.stdout, /Known risks:\n- high/);
    assert.match(result.stdout, /Targeted lookup hints:\n1\. src\/auth\/login\.ts\n   reason: matched filename stem "login"\n   confidence: high/);
    assert.match(result.stdout, /Fast lookup:\n- For targeted lookup, use: rcc find "<keyword>"/);
    assert.match(result.stdout, /Prefer this before broad repo search when the target is unclear\./);
    assert.match(result.stdout, /Next command after meaningful work:\n```sh\nrcc done --summary "<summary>" --files auto --verify "<check>"\n```/);
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
        "task",
        "mapFreshness",
        "routingGuidance",
        "startupContext",
        "recommendedFiles",
        "relevantTests",
        "targetedLookupHints",
        "relevantDecisions",
        "recentLogs",
        "tokenEstimate",
        "risks",
        "readFirst",
        "readFirstGuidance",
        "nextCommand"
      ]
    );
    assert.equal(typeof brief.mapFreshness.status, "string");
    assert.equal(typeof brief.mapFreshness.score, "number");
    assert.equal(typeof brief.mapFreshness.reason, "string");
    assert.ok("latestContextUpdate" in brief.mapFreshness);
    assert.ok("latestRelevantSourceChange" in brief.mapFreshness);
    assert.ok(brief.recommendedFiles.some((file) => file.path === "src/auth/login.ts"));
    assert.ok(brief.relevantTests.some((file) => file.path === "tests/auth/login.test.ts"));
    assert.ok(brief.targetedLookupHints.some((hint) => (
      hint.path === "src/auth/login.ts"
      && hint.term === "login"
      && hint.reason
      && hint.confidence
      && typeof hint.score === "number"
    )));
    assert.ok(brief.relevantDecisions.some((decision) => decision.includes("Keep login flow server-side")));
    assert.match(brief.tokenEstimate.text, /^roughly \d+ tokens for this brief\.$/);
    assert.deepEqual(brief.readFirstGuidance.required, [
      {
        path: "AGENTS.md",
        reason: "repository agent workflow",
        priority: "required"
      }
    ]);
    assert.ok(brief.readFirst.includes("AGENTS.md"));
    assert.equal(Array.isArray(brief.readFirstGuidance.taskSpecific), true);
    assert.equal(Array.isArray(brief.readFirstGuidance.optional), true);
    assert.equal(Array.isArray(brief.readFirstGuidance.skipped), true);
    assert.equal(brief.nextCommand, 'rcc done --summary "<summary>" --files auto --verify "<check>"');
    assert.equal(result.stdout.trim().startsWith("{"), true);
    assert.equal(result.stdout.trim().endsWith("}"), true);
    assert.doesNotMatch(result.stdout, /repo-context-center work brief/);
  });
});

test("work handles missing RCC files gracefully", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-work-empty-"));

  try {
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");

    const result = runCli(["work", "unknown task"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Map freshness:\nStatus: unknown\nScore: 0\/100\nReason: Run npx repo-context-center init to generate context\./);
    assert.match(result.stdout, /Recommended:\nrcc map --write/);
    assert.match(result.stdout, /Relevant decisions:\n- none\. no matching decision was found\./);
    assert.match(result.stdout, /Recent logs:\n- none\. no recent log was found\./);
    assert.match(result.stdout, /Token estimate:\n- roughly \d+ tokens for this brief\./);
    assert.match(result.stdout, /Read-first guidance:\n- no RCC context files found; run npx repo-context-center init to install them/);
    assert.match(result.stdout, /Targeted lookup hints:\n- none\. use rcc find "<keyword>" for targeted lookup\./);
    assert.match(result.stdout, /Fast lookup:/);
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
      optional: [],
      skipped: []
    });
    assert.deepEqual(brief.targetedLookupHints, []);
    assert.equal(Array.isArray(brief.routingGuidance), true);
    assert.equal(brief.nextCommand, 'rcc done --summary "<summary>" --files auto --verify "<check>"');
    assert.equal(Array.isArray(brief.recommendedFiles), true);
    assert.equal(Array.isArray(brief.relevantTests), true);
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
      brief.readFirstGuidance.optional.some((item) => item.path === "docs/ai-context/TASK_ROUTING.md")
        || brief.readFirstGuidance.skipped.some((item) => item.path === "docs/ai-context/TASK_ROUTING.md")
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
      && item.priority === "task_specific"
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
      && item.priority === "task_specific"
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
      && item.priority === "task_specific"
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
      && item.priority === "task_specific"
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
    assert.ok(brief.readFirstGuidance.optional.some((item) => item.path === "docs/ai-context/RISK_REGISTER.md"));
  });
});

test("work --context-budget deep keeps broader read-first guidance", async () => {
  await withGuidanceRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "--context-budget", "deep", "fix login bug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const broadGuidance = [
      ...brief.readFirstGuidance.taskSpecific,
      ...brief.readFirstGuidance.optional
    ].map((item) => item.path);

    assert.equal(result.status, 0);
    assert.ok(brief.readFirst.includes("AGENTS.md"));
    assert.ok(brief.readFirst.includes("docs/ai-context/TASK_ROUTING.md"));
    assert.ok(broadGuidance.includes("docs/ai-context/MODULE_INDEX.md"));
    assert.ok(broadGuidance.includes("docs/ai-context/DEPENDENCY_MAP.md"));
    assert.ok(broadGuidance.includes("docs/ai-context/RISK_REGISTER.md"));
  });
});

test("work reports fresh map freshness when context is newer than repo changes", async () => {
  await withFreshnessRepo(async (tempDir) => {
    const result = runCli(["work", "update cli"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Map freshness:\nStatus: fresh\nScore: 100\/100/);
    assert.match(result.stdout, /Reason: Context is newer than recent source, config, workflow, package, and test changes\./);
    assert.doesNotMatch(result.stdout, /Recommended:\nrcc map --write/);
  });
});

test("work reports stale map freshness when important source files changed", async () => {
  await withFreshnessRepo(async (tempDir) => {
    await setFixtureMtime(tempDir, "src/index.ts", new Date("2026-06-17T13:00:00.000Z"));

    const result = runCli(["work", "update cli"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Map freshness:\nStatus: stale\nScore: 35\/100/);
    assert.match(result.stdout, /Reason: Important source, config, workflow, package, or test files changed after the last context generation\./);
    assert.match(result.stdout, /Recommended:\nrcc map --write/);
  });
});

test("work reports maybe_stale map freshness when unclear repo files changed", async () => {
  await withFreshnessRepo(async (tempDir) => {
    await setFixtureMtime(tempDir, "README.md", new Date("2026-06-17T13:00:00.000Z"));

    const result = runCli(["work", "update cli"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Map freshness:\nStatus: maybe_stale\nScore: 68\/100/);
    assert.match(result.stdout, /Reason: Repository files changed after the last context generation, but their impact on context is unclear\./);
    assert.match(result.stdout, /Recommended:\nrcc map --write/);
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
    assert.equal(brief.targetedLookupHints[testIndex].confidence, "high");
  });
});

test("work --json excludes context, generated, fixture, snapshot, lock, and duplicate lookup paths", async () => {
  await withLookupRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "Improve work command lookup hints"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.targetedLookupHints.map((hint) => hint.path);

    assert.equal(result.status, 0);
    assert.equal(new Set(paths).size, paths.length);
    assert.ok(!paths.some((file) => file.startsWith("docs/ai-context/")), paths.join("\n"));
    assert.ok(!paths.some((file) => file.startsWith(".repo-context-center/")), paths.join("\n"));
    assert.ok(!paths.some((file) => file.startsWith("fixtures/")), paths.join("\n"));
    assert.ok(!paths.some((file) => file.includes("__snapshots__")), paths.join("\n"));
    assert.ok(!paths.includes("package-lock.json"), paths.join("\n"));
    assert.ok(brief.targetedLookupHints.every((hint) => hint.reason && hint.confidence && typeof hint.score === "number"));
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

test("work --json keeps RCC docs from outranking strong task matches", async () => {
  await withRecommendedRankingRepo(async (tempDir) => {
    const result = runCli(["work", "--json", "improve package scripts"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);
    const paths = brief.recommendedFiles.map((file) => file.path);

    assert.equal(result.status, 0);
    assert.equal(paths[0], "package.json", paths.join("\n"));
    assert.ok(paths.indexOf("package.json") < paths.indexOf("docs/ai-context/TASK_ROUTING.md"), paths.join("\n"));
    assert.ok(brief.readFirstGuidance.skipped.some((item) => item.path === "docs/ai-context/MODULE_INDEX.md"), paths.join("\n"));
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
    const hints = sectionBody(result.stdout, "Targeted lookup hints", "Fast lookup");

    assert.equal(result.status, 0);
    assert.match(hints, /1\. src\/cli\/commands\/work\.ts/);
    assert.match(hints, /reason: matched command name "work"/);
    assert.match(hints, /confidence: high/);
  });
});

test("work output recommends done with auto file detection", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Next command after meaningful work:\n```sh\nrcc done --summary "<summary>" --files auto --verify "<check>"\n```/);
    assert.doesNotMatch(result.stdout, /--files "<files>"/);
  });
});

test("work includes deterministic targeted lookup hints for duplicate AGENTS workflow tasks", () => {
  const result = runCli(["work", "Fix duplicate AGENTS workflow instructions"]);
  const hints = sectionBody(result.stdout, "Targeted lookup hints", "Fast lookup");

  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes("Read-first guidance:\n"), result.stdout);
  assert.ok(result.stdout.indexOf("Read-first guidance:") < result.stdout.indexOf("Targeted lookup hints:"));
  assert.ok(result.stdout.indexOf("Targeted lookup hints:") < result.stdout.indexOf("Fast lookup:"));
  assert.ok(hints.split(/\r?\n/).filter((line) => /^\d+\. /.test(line)).length <= 5, hints);
  assert.match(hints, /AGENTS\.md/);
  assert.match(hints, /src\/templates\/generic\/AGENTS\.md/);
  assert.match(hints, /confidence: high/);
  assert.ok(!hints.includes("docs/ai-context/"), hints);
});

test("work suggests --files auto in the next done command", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });
    const nextDoneCommand = result.stdout.match(
      /Next command after meaningful work:\n```sh\n(?<command>rcc done .+)\n```/
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
    assert.match(result.stdout, /Recommended files to inspect first:\n- AGENTS\.md\n- docs\/ai-context\/TASK_ROUTING\.md\n- docs\/ai-context\/MODULE_INDEX\.md\n- docs\/ai-context\/HOTSPOTS\.md/);
    assert.doesNotMatch(result.stdout, /Recommended files to inspect first:\n- none/);
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

    const result = runCli(["work", "fix login bug"], { cwd: tempDir });
    const matches = result.stdout.match(/Keep login flow server-side/g) ?? [];

    assert.equal(result.status, 0);
    assert.equal(matches.length, 1);
  });
});

test("work output is concise and agent-oriented", async () => {
  await withWorkRepo(async (tempDir) => {
    const result = runCli(["work", "fix login bug"], { cwd: tempDir });
    const lines = result.stdout.trim().split(/\r?\n/);

    assert.equal(result.status, 0);
    assert.ok(lines.length <= 65, `work output has ${lines.length} lines`);
    assert.doesNotMatch(result.stdout, /generate code/i);
    assert.match(result.stdout, /Map freshness:/);
    assert.match(result.stdout, /Recommended files to inspect first:/);
    assert.match(result.stdout, /Relevant decisions:/);
    assert.match(result.stdout, /Recent logs:/);
    assert.match(result.stdout, /Token estimate:/);
    assert.match(result.stdout, /Suggested|Next command after meaningful work:/);
  });
});
