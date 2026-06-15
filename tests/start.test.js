const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const { formatStartupPrompt } = require("../dist/core/startPrompt.js");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8"
  });
}

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withStartRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-start-"));

  try {
    await writeFixtureFile(tempDir, "AGENTS.md", "Repo guidance\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Auth work: read `src/auth`, `tests/auth/login.test.ts`, and `docs/ai-context/RISK_REGISTER.md`."
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/MODULE_INDEX.md",
      [
        "# Module Index",
        "",
        "| Path | Owns | Read When |",
        "| --- | --- | --- |",
        "| `src/auth` | Auth module | auth, login, security work |"
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/RISK_REGISTER.md",
      [
        "# Risk Register",
        "",
        "| Area | Risk | Check |",
        "| --- | --- | --- |",
        "| `src/auth` | Security regressions expose accounts | Run `tests/auth/login.test.ts` |"
      ].join("\n")
    );
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/HOTSPOTS.md",
      [
        "# Hotspots",
        "",
        "| Hotspot | Why | Safer Move |",
        "| --- | --- | --- |",
        "| `src/auth/session.ts` | Session state is easy to regress | Add auth tests |"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "src/auth/login.ts", "export function login() {}\n");
    await writeFixtureFile(tempDir, "src/auth/session.ts", "export const session = {};\n");
    await writeFixtureFile(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");
    await writeFixtureFile(tempDir, ".github/workflows/ci.yml", "name: ci\n");
    await writeFixtureFile(tempDir, ".github/workflows/release.yml", "name: release\n");
    await writeFixtureFile(tempDir, "package.json", "{\"scripts\":{\"ci\":\"npm test\"}}\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("start prints startup instructions as clean text", async () => {
  await withStartRepo(async (tempDir) => {
    const result = runCli(["start", "fix unit test failure"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^Before starting this task, use Repository Context Center\./);
    assert.match(result.stdout, /Task:\nfix unit test failure/);
    assert.match(result.stdout, /Read first:\n- AGENTS\.md/);
    assert.match(result.stdout, /Likely tests:\n- tests\/auth\/login\.test\.ts/);
    assert.doesNotMatch(result.stdout, /^\{/);
  });
});

test("start includes high-risk guidance for auth bugs", async () => {
  await withStartRepo(async (tempDir) => {
    const result = runCli(["start", "fix auth bug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Risk:\nhigh/);
    assert.match(result.stdout, /Treat this as high risk/);
    assert.match(result.stdout, /Likely source files:\n(?:- .+\n)*- src\/auth\/login\.ts/);
  });
});

test("start includes workflow-aware guidance for GitHub Actions tasks", async () => {
  await withStartRepo(async (tempDir) => {
    const result = runCli(["start", "update github actions workflow"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /- \.github\/workflows\/ci\.yml/);
    assert.match(result.stdout, /- \.github\/workflows\/release\.yml/);
    assert.match(result.stdout, /For workflow or deployment changes/);
  });
});

test("startup prompt formats empty source and test lists", () => {
  const output = formatStartupPrompt({
    task: "fix unclear issue",
    mode: "Compact",
    riskLevel: "unknown",
    readFirstDocs: [],
    likelySourceFiles: [],
    likelyTests: [],
    relevantSymbols: [],
    startupInstructions: [],
    reasons: []
  });

  assert.match(output, /Read first:\n- none\n\nLikely source files:\n- none\n\nLikely tests:\n- none/);
  assert.match(output, /Instructions:\n- none\n$/);
});

test("suggest text output remains compatible", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-suggest-compat-"));

  try {
    const result = runCli(["suggest", "fix unit test failure"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, [
      "repo-context-center suggestion",
      "",
      "Task: fix unit test failure",
      "Mode: Compact",
      "Risk: unknown",
      "",
      "Context files:",
      "  - none",
      "",
      "Likely source files:",
      "  - none",
      "",
      "Likely tests:",
      "  - none",
      "",
      "Reasons:",
      "  - insufficient repo signal for risk confidence",
      "  - test-related task triggered test discovery",
      ""
    ].join("\n"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
