const assert = require("node:assert/strict");
const { readdir, readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const fixturesRoot = path.join(repoRoot, "fixtures");
const { buildTaskAnalysis } = require("../dist/core/task-analysis");

async function readFixtureSuites() {
  const entries = await readdir(fixturesRoot, { withFileTypes: true });
  const fixtureDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(fixturesRoot, entry.name))
    .sort();

  return Promise.all(fixtureDirs.map(async (fixtureDir) => ({
    fixtureDir,
    fixture: JSON.parse(await readFile(path.join(fixtureDir, "expected.json"), "utf8"))
  })));
}

function taskAnalysisSnapshot(analysis) {
  return {
    affectedFiles: analysis.affectedFiles.map((file) => file.path),
    tests: analysis.testCandidates.map((file) => file.path),
    verificationCommands: analysis.verification.commands.map((item) => item.command)
  };
}

test("task analysis fixture snapshots stay stable", async () => {
  const suites = await readFixtureSuites();

  assert.deepEqual(suites.map((suite) => suite.fixture.name), [
    "monorepo-large",
    "redis-cache",
    "simple-auth",
    "translations"
  ]);

  for (const { fixtureDir, fixture } of suites) {
    assert.ok(Array.isArray(fixture.cases), `${fixture.name} must define cases`);

    for (const fixtureCase of fixture.cases) {
      const analysis = await buildTaskAnalysis(fixtureDir, fixtureCase.task, {
        taskOnly: true,
        maxFiles: 30
      });
      const snapshot = taskAnalysisSnapshot(analysis);

      assert.deepEqual(
        snapshot,
        fixtureCase.expected,
        `${fixture.name} / ${fixtureCase.task}\nactual: ${JSON.stringify(snapshot)}`
      );
    }
  }
});
