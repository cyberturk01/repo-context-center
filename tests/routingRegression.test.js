const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

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

function asPaths(value) {
  return Array.isArray(value) ? value : [];
}

function pathMatches(actualPath, expectedPath) {
  return actualPath === expectedPath || actualPath.startsWith(expectedPath);
}

function assertContains(actualPaths, expectedPaths = [], label) {
  for (const expectedPath of expectedPaths) {
    assert.ok(
      actualPaths.some((actualPath) => pathMatches(actualPath, expectedPath)),
      `${label} should include ${expectedPath}; got ${actualPaths.join(", ")}`
    );
  }
}

function assertNotContains(actualPaths, expectedPaths = [], label) {
  for (const expectedPath of expectedPaths) {
    assert.equal(
      actualPaths.some((actualPath) => pathMatches(actualPath, expectedPath)),
      false,
      `${label} should not include ${expectedPath}; got ${actualPaths.join(", ")}`
    );
  }
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

test("representative tasks route to expected primary, supporting, and test files", async () => {
  const cases = await readRoutingCases();

  for (const routingCase of cases) {
    const route = runWorkAgent(routingCase.task);
    const expect = routingCase.expect;
    const primary = asPaths(route.primaryFiles);
    const supporting = asPaths(route.supportingFiles);
    const tests = asPaths(route.tests);

    assertContains(primary, expect.primaryContains, `${routingCase.name} primaryFiles`);
    assertNotContains(primary, expect.primaryNotContains, `${routingCase.name} primaryFiles`);
    assertContains(supporting, expect.supportingContains, `${routingCase.name} supportingFiles`);
    assertNotContains(supporting, expect.supportingNotContains, `${routingCase.name} supportingFiles`);
    assertContains(tests, expect.testsContains, `${routingCase.name} tests`);
    assertNotContains(tests, expect.testsNotContains, `${routingCase.name} tests`);

    if (typeof expect.maxBriefTokens === "number") {
      assert.ok(
        route.briefTokens <= expect.maxBriefTokens,
        `${routingCase.name} briefTokens ${route.briefTokens} exceeded ${expect.maxBriefTokens}`
      );
    }
  }
});
