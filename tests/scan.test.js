const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm } = require("node:fs/promises");
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

async function withTempRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-scan-"));

  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function makeDirs(root, dirs) {
  for (const dir of dirs) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
}

test("scan detects source, test, and generated folders in temp repo", async () => {
  await withTempRepo(async (tempDir) => {
    await makeDirs(tempDir, [
      "src/api",
      "src/core",
      "app/routes",
      "tests",
      "e2e",
      "dist",
      "coverage"
    ]);

    const result = runCli(["scan", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(report.detected.sourceFolders, ["src", "app"]);
    assert.deepEqual(report.detected.testFolders, ["tests", "e2e"]);
    assert.deepEqual(report.detected.generatedFolders, ["dist", "coverage"]);
    assert.deepEqual(
      report.detected.modules.map((module) => module.path),
      ["app/routes", "src/api", "src/core"]
    );
  });
});

test("scan outputs stable JSON", async () => {
  await withTempRepo(async (tempDir) => {
    await makeDirs(tempDir, ["src/zeta", "src/alpha", "node_modules", "tests"]);

    const first = runCli(["scan", "--json"], { cwd: tempDir });
    const second = runCli(["scan", "--json"], { cwd: tempDir });

    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    assert.equal(first.stdout, second.stdout);
    assert.deepEqual(JSON.parse(first.stdout).detected.modules.map((module) => module.path), [
      "src/alpha",
      "src/zeta"
    ]);
  });
});

test("scan ignores generated folders when detecting modules", async () => {
  await withTempRepo(async (tempDir) => {
    await makeDirs(tempDir, ["src/dist", "src/build", "src/feature", "packages/coverage", "packages/tool"]);

    const result = runCli(["scan", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(report.detected.modules.map((module) => module.path), [
      "packages/tool",
      "src/feature"
    ]);
  });
});

test("scan handles empty repo gracefully", async () => {
  await withTempRepo(async (tempDir) => {
    const result = runCli(["scan", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(report.detected.sourceFolders, []);
    assert.deepEqual(report.detected.testFolders, []);
    assert.deepEqual(report.detected.generatedFolders, []);
    assert.deepEqual(report.detected.modules, []);
    assert.ok(report.suggestions["MODULE_INDEX.md"].some((line) => line.includes("_none detected_")));
  });
});
