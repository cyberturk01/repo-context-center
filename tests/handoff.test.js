const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { renderHandoffText } = require("../dist/cli/handoff/renderText");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8"
  });
}

function parseJsonOnlyOutput(result) {
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /```/);
  assert.doesNotMatch(result.stdout, /^repo-context-center/m);
  assert.doesNotMatch(result.stdout, /^Usage:/m);
  assert.doesNotMatch(result.stdout, /Warning:/i);
  assert.equal(result.stdout.trimStart()[0], "{");
  assert.equal(result.stdout.trimEnd().at(-1), "}");

  return JSON.parse(result.stdout);
}

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withTempRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-handoff-"));

  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("rcc handoff prints a placeholder handoff brief", () => {
  const result = runCli(["handoff"]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /repo-context-center handoff brief/);
  assert.match(result.stdout, /Task:\nnone/);
  assert.match(result.stdout, /Current state:/);
  assert.match(result.stdout, /Memory:/);
  assert.match(result.stdout, /Read first:/);
  assert.match(result.stdout, /Next actions:/);
  assert.match(result.stdout, /Avoid:/);
  assert.doesNotMatch(result.stdout, /```/);
});

test("rcc handoff accepts a task", () => {
  const result = runCli(["handoff", "finish", "handoff", "shell"]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /Task:\nfinish handoff shell/);
});

test("renderHandoffText formats compact human-readable sections", () => {
  const output = renderHandoffText({
    schemaVersion: 1,
    command: "handoff",
    task: "continue handoff work",
    generatedAt: "2026-06-19T12:00:00.000Z",
    currentState: [
      "Last summary: Added source readers",
      "Files touched: src/cli/handoff/renderText.ts",
      "Verification: npm test"
    ],
    memory: [
      "Decisions: Keep handoff parsing conservative",
      "Recent logs: Added handoff model"
    ],
    readFirst: ["AGENTS.md", "tests/handoff.test.js"],
    nextRecommendedFiles: [
      { path: "src/cli/handoff/renderText.ts", reason: "rendering handoff text" }
    ],
    relevantTests: [
      { path: "tests/handoff.test.js", reason: "handoff test coverage" }
    ],
    relevantDecisions: ["Keep handoff parsing conservative"],
    nextActions: ["Update text renderer", "Run focused tests"],
    avoid: ["Do not include JSON or markdown fences"],
    nextLookup: 'rcc find "handoff"',
    nextCommand: 'rcc work "<task>" --agent'
  });

  assert.equal(output, [
    "repo-context-center handoff brief",
    "",
    "Task:",
    "continue handoff work",
    "",
    "Current state:",
    "- Last summary: Added source readers",
    "- Files touched: src/cli/handoff/renderText.ts",
    "- Verification: npm test",
    "",
    "Memory:",
    "- Decisions: Keep handoff parsing conservative",
    "- Recent logs: Added handoff model",
    "",
    "Read first:",
    "- AGENTS.md",
    "- tests/handoff.test.js",
    "",
    "Next recommended files:",
    "- src/cli/handoff/renderText.ts (rendering handoff text)",
    "",
    "Relevant tests:",
    "- tests/handoff.test.js (handoff test coverage)",
    "",
    "Relevant decisions:",
    "- Keep handoff parsing conservative",
    "",
    "Next actions:",
    "1. Update text renderer",
    "2. Run focused tests",
    "",
    "Avoid:",
    "- Do not include JSON or markdown fences",
    "",
    "Next lookup: rcc find \"handoff\"",
    "Next command: rcc work \"<task>\" --agent",
    ""
  ].join("\n"));
});

