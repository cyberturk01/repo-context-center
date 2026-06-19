const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("rcc handoff prints a placeholder handoff brief", () => {
  const result = runCli(["handoff"]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /repo-context-center handoff/);
  assert.match(result.stdout, /Task: \(none\)/);
  assert.match(result.stdout, /Status: placeholder/);
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
  assert.equal(brief.status, "placeholder");
  assert.deepEqual(brief.sections.completed, []);
});

test("rcc handoff --agent returns compact agent JSON", () => {
  const result = runCli(["handoff", "--agent"]);
  const brief = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(brief.task, null);
  assert.equal(brief.status, "placeholder");
  assert.match(brief.summary, /placeholder/);
});

test("rcc handoff invalid args return usage and non-zero exit", () => {
  const result = runCli(["handoff", "--bogus"]);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Usage: rcc handoff \[task\] \[--json\|--agent\] \[--debug\]/);
});
