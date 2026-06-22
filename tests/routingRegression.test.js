const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const {
  evaluateRoutingCase,
  formatRoutingFailure
} = require("./helpers/routingEvaluation");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const fixturePath = path.join(repoRoot, "tests", "fixtures", "routing-cases.json");

async function readRoutingCases() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

function runWorkAgent(task) {
  const result = spawnSync(process.execPath, [cliPath, "work", task, "--agent"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("routing regression fixture has deterministic case shape", async () => {
  const cases = await readRoutingCases();

  assert.ok(cases.length >= 5);
  for (const routingCase of cases) {
    assert.equal(typeof routingCase.name, "string");
    assert.equal(typeof routingCase.task, "string");
    assert.equal(typeof routingCase.expect, "object");
    assert.ok(routingCase.name.length > 0);
    assert.ok(routingCase.task.length > 0);
    assert.deepEqual(Object.keys(routingCase).sort(), ["expect", "name", "task"]);
  }
});

test("representative tasks satisfy routing correctness and quality expectations", async () => {
  const cases = await readRoutingCases();

  for (const routingCase of cases) {
    const route = runWorkAgent(routingCase.task);
    const { failures } = evaluateRoutingCase(route, routingCase);

    assert.deepEqual(failures, [], formatRoutingFailure(routingCase, route, failures));
  }
});