test("renderHandoffText uses none fallbacks", () => {
  const output = renderHandoffText({
    schemaVersion: 1,
    command: "handoff",
    task: null,
    generatedAt: "2026-06-19T12:00:00.000Z",
    currentState: [],
    memory: [],
    readFirst: [],
    nextRecommendedFiles: [],
    relevantTests: [],
    relevantDecisions: [],
    nextActions: [],
    avoid: [],
    nextLookup: 'rcc find "<keyword>"',
    nextCommand: 'rcc work "<task>" --agent'
  });

  assert.equal(output, [
    "repo-context-center handoff brief",
    "",
    "Task:",
    "none",
    "",
    "Current state:",
    "- none",
    "",
    "Memory:",
    "- none",
    "",
    "Read first:",
    "- none",
    "",
    "Next recommended files:",
    "- none",
    "",
    "Relevant tests:",
    "- none",
    "",
    "Relevant decisions:",
    "- none",
    "",
    "Next actions:",
    "1. none",
    "",
    "Avoid:",
    "- none",
    "",
    "Next lookup: rcc find \"<keyword>\"",
    "Next command: rcc work \"<task>\" --agent",
    ""
  ].join("\n"));
});

test("rcc handoff --json returns a machine-readable brief", () => {
  const result = runCli(["handoff", "--json"]);
  const brief = parseJsonOnlyOutput(result);

  assert.deepEqual(Object.keys(brief), [
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
  ]);
  assert.equal(brief.schemaVersion, 1);
  assert.equal(brief.command, "handoff");
  assert.equal(brief.task, null);
  assert.match(brief.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(brief.memory));
  assert.ok(Array.isArray(brief.readFirst));
  assert.deepEqual(brief.nextRecommendedFiles, []);
  assert.deepEqual(brief.relevantTests, []);
  assert.deepEqual(brief.relevantDecisions, []);
  assert.ok(Array.isArray(brief.nextActions));
  assert.ok(Array.isArray(brief.avoid));
  assert.equal(brief.nextLookup, 'rcc find "<keyword>"');
  assert.equal(brief.nextCommand, 'rcc work "<task>" --agent');
});

test("rcc handoff --agent returns compact agent JSON", () => {
  const result = runCli(["handoff", "--agent"]);
  const brief = parseJsonOnlyOutput(result);

  assert.deepEqual(Object.keys(brief), [
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
  ]);
  assert.equal(brief.schemaVersion, 1);
  assert.equal(brief.command, "handoff");
  assert.equal(brief.task, null);
  assert.match(brief.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(brief.currentState));
  assert.equal(brief.nextLookup, 'rcc find "<keyword>"');
  assert.equal(brief.nextCommand, 'rcc work "<task>" --agent');
});

test("rcc handoff invalid args return usage and non-zero exit", () => {
  const result = runCli(["handoff", "--bogus"]);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Usage: rcc handoff \[task\] \[--json\|--agent\] \[--debug\]/);
});

test("rcc handoff --write writes HANDOFF.md and prints confirmation", async () => {
  await withTempRepo(async (tempDir) => {
    const result = runCli(["handoff", "--write"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "HANDOFF.md"), "utf8");

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, "Wrote docs/ai-context/HANDOFF.md\n");
    assert.match(content, /^# Agent Handoff/);
    assert.match(content, /<!-- repo-context-center:generated:start -->/);
    assert.match(content, /## Generated Handoff/);
    assert.match(content, /repo-context-center handoff brief/);
    assert.match(content, /<!-- repo-context-center:generated:end -->/);
  });
});

test("rcc handoff --json --write prints JSON with writtenPath", async () => {
  await withTempRepo(async (tempDir) => {
    const result = runCli(["handoff", "--json", "--write"], { cwd: tempDir });
    const brief = parseJsonOnlyOutput(result);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "HANDOFF.md"), "utf8");

    assert.equal(brief.writtenPath, "docs/ai-context/HANDOFF.md");
    assert.match(content, /repo-context-center handoff brief/);
  });
});

