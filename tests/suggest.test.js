const assert = require("node:assert/strict");
const { access, mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
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

async function withContextRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-suggest-"));
  const contextDir = path.join(tempDir, "docs", "ai-context");

  try {
    await mkdir(contextDir, { recursive: true });
    await writeFile(
      path.join(contextDir, "TASK_ROUTING.md"),
      [
        "# Task Routing",
        "",
        "- UI work: read `src/ui`, `tests/ui.test.ts`, and `docs/ai-context/MODULE_INDEX.md`.",
        "- Auth or security work: read `src/auth`, `tests/auth.test.ts`, and `docs/ai-context/RISK_REGISTER.md`."
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(contextDir, "MODULE_INDEX.md"),
      [
        "# Module Index",
        "",
        "| Path | Owns | Read When |",
        "| --- | --- | --- |",
        "| `src/ui` | UI module | UI, design, button, layout work |",
        "| `src/auth` | Auth module | auth, login, consent, security work |"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(contextDir, "DEPENDENCY_MAP.md"),
      [
        "# Dependency Map",
        "",
        "| From | Depends On | Why It Matters |",
        "| --- | --- | --- |",
        "| `src/auth` | `src/db`, `src/session` | Security and consent flows persist state |"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(contextDir, "SYMBOL_MAP.md"),
      [
        "# Symbol Map",
        "",
        "## src/auth/authService.ts",
        "",
        "Important symbols:",
        "- login",
        "- logout",
        "- refreshToken",
        "- validateRefreshToken",
        "",
        "Common tests:",
        "- tests/auth/authService.test.ts",
        "",
        "Risk:",
        "high"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(contextDir, "RISK_REGISTER.md"),
      [
        "# Risk Register",
        "",
        "| Area | Risk | Check |",
        "| --- | --- | --- |",
        "| `src/auth` | Security regressions expose accounts | Run `tests/auth.test.ts` |"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(contextDir, "HOTSPOTS.md"),
      [
        "# Hotspots",
        "",
        "| Hotspot | Why | Safer Move |",
        "| --- | --- | --- |",
        "| `src/auth/session.ts` | Session state is easy to regress | Add auth tests |"
      ].join("\n"),
      "utf8"
    );
    await writeFixtureFile(tempDir, "src/ui/button.ts", "export const button = 'button';\n");
    await writeFixtureFile(tempDir, "src/auth/authService.ts", "export function refreshToken() {}\n");
    await writeFixtureFile(tempDir, "src/auth/session.ts", "export const session = {};\n");
    await writeFixtureFile(tempDir, "src/db/client.ts", "export const db = {};\n");
    await writeFixtureFile(tempDir, "src/session/store.ts", "export const store = {};\n");
    await writeFixtureFile(tempDir, "tests/ui.test.ts", "test('ui', () => {});\n");
    await writeFixtureFile(tempDir, "tests/auth.test.ts", "test('auth', () => {});\n");
    await writeFixtureFile(tempDir, "tests/auth/authService.test.ts", "test('refresh', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function assertReturnedPathsExist(root, paths) {
  for (const filePath of paths) {
    await access(path.join(root, filePath));
  }
}

test("suggest uses compact mode for simple UI task", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "adjust UI button spacing", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(suggestion.mode, "Compact");
    assert.equal(suggestion.riskLevel, "low");
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/TASK_ROUTING.md"));
    assert.deepEqual(suggestion.likelySourceFiles, ["src/ui/button.ts"]);
    await assertReturnedPathsExist(tempDir, suggestion.likelySourceFiles);
  });
});

test("suggest uses investigation mode for security task", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "fix security issue in auth consent", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(suggestion.mode, "Investigation");
    assert.equal(suggestion.riskLevel, "high");
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/RISK_REGISTER.md"));
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/HOTSPOTS.md"));
    await assertReturnedPathsExist(tempDir, suggestion.likelySourceFiles);
    await assertReturnedPathsExist(tempDir, suggestion.likelyTests);
  });
});

test("suggest returns likely files from task routing", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "UI layout update", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(suggestion.likelySourceFiles.includes("src/ui/button.ts"));
    assert.ok(suggestion.likelyTests.includes("tests/ui.test.ts"));
    await assertReturnedPathsExist(tempDir, suggestion.likelySourceFiles);
    await assertReturnedPathsExist(tempDir, suggestion.likelyTests);
  });
});

