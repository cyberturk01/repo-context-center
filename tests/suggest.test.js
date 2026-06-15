const assert = require("node:assert/strict");
const { access, mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const { buildStartupContext } = require("../dist/core/suggester.js");

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

async function withTestDiscoveryRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-suggest-tests-"));

  try {
    await writeFixtureFile(tempDir, "tests/example.test.js", "test('example', () => {});\n");
    await writeFixtureFile(tempDir, "tests/archive/example.test.js", "test('archived example', () => {});\n");
    await writeFixtureFile(tempDir, "tests/fixtures/data.json", "{}\n");
    await writeFixtureFile(tempDir, "tests/test-fixtures/helper.ts", "export const fixture = true;\n");
    await writeFixtureFile(tempDir, "tests/__fixtures__/thing.ts", "export const thing = true;\n");
    await writeFixtureFile(tempDir, "tests/__snapshots__/snap.md", "# snap\n");
    await writeFixtureFile(tempDir, "tests/schemas/example.sql", "select 1;\n");
    await writeFixtureFile(tempDir, "src/example.js", "export const example = true;\n");
    await writeFixtureFile(tempDir, "dist/tests/generated.test.js", "test('generated', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withRealisticSuggestRepo(shape, callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `repo-context-center-suggest-${shape}-`));

  try {
    if (shape === "typescript-app") {
      await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
      await writeFixtureFile(tempDir, "src/auth/session.ts", "export function createSession() {}\n");
      await writeFixtureFile(tempDir, "src/billing/invoice.ts", "export function invoice() {}\n");
      await writeFixtureFile(tempDir, "tests/billing/invoice.test.ts", "test('invoice', () => {});\n");
      await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");
      await writeFixtureFile(tempDir, "package.json", "{\"scripts\":{\"test\":\"node --test\"}}\n");
      await writeNoiseFixtureFiles(tempDir);
    } else if (shape === "monorepo") {
      await writeFixtureFile(tempDir, "packages/api/src/users/userService.ts", "export function getUser() {}\n");
      await writeFixtureFile(tempDir, "packages/api/tests/users/userService.test.ts", "test('user service', () => {});\n");
      await writeFixtureFile(tempDir, "packages/web/src/components/UserCard.tsx", "export function UserCard() { return null; }\n");
      await writeFixtureFile(tempDir, "packages/web/tests/UserCard.test.tsx", "test('user card', () => {});\n");
      await writeFixtureFile(tempDir, "packages/web/tests/users/userService.test.ts", "test('wrong workspace user service', () => {});\n");
      await writeNoiseFixtureFiles(tempDir);
    } else if (shape === "python-app") {
      await writeFixtureFile(tempDir, "app/auth/login.py", "def login():\n    return True\n");
      await writeFixtureFile(tempDir, "tests/auth/test_login.py", "def test_login():\n    assert True\n");
      await writeFixtureFile(tempDir, "pyproject.toml", "[project]\nname = \"fixture\"\n");
      await writeNoiseFixtureFiles(tempDir);
    } else if (shape === "workflow-heavy") {
      await writeFixtureFile(tempDir, ".github/workflows/ci.yml", "name: ci\n");
      await writeFixtureFile(tempDir, ".github/workflows/release.yml", "name: release\n");
      await writeFixtureFile(tempDir, "package.json", "{\"scripts\":{\"ci\":\"npm test\"}}\n");
      await writeFixtureFile(tempDir, "package-lock.json", "{}\n");
      await writeFixtureFile(tempDir, "tests/ci/workflow.test.ts", "test('workflow', () => {});\n");
      await writeNoiseFixtureFiles(tempDir);
    } else {
      throw new Error(`Unknown realistic suggest repo shape: ${shape}`);
    }

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeNoiseFixtureFiles(root) {
  await writeFixtureFile(root, "dist/auth/generatedLogin.test.ts", "test('generated', () => {});\n");
  await writeFixtureFile(root, "node_modules/example/index.ts", "export const dependency = true;\n");
  await writeFixtureFile(root, "tests/fixtures/login.test.ts", "test('fixture', () => {});\n");
  await writeFixtureFile(root, "tests/__fixtures__/login.ts", "export const fixture = true;\n");
  await writeFixtureFile(root, "tests/__snapshots__/login.test.ts.snap", "snapshot\n");
  await writeFixtureFile(root, "src/assets/logo.svg", "<svg />\n");
}

function assertNoPrimaryNoise(suggestion) {
  const primaryFiles = [...suggestion.likelySourceFiles, ...suggestion.likelyTests];

  assert.ok(primaryFiles.every((filePath) => !filePath.startsWith("dist/")));
  assert.ok(primaryFiles.every((filePath) => !filePath.startsWith("node_modules/")));
  assert.ok(primaryFiles.every((filePath) => !filePath.includes("/fixtures/")));
  assert.ok(primaryFiles.every((filePath) => !filePath.includes("/__fixtures__/")));
  assert.ok(primaryFiles.every((filePath) => !filePath.includes("/__snapshots__/")));
  assert.ok(primaryFiles.every((filePath) => !filePath.includes("/archive/")));
  assert.ok(primaryFiles.every((filePath) => !filePath.endsWith(".snap")));
  assert.ok(primaryFiles.every((filePath) => !filePath.endsWith(".svg")));
  assert.ok(primaryFiles.every((filePath) => !filePath.endsWith("package-lock.json")));
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

test("buildStartupContext generates read-first docs and startup instructions", async () => {
  await withContextRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");

    const startupContext = await buildStartupContext(tempDir, "fix auth bug");

    assert.equal(startupContext.task, "fix auth bug");
    assert.equal(startupContext.mode, "Investigation");
    assert.equal(startupContext.riskLevel, "high");
    assert.ok(startupContext.readFirstDocs.includes("AGENTS.md"));
    assert.ok(startupContext.readFirstDocs.includes("docs/ai-context/TASK_ROUTING.md"));
    assert.ok(startupContext.likelySourceFiles.includes("src/auth/authService.ts"));
    assert.ok(startupContext.likelyTests.includes("tests/auth/authService.test.ts"));
    assert.ok(startupContext.recommendationReasons["src/auth/authService.ts"].includes("matched task token: auth"));
    assert.ok(startupContext.recommendationReasons["src/auth/authService.ts"].includes("matched parent folder: auth"));
    assert.ok(startupContext.recommendationReasons["tests/auth/authService.test.ts"].includes("paired with source file: src/auth/authService.ts"));
    assert.ok(startupContext.startupInstructions.some((instruction) => instruction.includes("Read AGENTS.md")));
    assert.ok(startupContext.startupInstructions.some((instruction) => instruction.includes("Open likely source files")));
    assert.ok(startupContext.startupInstructions.some((instruction) => instruction.includes("Open likely tests")));
  });
});

test("suggest JSON keeps compatible fields while exposing StartupContext fields", async () => {
  await withContextRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");

    const result = runCli(["suggest", "fix auth bug", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(Array.isArray(suggestion.contextFiles));
    assert.ok(Array.isArray(suggestion.readFirstDocs));
    assert.ok(Array.isArray(suggestion.startupInstructions));
    assert.equal(typeof suggestion.recommendationReasons, "object");
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/TASK_ROUTING.md"));
    assert.ok(suggestion.readFirstDocs.includes("AGENTS.md"));
    assert.ok(suggestion.startupInstructions.length > 0);
  });
});

test("generic unit test failure gets useful startup instructions without source confidence", async () => {
  await withTestDiscoveryRepo(async (tempDir) => {
    const startupContext = await buildStartupContext(tempDir, "fix unit test failure");

    assert.equal(startupContext.task, "fix unit test failure");
    assert.ok(startupContext.likelyTests.includes("tests/example.test.js"));
    assert.deepEqual(startupContext.likelySourceFiles, []);
    assert.ok(startupContext.recommendationReasons["tests/example.test.js"].includes("generic test-task fallback"));
    assert.ok(startupContext.startupInstructions.some((instruction) => instruction.includes("No confident source files")));
    assert.ok(startupContext.startupInstructions.some((instruction) => instruction.includes("Open likely tests")));
    assert.ok(startupContext.startupInstructions.some((instruction) => instruction.includes("Expand search only")));
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

test("suggest discovers real tests for generic test tasks", async () => {
  await withTestDiscoveryRepo(async (tempDir) => {
    const result = runCli(["suggest", "fix test", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(suggestion.likelyTests.includes("tests/example.test.js"));
    assert.ok(!suggestion.likelyTests.includes("dist/tests/generated.test.js"));
    assert.ok(!suggestion.likelyTests.includes("tests/archive/example.test.js"));
    assert.ok(!suggestion.likelyTests.includes("tests/fixtures/data.json"));
    assert.ok(!suggestion.likelyTests.includes("tests/test-fixtures/helper.ts"));
    assert.ok(!suggestion.likelyTests.includes("tests/__fixtures__/thing.ts"));
    assert.ok(!suggestion.likelyTests.includes("tests/__snapshots__/snap.md"));
    assert.ok(!suggestion.likelyTests.includes("tests/schemas/example.sql"));
    assert.deepEqual(suggestion.likelyTests, ["tests/example.test.js"]);
    await assertReturnedPathsExist(tempDir, suggestion.likelyTests);
  });
});

test("suggest discovers real tests for unit test failure tasks", async () => {
  await withTestDiscoveryRepo(async (tempDir) => {
    const result = runCli(["suggest", "fix unit test failure", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(suggestion.likelyTests.includes("tests/example.test.js"));
    assert.ok(!suggestion.likelyTests.includes("dist/tests/generated.test.js"));
    assert.ok(!suggestion.likelyTests.includes("tests/archive/example.test.js"));
    assert.ok(!suggestion.likelyTests.includes("tests/fixtures/data.json"));
    assert.ok(!suggestion.likelyTests.includes("tests/__snapshots__/snap.md"));
    assert.ok(!suggestion.likelyTests.includes("tests/schemas/example.sql"));
    assert.deepEqual(suggestion.likelyTests, ["tests/example.test.js"]);
    assert.ok(suggestion.reasons.includes("generic test-task fallback ranked active test files"));
    await assertReturnedPathsExist(tempDir, suggestion.likelyTests);
  });
});

test("suggest falls back to broader tests files when no primary tests exist", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-suggest-fallback-tests-"));

  try {
    await writeFixtureFile(tempDir, "tests/helper.ts", "export const helper = true;\n");
    await writeFixtureFile(tempDir, "tests/fixtures/data.json", "{}\n");
    await writeFixtureFile(tempDir, "tests/__snapshots__/snap.md", "# snap\n");

    const result = runCli(["suggest", "fix test", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(suggestion.likelyTests, ["tests/helper.ts"]);
    await assertReturnedPathsExist(tempDir, suggestion.likelyTests);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("suggest respects max files for likely tests", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-suggest-max-tests-"));

  try {
    await writeFixtureFile(tempDir, "tests/a.test.js", "test('a', () => {});\n");
    await writeFixtureFile(tempDir, "tests/b.test.js", "test('b', () => {});\n");

    const result = runCli(["suggest", "fix test", "--max-files", "1", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(suggestion.likelyTests, ["tests/a.test.js"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("suggest returns empty file arrays for empty repos", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-suggest-empty-"));

  try {
    const result = runCli(["suggest", "fix test", "--json"], { cwd: tempDir });
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

test("suggest finds TypeScript app login tests for unit test failures", async () => {
  await withRealisticSuggestRepo("typescript-app", async (tempDir) => {
    const result = runCli(["suggest", "fix login unit test failure", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(suggestion.likelyTests.slice(0, 1), ["tests/auth/login.test.ts"]);
    assertNoPrimaryNoise(suggestion);
    await assertReturnedPathsExist(tempDir, suggestion.likelyTests);
  });
});

test("suggest finds TypeScript auth source files and auth tests for auth bugs", async () => {
  await withRealisticSuggestRepo("typescript-app", async (tempDir) => {
    const result = runCli(["suggest", "fix auth bug", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(suggestion.likelySourceFiles.slice(0, 2), ["src/auth/login.ts", "src/auth/session.ts"]);
    assert.deepEqual(suggestion.likelyTests.slice(0, 1), ["tests/auth/login.test.ts"]);
    assert.ok(!suggestion.likelySourceFiles.slice(0, 2).includes("src/billing/invoice.ts"));
    assertNoPrimaryNoise(suggestion);
    await assertReturnedPathsExist(tempDir, [...suggestion.likelySourceFiles, ...suggestion.likelyTests]);
  });
});

test("suggest finds monorepo package source and package tests", async () => {
  await withRealisticSuggestRepo("monorepo", async (tempDir) => {
    const result = runCli(["suggest", "fix user service bug", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(suggestion.likelySourceFiles.slice(0, 1), ["packages/api/src/users/userService.ts"]);
    assert.deepEqual(suggestion.likelyTests.slice(0, 1), ["packages/api/tests/users/userService.test.ts"]);
    assert.ok(suggestion.likelyTests.indexOf("packages/api/tests/users/userService.test.ts") < suggestion.likelyTests.indexOf("packages/web/tests/users/userService.test.ts"));
    assert.ok(suggestion.recommendationReasons["packages/api/tests/users/userService.test.ts"].includes("same monorepo package scope"));
    assertNoPrimaryNoise(suggestion);
    await assertReturnedPathsExist(tempDir, [...suggestion.likelySourceFiles, ...suggestion.likelyTests]);
  });
});

test("suggest finds Python app login tests for unit test failures", async () => {
  await withRealisticSuggestRepo("python-app", async (tempDir) => {
    const result = runCli(["suggest", "fix login unit test failure", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(suggestion.likelyTests.slice(0, 1), ["tests/auth/test_login.py"]);
    assertNoPrimaryNoise(suggestion);
    await assertReturnedPathsExist(tempDir, suggestion.likelyTests);
  });
});

test("suggest finds Python auth source and auth tests for auth bugs", async () => {
  await withRealisticSuggestRepo("python-app", async (tempDir) => {
    const result = runCli(["suggest", "fix auth bug", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(suggestion.likelySourceFiles.slice(0, 1), ["app/auth/login.py"]);
    assert.deepEqual(suggestion.likelyTests.slice(0, 1), ["tests/auth/test_login.py"]);
    assertNoPrimaryNoise(suggestion);
    await assertReturnedPathsExist(tempDir, [...suggestion.likelySourceFiles, ...suggestion.likelyTests]);
  });
});

test("suggest finds workflow files for GitHub Actions workflow updates", async () => {
  await withRealisticSuggestRepo("workflow-heavy", async (tempDir) => {
    const result = runCli(["suggest", "update github actions workflow", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(suggestion.likelySourceFiles.slice(0, 2), [".github/workflows/ci.yml", ".github/workflows/release.yml"]);
    assert.ok(suggestion.likelySourceFiles.includes("package.json"));
    assert.ok(!suggestion.likelySourceFiles.includes("package-lock.json"));
    assert.ok(suggestion.recommendationReasons[".github/workflows/ci.yml"].includes("workflow task match"));
    assert.ok(!JSON.stringify(suggestion.recommendationReasons).includes("score"));
    assertNoPrimaryNoise(suggestion);
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
