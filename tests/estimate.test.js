const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

const startupFiles = [
  "AGENTS.md",
  "docs/ai-context/COMMUNICATION_MODE.md",
  "docs/ai-context/TASK_ROUTING.md",
  "docs/ai-context/TOKEN_BUDGET.md",
  "docs/ai-context/DO_NOT_READ.md"
];

const onDemandFiles = [
  "docs/ai-context/MODULE_INDEX.md",
  "docs/ai-context/PROJECT_MAP.md",
  "docs/ai-context/DEPENDENCY_MAP.md",
  "docs/ai-context/RISK_REGISTER.md",
  "docs/ai-context/HOTSPOTS.md",
  "docs/ai-context/SYMBOL_MAP.md",
  "docs/ai-context/LESSONS_LEARNED.md"
];

const historyFiles = ["docs/ai-context/CHANGE_LOG.md"];

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8"
  });
}

function tokenEstimate(content) {
  return Math.ceil(content.length / 4);
}

async function writeText(root, file, content) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), content, "utf8");
}

async function withTempRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-estimate-"));

  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeContextRepo(root) {
  const contents = {};
  const allFiles = [...startupFiles, ...onDemandFiles, ...historyFiles];

  for (const [index, file] of allFiles.entries()) {
    contents[file] = `${file}\n${"x".repeat((index + 1) * 12)}\n`;
  }

  contents["docs/ai-context/DO_NOT_READ.md"] = [
    "# Do Not Read",
    "",
    "- `node_modules/`",
    "- `dist/`",
    "- `generated/`"
  ].join("\n");
  contents["docs/ai-context/TASK_ROUTING.md"] = [
    "# Task Routing",
    "",
    "- UI work: read `src/ui.ts` and `tests/ui.test.ts`."
  ].join("\n");
  contents["docs/ai-context/MODULE_INDEX.md"] = [
    "# Module Index",
    "",
    "| Path | Owns | Read When |",
    "| --- | --- | --- |",
    "| `src/ui.ts` | UI module | UI work |"
  ].join("\n");

  for (const [file, content] of Object.entries(contents)) {
    await writeText(root, file, content);
  }

  await writeText(root, "docs/ai-context/archive/CHANGE_LOG-2026.md", "archived history\n");
  await writeText(root, "src/ui.ts", "export const ui = true;\n");
  await writeText(root, "tests/ui.test.ts", "test('ui', () => {});\n");

  return contents;
}

test("estimate calculates tokens for installed context files", async () => {
  await withTempRepo(async (tempDir) => {
    const contents = await writeContextRepo(tempDir);
    const result = runCli(["estimate", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);
    const expectedStartup = startupFiles.reduce((total, file) => total + tokenEstimate(contents[file]), 0);

    assert.equal(result.status, 0);
    assert.equal(report.method, "ceil(characters / 4)");
    assert.equal(report.startupTokens, expectedStartup);
    assert.ok(report.onDemandTokens > 0);
  });
});

test("estimate splits startup, on-demand, and history context", async () => {
  await withTempRepo(async (tempDir) => {
    await writeContextRepo(tempDir);
    const result = runCli(["estimate", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);

    assert.deepEqual(report.startupFiles.map((file) => file.path), startupFiles);
    assert.deepEqual(report.onDemandFiles.map((file) => file.path), onDemandFiles);
    assert.ok(report.historyFiles.some((file) => file.path === "docs/ai-context/CHANGE_LOG.md"));
    assert.ok(report.historyFiles.some((file) => file.path === "docs/ai-context/archive/CHANGE_LOG-2026.md"));
  });
});

test("estimate excludes archive files from detailed mode included context", async () => {
  await withTempRepo(async (tempDir) => {
    await writeContextRepo(tempDir);
    const result = runCli(["estimate", "--mode", "detailed", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);
    const includedPaths = report.includedContextFiles.map((file) => file.path);

    assert.ok(includedPaths.includes("docs/ai-context/CHANGE_LOG.md"));
    assert.ok(!includedPaths.includes("docs/ai-context/archive/CHANGE_LOG-2026.md"));
  });
});

test("compare-naive excludes generated folders", async () => {
  await withTempRepo(async (tempDir) => {
    await writeContextRepo(tempDir);
    await writeText(tempDir, "src/app.ts", "a".repeat(80));
    await writeText(tempDir, "node_modules/noise.js", "n".repeat(4000));
    await writeText(tempDir, "dist/bundle.js", "d".repeat(4000));
    await writeText(tempDir, "generated/client.ts", "g".repeat(4000));

    const result = runCli(["estimate", "--compare-naive", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(report.naiveScanTokens > 0);
    assert.ok(report.naiveScanTokens < 1500);
    assert.equal(report.naiveScanCapped, false);
  });
});

test("--json returns parseable estimate output", async () => {
  await withTempRepo(async (tempDir) => {
    await writeContextRepo(tempDir);
    const result = runCli(["estimate", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(report.mode, "compact");
    assert.ok(Array.isArray(report.warnings));
  });
});

test("--mode changes included context files", async () => {
  await withTempRepo(async (tempDir) => {
    await writeContextRepo(tempDir);
    const compact = JSON.parse(runCli(["estimate", "--mode", "compact", "--json"], { cwd: tempDir }).stdout);
    const investigation = JSON.parse(runCli(["estimate", "--mode", "investigation", "--json"], { cwd: tempDir }).stdout);
    const detailed = JSON.parse(runCli(["estimate", "--mode", "detailed", "--json"], { cwd: tempDir }).stdout);

    assert.ok(compact.includedContextTokens < investigation.includedContextTokens);
    assert.ok(investigation.includedContextTokens < detailed.includedContextTokens);
    assert.ok(investigation.includedContextFiles.some((file) => file.path === "docs/ai-context/RISK_REGISTER.md"));
  });
});

test("estimate handles missing context files gracefully", async () => {
  await withTempRepo(async (tempDir) => {
    const result = runCli(["estimate", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(report.startupTokens, 0);
    assert.ok(report.startupFiles.every((file) => file.missing));
  });
});

test("compare-naive respects --max-files cap", async () => {
  await withTempRepo(async (tempDir) => {
    await writeText(tempDir, "a.ts", "a".repeat(20));
    await writeText(tempDir, "b.ts", "b".repeat(20));
    await writeText(tempDir, "c.ts", "c".repeat(20));

    const result = runCli(["estimate", "--compare-naive", "--max-files", "1", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(report.naiveScanFiles, 1);
    assert.equal(report.naiveScanCapped, true);
    assert.ok(report.warnings.some((warning) => warning.includes("capped at 1 files")));
  });
});
