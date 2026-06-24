const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
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

async function writeCaseRepo(files) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-routing-case-"));

  for (const [filePath, content] of Object.entries(files ?? {})) {
    const fullPath = path.join(tempDir, filePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }

  return tempDir;
}

function runWorkAgent(task, cwd = repoRoot) {
  const result = spawnSync(process.execPath, [cliPath, "work", task, "--agent"], {
    cwd,
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
    assert.deepEqual(Object.keys(routingCase).sort(), routingCase.files ? ["expect", "files", "name", "task"] : ["expect", "name", "task"]);
  }
});

test("representative tasks satisfy routing correctness and quality expectations", async () => {
  const cases = await readRoutingCases();

  for (const routingCase of cases) {
    const tempDir = routingCase.files ? await writeCaseRepo(routingCase.files) : null;

    try {
      const route = runWorkAgent(routingCase.task, tempDir ?? repoRoot);
      const { failures } = evaluateRoutingCase(route, routingCase);

      assert.deepEqual(failures, [], formatRoutingFailure(routingCase, route, failures));
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  }
});
