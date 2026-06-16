const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runCli(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8"
  });
}

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withAdoptionRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-adoption-"));

  try {
    const initResult = runCli(tempDir, ["init"]);
    assert.equal(initResult.status, 0);

    await writeFixtureFile(tempDir, "package.json", JSON.stringify({
      scripts: {
        test: "node --test tests/*.test.js",
        lint: "eslint ."
      }
    }, null, 2));
    await writeFixtureFile(tempDir, "tsconfig.json", "{\"compilerOptions\":{}}\n");
    await writeFixtureFile(tempDir, ".github/workflows/ci.yml", "name: ci\n");
    await writeFixtureFile(tempDir, ".github/workflows/release.yml", "name: release\n");
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("v0.5 adoption flow generates AGENTS.md task startup guidance", async () => {
  await withAdoptionRepo(async (tempDir) => {
    const mapResult = runCli(tempDir, ["map", "--write"]);
    assert.equal(mapResult.status, 0);

    const agents = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");
    const noShellLine = agents.split("\n").find((line) => line.includes("No shell: read")) ?? "";

    assert.match(agents, /Compact generated entrypoint\./);
    assert.match(agents, /## RCC Workflow/);
    assert.match(agents, /Run `rcc work "<task>"`\./);
    assert.match(agents, /Read the focused context\./);
    assert.match(agents, /Run `rcc done "<summary>" --files <files> --verify "<check>"`\./);
    assert.match(noShellLine, /docs\/ai-context\/COMMUNICATION_MODE\.md/);
    assert.match(noShellLine, /docs\/ai-context\/TASK_ROUTING\.md/);
    assert.match(noShellLine, /docs\/ai-context\/TOKEN_BUDGET\.md/);
    assert.match(noShellLine, /docs\/ai-context\/DO_NOT_READ\.md/);
    assert.doesNotMatch(noShellLine, /docs\/ai-context\/MODULE_INDEX\.md/);
    assert.match(agents, /Use `docs\/ai-context\/MODULE_INDEX\.md` only when routing is missing or the task spans modules\./);
    assert.match(agents, /Generated repo maps live in `docs\/ai-context\/\*`/);
    assert.doesNotMatch(agents, /^Before a task:$/m);
    assert.doesNotMatch(agents, /^Read:$/m);
    assert.doesNotMatch(agents, /^Modes:$/m);
  });
});

test("v0.5 adoption flow start prioritizes workflow files for workflow tasks", async () => {
  await withAdoptionRepo(async (tempDir) => {
    assert.equal(runCli(tempDir, ["map", "--write"]).status, 0);

    const result = runCli(tempDir, ["start", "update github actions workflow"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /- \.github\/workflows\/ci\.yml/);
    assert.match(result.stdout, /- \.github\/workflows\/release\.yml/);
    assert.ok(result.stdout.indexOf("- .github/workflows/ci.yml") < result.stdout.indexOf("- package.json"));
    assert.ok(result.stdout.indexOf("- .github/workflows/release.yml") < result.stdout.indexOf("- package.json"));
    if (result.stdout.includes("- tsconfig.json")) {
      assert.ok(result.stdout.indexOf("- .github/workflows/ci.yml") < result.stdout.indexOf("- tsconfig.json"));
      assert.ok(result.stdout.indexOf("- .github/workflows/release.yml") < result.stdout.indexOf("- tsconfig.json"));
    }
  });
});

test("v0.5 adoption flow keeps generic unit-test startup fallback compact", async () => {
  await withAdoptionRepo(async (tempDir) => {
    for (const name of ["a", "b", "c", "d", "e", "f", "g"]) {
      await writeFixtureFile(tempDir, `tests/${name}.test.js`, `test('${name}', () => {});\n`);
    }

    const result = runCli(tempDir, ["start", "fix unit test failure"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Likely tests:\n(?:- .+\n)+/);
    assert.equal((result.stdout.match(/generic test-task fallback/g) ?? []).length, 5);
    assert.match(result.stdout, /- tests\/d\.test\.js/);
    assert.doesNotMatch(result.stdout, /- tests\/f\.test\.js/);
  });
});

test("v0.5 adoption flow suggest --json remains parseable and additive", async () => {
  await withAdoptionRepo(async (tempDir) => {
    assert.equal(runCli(tempDir, ["map", "--write"]).status, 0);

    const result = runCli(tempDir, ["suggest", "fix auth login bug", "--json"]);
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(Array.isArray(suggestion.contextFiles));
    assert.ok(Array.isArray(suggestion.likelySourceFiles));
    assert.ok(Array.isArray(suggestion.likelyTests));
    assert.ok(Array.isArray(suggestion.readFirstDocs));
    assert.ok(Array.isArray(suggestion.startupInstructions));
    assert.equal(typeof suggestion.recommendationReasons, "object");
    assert.equal(typeof suggestion.emptyRecommendationReasons, "object");
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/TASK_ROUTING.md"));
    assert.ok(suggestion.readFirstDocs.includes("AGENTS.md"));
    assert.ok(suggestion.startupInstructions.length > 0);
    assert.ok(!JSON.stringify(suggestion).includes("score"));
  });
});
