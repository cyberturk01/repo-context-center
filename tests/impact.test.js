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

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
}

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withImpactRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-impact-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Auth or login work: read `src/auth/login.ts`, `tests/auth/login.test.js`, and `package.json`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "package.json", JSON.stringify({ scripts: { test: "node --test tests/*.test.js" } }, null, 2));
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() { return true; }\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.js", "test('login', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withDocsOnlyImpactRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-impact-docs-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- README work: read `README.md`."
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "README.md", "# Project\n\nOld wording.\n");
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");
    await writeFixtureFile(tempDir, "tests/index.test.js", "test('ok', () => {});\n");

    runGit(["init"], tempDir);
    runGit(["config", "user.email", "test@example.com"], tempDir);
    runGit(["config", "user.name", "Test User"], tempDir);
    runGit(["add", "."], tempDir);
    runGit(["commit", "-m", "initial"], tempDir);

    await writeFixtureFile(tempDir, "README.md", "# Project\n\nBetter wording.\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("impact --json returns task-based affected files and commands", async () => {
  await withImpactRepo(async (cwd) => {
    const result = runCli(["impact", "update login flow", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stderr, "");
    assert.doesNotMatch(result.stdout, /```/);

    const analysis = JSON.parse(result.stdout);

    assert.equal(analysis.schemaVersion, 1);
    assert.equal(analysis.command, "impact");
    assert.equal(analysis.task, "update login flow");
    assert.equal(analysis.basis, "task");
    assert.deepEqual(analysis.changedFiles, []);
    assert.ok(analysis.affectedFiles.some((file) => file.path === "src/auth/login.ts"));
    assert.ok(analysis.affectedTests.some((file) => file.path === "tests/auth/login.test.js"));
    const testCommand = analysis.suggestedCommands.find((item) => item.command.includes("tests/auth/login.test.js"));
    assert.ok(testCommand);
    assert.equal(testCommand.type, "test");
    assert.equal(testCommand.scope, "focused");
    assert.equal(testCommand.confidence, "high");
  });
});

test("impact includes git working-tree changes and paired tests", async () => {
  await withImpactRepo(async (cwd) => {
    runGit(["init"], cwd);
    runGit(["config", "user.email", "test@example.com"], cwd);
    runGit(["config", "user.name", "Test User"], cwd);
    runGit(["add", "."], cwd);
    runGit(["commit", "-m", "initial"], cwd);

    await writeFixtureFile(cwd, "src/auth/login.ts", "export function login() { return false; }\n");

    const result = runCli(["impact", "fix login regression", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const analysis = JSON.parse(result.stdout);

    assert.equal(analysis.basis, "changed-files-and-task");
    assert.ok(analysis.changedFiles.some((file) => file.path === "src/auth/login.ts"));
    assert.ok(analysis.affectedFiles.some((file) => file.path === "src/auth/login.ts"));
    assert.ok(analysis.affectedTests.some((file) => file.path === "tests/auth/login.test.js"));
    assert.ok(analysis.suggestedCommands.some((item) => (
      item.command === "node --test tests/auth/login.test.js"
      && item.type === "test"
      && item.scope === "focused"
      && item.confidence === "high"
    )));
  });
});

test("impact filters weak semantic source matches from affected files", () => {
  const result = runCli(["impact", "change report output contract", "--json"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");

  const analysis = JSON.parse(result.stdout);
  const affectedFiles = analysis.affectedFiles.map((file) => file.path);
  const weakAffectedFiles = analysis.affectedFiles.filter((file) => /weak semantic match/i.test(file.reason));

  assert.ok(analysis.affectedTests.some((file) => file.path === "tests/outputContract.test.js"));
  assert.deepEqual(weakAffectedFiles, []);
  assert.ok(analysis.notes.includes("Filtered weak semantic source candidates from affectedFiles."));
  if (analysis.affectedFiles.length === 0) {
    assert.ok(analysis.notes.includes("No high-confidence affected source files found."));
  }
  for (const filePath of [
    "src/cli/commands/estimate.ts",
    "src/cli/commands/measure.ts",
    "src/cli/commands/scan.ts",
    "src/cli/commands/validate.ts",
    "src/core/taskIntent.ts",
    "src/core/tokenEstimator.ts"
  ]) {
    assert.equal(affectedFiles.includes(filePath), false, `${filePath} should not be reported as affected`);
  }
  assert.ok(analysis.suggestedCommands.some((item) => (
    item.command.includes("tests/outputContract.test.js")
    && item.type === "test"
    && item.scope === "focused"
  )));
});

test("impact suppresses npm test fallback for docs-only README changes", async () => {
  await withDocsOnlyImpactRepo(async (cwd) => {
    const result = runCli(["impact", "update README wording", "--json"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stderr, "");

    const analysis = JSON.parse(result.stdout);

    assert.ok(analysis.affectedFiles.some((file) => file.path === "README.md"));
    assert.deepEqual(analysis.affectedTests, []);
    assert.equal(analysis.suggestedCommands.some((item) => item.command === "npm test"), false);
    assert.ok(analysis.notes.includes("Docs-only impact detected; no focused test command suggested."));
  });
});

test("impact rejects invalid args", () => {
  const result = runCli(["impact", "--unknown"]);

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Usage: rcc impact "<task>"/);
});