test("suggest includes dependency map when module has dependencies", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "auth login change", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/DEPENDENCY_MAP.md"));
    assert.ok(suggestion.likelySourceFiles.includes("src/db/client.ts"));
    assert.ok(suggestion.likelySourceFiles.includes("src/session/store.ts"));
    await assertReturnedPathsExist(tempDir, suggestion.likelySourceFiles);
  });
});

test("suggest matches symbols from symbol map", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "refresh token bug", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/SYMBOL_MAP.md"));
    assert.ok(suggestion.likelySourceFiles.includes("src/auth/authService.ts"));
    assert.ok(suggestion.likelyTests.includes("tests/auth/authService.test.ts"));
    await assertReturnedPathsExist(tempDir, suggestion.likelySourceFiles);
    await assertReturnedPathsExist(tempDir, suggestion.likelyTests);
    assert.deepEqual(suggestion.relevantSymbols, [
      {
        file: "src/auth/authService.ts",
        symbols: ["refreshToken", "validateRefreshToken"],
        tests: ["tests/auth/authService.test.ts"],
        risk: "high"
      }
    ]);
  });
});

test("suggest never returns placeholder paths", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "hotspot flow bug", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);
    const symbolPaths = suggestion.relevantSymbols.flatMap((entry) => [entry.file, ...entry.tests]);
    const returnedPaths = [...suggestion.likelySourceFiles, ...suggestion.likelyTests, ...symbolPaths];

    assert.equal(result.status, 0);
    assert.ok(!returnedPaths.includes("path/or/flow"));
    assert.ok(returnedPaths.every((filePath) => !filePath.includes("path/or/flow")));
    await assertReturnedPathsExist(tempDir, returnedPaths);
  });
});

test("suggest filters missing symbol map paths", async () => {
  await withContextRepo(async (tempDir) => {
    await writeFile(
      path.join(tempDir, "docs", "ai-context", "SYMBOL_MAP.md"),
      [
        "# Symbol Map",
        "",
        "## path/or/flow",
        "",
        "Important symbols:",
        "- missingThing",
        "",
        "Common tests:",
        "- tests/missing.test.ts",
        "",
        "Risk:",
        "high"
      ].join("\n"),
      "utf8"
    );

    const result = runCli(["suggest", "missing thing bug", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(suggestion.relevantSymbols, []);
    assert.ok(!suggestion.likelySourceFiles.includes("path/or/flow"));
    assert.ok(!suggestion.likelyTests.includes("tests/missing.test.ts"));
  });
});

test("suggest returns empty file arrays for empty repos", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-suggest-empty-"));

  try {
    const result = runCli(["suggest", "adjust UI button spacing", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(suggestion.likelySourceFiles, []);
    assert.deepEqual(suggestion.likelyTests, []);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("suggest includes workflow files for deployment tasks", async () => {
  await withContextRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, ".github/workflows/ci.yml", "name: ci\n");
    await writeFixtureFile(tempDir, "package.json", "{\"scripts\":{}}\n");
    await writeFixtureFile(tempDir, "Dockerfile", "FROM node:24\n");
    await writeFixtureFile(tempDir, "railway.json", "{}\n");

    const result = runCli(["suggest", "production deployment workflow release", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(suggestion.likelySourceFiles.includes(".github/workflows/ci.yml"));
    assert.ok(suggestion.likelySourceFiles.includes("package.json"));
    assert.ok(suggestion.likelySourceFiles.includes("Dockerfile"));
    assert.ok(suggestion.likelySourceFiles.includes("railway.json"));
    await assertReturnedPathsExist(tempDir, suggestion.likelySourceFiles);
  });
});

test("suggest text output includes symbols with --symbols", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "auth bug", "--symbols"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Relevant symbols:/);
    assert.match(result.stdout, /src\/auth\/authService\.ts/);
    assert.match(result.stdout, /refreshToken/);
  });
});