test("rcc handoff --agent --write prints compact JSON with writtenPath", async () => {
  await withTempRepo(async (tempDir) => {
    const result = runCli(["handoff", "--agent", "--write"], { cwd: tempDir });
    const brief = parseJsonOnlyOutput(result);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "HANDOFF.md"), "utf8");

    assert.equal(brief.writtenPath, "docs/ai-context/HANDOFF.md");
    assert.equal(brief.command, "handoff");
    assert.match(content, /repo-context-center handoff brief/);
  });
});

test("rcc handoff --write preserves manual HANDOFF.md sections", async () => {
  await withTempRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "docs/ai-context/HANDOFF.md", [
      "# Agent Handoff",
      "",
      "Manual note before generated content.",
      "",
      "<!-- repo-context-center:generated:start -->",
      "old generated handoff",
      "<!-- repo-context-center:generated:end -->",
      "",
      "Manual note after generated content.",
      ""
    ].join("\n"));

    const result = runCli(["handoff", "continue exports", "--write"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "HANDOFF.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Manual note before generated content\./);
    assert.match(content, /Manual note after generated content\./);
    assert.doesNotMatch(content, /old generated handoff/);
    assert.match(content, /Task:\ncontinue exports/);
    assert.equal((content.match(/repo-context-center:generated:start/g) ?? []).length, 1);
    assert.equal((content.match(/repo-context-center:generated:end/g) ?? []).length, 1);
  });
});

test("rcc handoff reads present context sources conservatively", async () => {
  await withTempRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "AGENTS.md", "# Repo Agents\n\nRead this first.\n");
    await writeFixtureFile(tempDir, "docs/ai-context/WORK_LOG.md", [
      "# Work Log",
      "",
      "## 2026-06-18T12:00:00.000Z",
      "- Summary: Added source readers",
      "- Changed files: `src/cli/handoff/handoffSources.ts`"
    ].join("\n"));
    await writeFixtureFile(tempDir, "docs/ai-context/DECISIONS.md", [
      "# Decisions",
      "",
      "| Date | Decision | Reason | Status | Files |",
      "| --- | --- | --- | --- | --- |",
      "| 2026-06-18 | Keep handoff parsing conservative | Avoid brittle markdown assumptions | Active | src/cli/handoff/handoffSources.ts |"
    ].join("\n"));
    await writeFixtureFile(tempDir, "docs/ai-context/CHANGE_LOG.md", [
      "# Change Log",
      "",
      "| Date | Command | Files updated | Reason |",
      "| --- | --- | --- | --- |",
      "| 2026-06-18 | `repo-context-center done` | 1 file | source reader fixture |"
    ].join("\n"));
    await writeFixtureFile(tempDir, "docs/ai-context/LESSONS_LEARNED.md", [
      "# Lessons Learned",
      "",
      "- Handoff readers should tolerate absent files."
    ].join("\n"));

    const result = runCli(["handoff", "continue source readers", "--json", "--debug"], { cwd: tempDir });
    const brief = parseJsonOnlyOutput(result);

    assert.deepEqual(Object.keys(brief), [
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
      "nextCommand",
      "debug"
    ]);
    assert.equal(brief.task, "continue source readers");
    assert.deepEqual(brief.readFirst, ["AGENTS.md"]);
    assert.deepEqual(brief.nextRecommendedFiles, []);
    assert.deepEqual(brief.relevantTests, []);
    assert.ok(brief.relevantDecisions.some((decision) => decision.includes("Keep handoff parsing conservative")));
    assert.equal(brief.nextLookup, 'rcc find "continue"');
    assert.ok(brief.memory.includes("Last completed: Added source readers"));
    assert.ok(brief.memory.includes("Completed at: 2026-06-18T12:00:00.000Z"));
    assert.ok(brief.memory.some((entry) => entry.includes("Decision: 2026-06-18 | Keep handoff parsing conservative")));
    assert.ok(brief.memory.some((entry) => entry.includes("Change: 2026-06-18 | repo-context-center done")));
    assert.ok(brief.memory.includes("Lesson: Handoff readers should tolerate absent files."));
    assert.ok(brief.currentState.includes("Recently touched: src/cli/handoff/handoffSources.ts"));
    assert.ok(brief.avoid.includes("Do not rerun broad discovery before reading handoff files."));
    assert.ok(brief.avoid.includes("Do not rerun rcc work unless task meaning changed."));
    assert.ok(brief.avoid.includes("Do not edit generated/assets/fixtures unless relevant."));
    assert.equal(brief.debug.sources.agentsPresent, true);
    assert.equal(brief.debug.sources.workLogCount, 1);
    assert.equal(brief.debug.sources.decisionsCount, 1);
    assert.equal(brief.debug.sources.changeLogCount, 1);
    assert.equal(brief.debug.sources.lessonsCount, 1);
    assert.equal(brief.debug.sources.latestDoneEntryPresent, true);
    assert.equal(brief.debug.sources.recentTouchedFilesCount, 1);
  });
});

