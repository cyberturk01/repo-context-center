const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const { formatStartupPrompt } = require("../dist/core/startPrompt.js");
const { startCommand } = require("../dist/cli/commands/start.js");

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

async function readFixtureFiles(root, relativePaths) {
  const contents = {};

  for (const relativePath of relativePaths) {
    contents[relativePath] = await readFile(path.join(root, relativePath), "utf8");
  }

  return contents;
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

test("start default output is unchanged when --copy is omitted", async () => {
  await withStartRepo(async (tempDir) => {
    const defaultResult = runCli(["start", "fix auth bug"], { cwd: tempDir });
    const withMaxFilesResult = runCli(["start", "fix auth bug", "--max-files", "50"], { cwd: tempDir });

    assert.equal(defaultResult.status, 0);
    assert.equal(defaultResult.stderr, "");
    assert.equal(defaultResult.stdout, withMaxFilesResult.stdout);
  });
});

test("start does not rewrite agent context files", async () => {
  await withStartRepo(async (tempDir) => {
    const contextFiles = [
      "AGENTS.md",
      "docs/ai-context/TASK_ROUTING.md",
      "docs/ai-context/MODULE_INDEX.md",
      "docs/ai-context/RISK_REGISTER.md",
      "docs/ai-context/HOTSPOTS.md"
    ];
    const before = await readFixtureFiles(tempDir, contextFiles);

    const result = runCli(["start", "fix auth bug"], { cwd: tempDir });
    const after = await readFixtureFiles(tempDir, contextFiles);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(after, before);
  });
});

test("start --copy is accepted and reports copy success", async () => {
  await withStartRepo(async (tempDir) => {
    let copiedContent = "";
    let stdout = "";
    let stderr = "";
    const exitCode = await startCommand(
      {
        cwd: tempDir,
        stdout: (message) => {
          stdout += message;
        },
        stderr: (message) => {
          stderr += message;
        }
      },
      ["fix auth bug", "--copy"],
      {
        copyToClipboard: (content) => {
          copiedContent = content;
          return true;
        }
      }
    );

    assert.equal(exitCode, 0);
    assert.match(stdout, /^Before starting this task, use Repository Context Center\./);
    assert.equal(copiedContent, stdout);
    assert.equal(stderr, "Copied startup context to clipboard.\n");
  });
});

test("start --copy failure warns without failing command", async () => {
  await withStartRepo(async (tempDir) => {
    let stdout = "";
    let stderr = "";
    const exitCode = await startCommand(
      {
        cwd: tempDir,
        stdout: (message) => {
          stdout += message;
        },
        stderr: (message) => {
          stderr += message;
        }
      },
      ["fix auth bug", "--copy"],
      {
        copyToClipboard: () => false
      }
    );

    assert.equal(exitCode, 0);
    assert.match(stdout, /^Before starting this task, use Repository Context Center\./);
    assert.equal(stderr, "Could not copy to clipboard; startup context was printed above.\n");
  });
});

test("start includes high-risk guidance for auth bugs", async () => {
  await withStartRepo(async (tempDir) => {
    const result = runCli(["start", "fix auth bug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Risk:\nhigh/);
    assert.match(result.stdout, /Treat this as high risk/);
    assert.match(result.stdout, /Likely source files:\n(?:- .+\n)*- src\/auth\/login\.ts/);
    assert.match(result.stdout, /Reasons:\n  - matched task token: auth/);
    assert.doesNotMatch(result.stdout, /score/i);
  });
});

test("start includes workflow-aware guidance for GitHub Actions tasks", async () => {
  await withStartRepo(async (tempDir) => {
    const result = runCli(["start", "update github actions workflow"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Likely source files:\n- \.github\/workflows\/ci\.yml/);
    assert.match(result.stdout, /- \.github\/workflows\/ci\.yml/);
    assert.match(result.stdout, /- \.github\/workflows\/release\.yml/);
    assert.ok(result.stdout.indexOf("- .github/workflows/ci.yml") < result.stdout.indexOf("- package.json"));
    assert.ok(result.stdout.indexOf("- .github/workflows/release.yml") < result.stdout.indexOf("- package.json"));
    assert.match(result.stdout, /Reasons:\n  - matched parent folder: github\n  - workflow task match/);
    assert.match(result.stdout, /For workflow or deployment changes/);
  });
});

test("start explains missing workflow files instead of recommending package.json", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-start-no-workflows-"));

  try {
    await writeFixtureFile(tempDir, "package.json", "{\"scripts\":{\"ci\":\"npm test\"}}\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Workflow work: read `package.json` for scripts."
      ].join("\n")
    );

    const result = runCli(["start", "update github actions workflow"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(
      result.stdout,
      /Likely source files:\n- none\nNo source file reason:\n- workflow task detected, but no \.github\/workflows\/\*\.yml or \.yaml files were found\./
    );
    assert.doesNotMatch(result.stdout, /Likely source files:\n(?:- .+\n)*- package\.json/);
    assert.doesNotMatch(result.stdout, /- package\.json\n  Reasons:\n  - workflow task match/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("start explains empty file recommendations when context guidance matched", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-start-empty-reasons-"));

  try {
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Auth work: read `src/auth` and `tests/auth/login.test.ts`."
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
        "| `src/auth` | Auth module | auth work |"
      ].join("\n")
    );

    const result = runCli(["start", "fix auth bug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Likely source files:\n- none\nNo source file reason: task tokens matched context guidance but no matching source file was found\./);
    assert.match(result.stdout, /Likely tests:\n- none\nNo test reason: no matching or paired test file was found\./);
    assert.doesNotMatch(result.stdout, /score/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("start includes generic fallback reason for unit test failures without source signal", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-start-test-fallback-"));

  try {
    await writeFixtureFile(tempDir, "tests/example.test.js", "test('example', () => {});\n");

    const result = runCli(["start", "fix unit test failure"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Likely source files:\n- none/);
    assert.match(result.stdout, /Likely tests:\n- tests\/example\.test\.js\n  Reasons:\n  - generic test-task fallback/);
    assert.doesNotMatch(result.stdout, /score/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("start caps generic test fallback by default but respects explicit max files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-start-test-cap-"));

  try {
    for (const name of ["a", "b", "c", "d", "e", "f", "g"]) {
      await writeFixtureFile(tempDir, `tests/${name}.test.js`, `test('${name}', () => {});\n`);
    }

    const defaultResult = runCli(["start", "fix unit test failure"], { cwd: tempDir });
    const explicitResult = runCli(["start", "fix unit test failure", "--max-files", "7"], { cwd: tempDir });

    assert.equal(defaultResult.status, 0);
    assert.match(defaultResult.stdout, /- tests\/a\.test\.js/);
    assert.match(defaultResult.stdout, /- tests\/e\.test\.js/);
    assert.doesNotMatch(defaultResult.stdout, /- tests\/f\.test\.js/);
    assert.equal((defaultResult.stdout.match(/generic test-task fallback/g) ?? []).length, 5);

    assert.equal(explicitResult.status, 0);
    assert.match(explicitResult.stdout, /- tests\/g\.test\.js/);
    assert.equal((explicitResult.stdout.match(/generic test-task fallback/g) ?? []).length, 7);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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
    recommendationReasons: {},
    emptyRecommendationReasons: {},
    reasons: []
  });

  assert.match(output, /Read first:\n- none\n\nLikely source files:\n- none\n\nLikely tests:\n- none/);
  assert.match(output, /Instructions:\n- none\n$/);
});

test("startup prompt formats compact file reasons", () => {
  const output = formatStartupPrompt({
    task: "fix auth bug",
    mode: "Investigation",
    riskLevel: "high",
    readFirstDocs: ["AGENTS.md"],
    likelySourceFiles: ["src/auth/login.ts"],
    likelyTests: ["tests/auth/login.test.ts"],
    relevantSymbols: [],
    startupInstructions: ["Read AGENTS.md first for repo-specific agent guidance."],
    recommendationReasons: {
      "src/auth/login.ts": ["matched task token: auth", "matched filename stem: login"],
      "tests/auth/login.test.ts": ["paired with source file: src/auth/login.ts", "matched parent folder: auth"]
    },
    emptyRecommendationReasons: {},
    reasons: []
  });

  assert.match(output, /Likely source files:\n- src\/auth\/login\.ts\n  Reasons:\n  - matched task token: auth\n  - matched filename stem: login/);
  assert.match(output, /Likely tests:\n- tests\/auth\/login\.test\.ts\n  Reasons:\n  - paired with source file: src\/auth\/login\.ts\n  - matched parent folder: auth/);
  assert.doesNotMatch(output, /score/i);
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
