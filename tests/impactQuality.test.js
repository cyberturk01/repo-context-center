const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const {
  evaluateImpactCase,
  formatImpactFailure
} = require("./helpers/impactEvaluation");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const fixturePath = path.join(repoRoot, "tests", "fixtures", "impact-cases.json");

async function readImpactCases() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
}

async function writeCaseRepo(impactCase) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-impact-case-"));

  for (const [filePath, content] of Object.entries(impactCase.files ?? {})) {
    await writeFixtureFile(tempDir, filePath, content);
  }

  runGit(["init"], tempDir);
  runGit(["config", "user.email", "test@example.com"], tempDir);
  runGit(["config", "user.name", "Test User"], tempDir);
  runGit(["add", "."], tempDir);
  runGit(["commit", "-m", "initial"], tempDir);

  for (const [filePath, content] of Object.entries(impactCase.changes ?? {})) {
    await writeFixtureFile(tempDir, filePath, content);
  }

  return tempDir;
}

function runImpact(task, cwd) {
  const result = spawnSync(process.execPath, [cliPath, "impact", task, "--json"], {
    cwd,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  assert.doesNotMatch(result.stdout, /```/);

  return JSON.parse(result.stdout);
}

test("impact quality fixture has deterministic case shape", async () => {
  const cases = await readImpactCases();

  assert.ok(cases.length >= 4);
  for (const impactCase of cases) {
    assert.equal(typeof impactCase.name, "string");
    assert.equal(typeof impactCase.task, "string");
    assert.equal(typeof impactCase.files, "object");
    assert.equal(typeof impactCase.changes, "object");
    assert.equal(typeof impactCase.expect, "object");
    assert.ok(impactCase.name.length > 0);
    assert.ok(impactCase.task.length > 0);
    assert.deepEqual(Object.keys(impactCase).sort(), ["changes", "expect", "files", "name", "task"]);
  }
});

test("representative impact cases stay focused and useful", async () => {
  const cases = await readImpactCases();

  for (const impactCase of cases) {
    const tempDir = await writeCaseRepo(impactCase);

    try {
      const analysis = runImpact(impactCase.task, tempDir);
      const { failures } = evaluateImpactCase(analysis, impactCase);

      assert.deepEqual(failures, [], formatImpactFailure(impactCase, analysis, failures));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
});
