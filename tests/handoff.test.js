const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
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
  assert.match(result.stdout, /repo-context-center handoff/);
  assert.match(result.stdout, /Task: \(none\)/);
  assert.match(result.stdout, /Current state:/);
  assert.match(result.stdout, /Next command: rcc work "<task>" --agent/);
});

test("rcc handoff accepts a task", () => {
  const result = runCli(["handoff", "finish", "handoff", "shell"]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /Task: finish handoff shell/);
});

test("rcc handoff --json returns a machine-readable brief", () => {
  const result = runCli(["handoff", "--json"]);
  const brief = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(brief.schemaVersion, 1);
  assert.equal(brief.command, "handoff");
  assert.equal(brief.task, null);
  assert.match(brief.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(brief.memory));
  assert.ok(Array.isArray(brief.readFirst));
  assert.ok(Array.isArray(brief.nextActions));
  assert.ok(Array.isArray(brief.avoid));
  assert.equal(brief.nextCommand, 'rcc work "<task>" --agent');
});

test("rcc handoff --agent returns compact agent JSON", () => {
  const result = runCli(["handoff", "--agent"]);
  const brief = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(brief.schemaVersion, 1);
  assert.equal(brief.command, "handoff");
  assert.equal(brief.task, null);
  assert.match(brief.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Array.isArray(brief.currentState));
  assert.equal(brief.nextCommand, 'rcc work "<task>" --agent');
});

test("rcc handoff invalid args return usage and non-zero exit", () => {
  const result = runCli(["handoff", "--bogus"]);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Usage: rcc handoff \[task\] \[--json\|--agent\] \[--debug\]/);
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
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(brief.task, "continue source readers");
    assert.deepEqual(brief.readFirst, ["AGENTS.md"]);
    assert.ok(brief.memory.includes("Work: Added source readers"));
    assert.ok(brief.memory.some((entry) => entry.includes("Decision: 2026-06-18 | Keep handoff parsing conservative")));
    assert.ok(brief.memory.some((entry) => entry.includes("Change: 2026-06-18 | repo-context-center done")));
    assert.ok(brief.memory.includes("Lesson: Handoff readers should tolerate absent files."));
    assert.equal(brief.debug.sources.agentsPresent, true);
    assert.equal(brief.debug.sources.workLogCount, 1);
    assert.equal(brief.debug.sources.decisionsCount, 1);
    assert.equal(brief.debug.sources.changeLogCount, 1);
    assert.equal(brief.debug.sources.lessonsCount, 1);
  });
});

test("rcc handoff tolerates missing context sources", async () => {
  await withTempRepo(async (tempDir) => {
    const result = runCli(["handoff", "--json", "--debug"], { cwd: tempDir });
    const brief = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(brief.memory, []);
    assert.deepEqual(brief.readFirst, []);
    assert.deepEqual(brief.nextActions, []);
    assert.deepEqual(brief.avoid, []);
    assert.equal(brief.debug.sources.agentsPresent, false);
    assert.equal(brief.debug.sources.workLogCount, 0);
    assert.equal(brief.debug.sources.decisionsCount, 0);
    assert.equal(brief.debug.sources.changeLogCount, 0);
    assert.equal(brief.debug.sources.lessonsCount, 0);
  });
});