test("rcc handoff reads latest structured done entry", async () => {
  await withTempRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "docs/ai-context/WORK_LOG.md", [
      "# Work Log",
      "",
      "<!-- repo-context-center:work-log:start -->",
      "## 2026-06-18T12:00:00.000Z",
      "- Summary: Older human summary",
      "- Changed files: `src/old.ts`",
      "```json repo-context-center:done",
      JSON.stringify({
        schemaVersion: 1,
        command: "done",
        timestamp: "2026-06-18T12:00:00.000Z",
        summary: "Older structured summary",
        files: ["src/old-structured.ts"],
        verification: "npm test -- old",
        followUps: ["Old follow-up"],
        risks: ["Old risk"]
      }, null, 2),
      "```",
      "",
      "## 2026-06-19T12:00:00.000Z",
      "- Summary: Conflicting weak text summary",
      "- Changed files: `src/weak.ts`",
      "- Verification: weak verification",
      "- Risk: weak risk",
      "- Follow-ups: weak follow-up",
      "```json repo-context-center:done",
      JSON.stringify({
        schemaVersion: 1,
        command: "done",
        timestamp: "2026-06-19T12:00:00.000Z",
        summary: "Latest structured summary",
        files: ["src/structured.ts", "tests/structured.test.js"],
        verification: "node --test tests/structured.test.js",
        followUps: ["Continue structured handoff"],
        risks: ["Watch parser compatibility"]
      }, null, 2),
      "```",
      "<!-- repo-context-center:work-log:end -->",
      ""
    ].join("\n"));

    const result = runCli(["handoff", "--json", "--debug"], { cwd: tempDir });
    const brief = parseJsonOnlyOutput(result);

    assert.ok(brief.memory.includes("Last completed: Latest structured summary"));
    assert.ok(brief.memory.includes("Completed at: 2026-06-19T12:00:00.000Z"));
    assert.ok(brief.memory.includes("Verification: node --test tests/structured.test.js"));
    assert.ok(brief.memory.includes("Follow-up: Continue structured handoff"));
    assert.ok(brief.memory.includes("Risk: Watch parser compatibility"));
    assert.ok(brief.currentState.includes("Recently touched: src/structured.ts"));
    assert.ok(brief.currentState.includes("Recently touched: tests/structured.test.js"));
    assert.doesNotMatch(brief.memory.join("\n"), /Conflicting weak text summary/);
    assert.equal(brief.debug.sources.latestDoneEntryPresent, true);
  });
});

test("rcc handoff falls back to old work log parsing without structured done entry", async () => {
  await withTempRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "docs/ai-context/WORK_LOG.md", [
      "# Work Log",
      "",
      "## 2026-06-19T12:00:00.000Z",
      "- Summary: Legacy completed work",
      "- Changed files: `src/legacy.ts`, `tests/legacy.test.js`",
      "- Verification: node --test tests/legacy.test.js",
      "- Risk: Legacy parser risk",
      "- Follow-ups: Add structured entries later",
      ""
    ].join("\n"));

    const result = runCli(["handoff", "--json", "--debug"], { cwd: tempDir });
    const brief = parseJsonOnlyOutput(result);

    assert.ok(brief.memory.includes("Last completed: Legacy completed work"));
    assert.ok(brief.memory.includes("Completed at: 2026-06-19T12:00:00.000Z"));
    assert.ok(brief.memory.includes("Verification: node --test tests/legacy.test.js"));
    assert.ok(brief.memory.includes("Follow-up: Add structured entries later"));
    assert.ok(brief.memory.includes("Risk: Legacy parser risk"));
    assert.ok(brief.currentState.includes("Recently touched: src/legacy.ts"));
    assert.ok(brief.currentState.includes("Recently touched: tests/legacy.test.js"));
    assert.equal(brief.debug.sources.latestDoneEntryPresent, true);
  });
});

test("rcc handoff tolerates missing context sources", async () => {
  await withTempRepo(async (tempDir) => {
    const result = runCli(["handoff", "--json", "--debug"], { cwd: tempDir });
    const brief = parseJsonOnlyOutput(result);

    assert.deepEqual(brief.memory, []);
    assert.deepEqual(brief.readFirst, []);
    assert.deepEqual(brief.nextRecommendedFiles, []);
    assert.deepEqual(brief.relevantTests, []);
    assert.deepEqual(brief.relevantDecisions, []);
    assert.ok(brief.nextActions.length > 0);
    assert.equal(brief.nextLookup, 'rcc find "<keyword>"');
    assert.ok(brief.avoid.includes("Do not rerun broad discovery before reading handoff files."));
    assert.equal(brief.debug.sources.agentsPresent, false);
    assert.equal(brief.debug.sources.workLogCount, 0);
    assert.equal(brief.debug.sources.decisionsCount, 0);
    assert.equal(brief.debug.sources.changeLogCount, 0);
    assert.equal(brief.debug.sources.lessonsCount, 0);
    assert.equal(brief.debug.sources.latestDoneEntryPresent, false);
    assert.equal(brief.debug.sources.recentTouchedFilesCount, 0);
  });
});

test("rcc handoff with task reuses work routing for task-specific next files", async () => {
  await withTempRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "AGENTS.md", "# Repo Agents\n\nRead this first.\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Workflow validation work: read `src/workflow/validate.ts`, `tests/workflow/validate.test.ts`, and `docs/ai-context/RISK_REGISTER.md`."
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
        "| 2026-06-18 | Keep workflow validation explicit | Avoid hidden routing regressions | Active | src/workflow/validate.ts |"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "docs/ai-context/RISK_REGISTER.md", "# Risk Register\n");
    await writeFixtureFile(tempDir, "src/workflow/validate.ts", "export function validateWorkflow() {}\n");
    await writeFixtureFile(tempDir, "tests/workflow/validate.test.ts", "test('validate workflow', () => {});\n");

    const result = runCli(["handoff", "continue workflow validation", "--json"], { cwd: tempDir });
    const brief = parseJsonOnlyOutput(result);

    assert.equal(brief.task, "continue workflow validation");
    assert.ok(brief.readFirst.includes("AGENTS.md"));
    assert.ok(brief.nextRecommendedFiles.some((file) => file.path === "src/workflow/validate.ts"));
    assert.ok(brief.relevantTests.some((file) => file.path === "tests/workflow/validate.test.ts"));
    assert.ok(brief.relevantDecisions.some((decision) => decision.includes("Keep workflow validation explicit")));
    assert.match(brief.nextLookup, /^rcc find "/);
    assert.equal(brief.nextCommand, 'rcc done --summary "<summary>" --files auto --verify "<check>"');
    assert.ok(brief.nextActions.includes("Inspect nextRecommendedFiles before searching."));
  });
});
