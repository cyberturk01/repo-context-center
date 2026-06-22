const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
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

async function withTempRepo(name, fn) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), name));
  try {
    await fn(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

function workLog() {
  const entry = {
    schemaVersion: 1,
    command: "done",
    timestamp: "2026-06-20T10:00:00.000Z",
    summary: "Updated learn command",
    files: ["src/cli/commands/learn.ts", "tests/learn.test.js"],
    verification: "node --test tests/learn.test.js",
    followUps: [],
    risks: []
  };

  return [
    "# Work Log",
    "",
    "<!-- repo-context-center:work-log:start -->",
    "## 2026-06-20T10:00:00.000Z",
    "- Summary: Updated learn command",
    "- Changed files: `src/cli/commands/learn.ts`, `tests/learn.test.js`",
    "- Verification: node --test tests/learn.test.js",
    "```json repo-context-center:done",
    JSON.stringify(entry, null, 2),
    "```",
    "<!-- repo-context-center:work-log:end -->",
    ""
  ].join("\n");
}

test("learn command exists in help and dispatches", () => {
  const help = runCli(["--help"]);
  const result = runCli(["learn"]);

  assert.equal(help.status, 0);
  assert.match(help.stdout, /learn\s+Regenerate repository learning on demand/);
  assert.match(help.stdout, /Usage: learn \[--json\] \[--write\] \[--debug\]/);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Recent Focus Areas/);
});

test("learn --json prints parseable learning model only", async () => {
  await withTempRepo("repo-context-center-learn-json-", async (tempDir) => {
    await writeFixtureFile(tempDir, "docs/ai-context/WORK_LOG.md", workLog());

    const result = runCli(["learn", "--json"], { cwd: tempDir });
    const model = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(Object.keys(model), [
      "recentFocusAreas",
      "commonFileRelationships",
      "frequentlyModifiedTogether",
      "verificationPatterns",
      "repositoryHabits"
    ]);
    assert.match(model.recentFocusAreas[0], /cli|learn|general maintenance/);
    assert.doesNotMatch(result.stdout, /## Debug/);
  });
});

test("learn --write creates repository learning file", async () => {
  await withTempRepo("repo-context-center-learn-write-", async (tempDir) => {
    await writeFixtureFile(tempDir, "docs/ai-context/WORK_LOG.md", workLog());

    const result = runCli(["learn", "--write"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "REPOSITORY_LEARNING.md"), "utf8");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "Wrote docs/ai-context/REPOSITORY_LEARNING.md\n");
    assert.match(content, /^# Repository Learning$/m);
    assert.match(content, /<!-- repo-context-center:repository-learning:start -->/);
    assert.match(content, /src\/cli\/commands\/learn\.ts/);
  });
});

test("learn handles missing work logs safely", async () => {
  await withTempRepo("repo-context-center-learn-missing-", async (tempDir) => {
    const result = runCli(["learn", "--json"], { cwd: tempDir });
    const model = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(model.recentFocusAreas, []);
    assert.deepEqual(model.commonFileRelationships, []);
    assert.equal(result.stderr, "");
  });
});

test("learn --debug includes source counts and ignored entries", async () => {
  await withTempRepo("repo-context-center-learn-debug-", async (tempDir) => {
    const result = runCli(["learn", "--debug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /## Debug/);
    assert.match(result.stdout, /work log entries: 0/);
    assert.match(result.stdout, /docs\/ai-context\/WORK_LOG\.md missing/);
  });
});

test("learn command stays thin and delegates architecture concerns", async () => {
  const source = await readFile(path.join(repoRoot, "src", "cli", "commands", "learn.ts"), "utf8");
  const lines = source.trim().split(/\r?\n/);
  const imports = source.match(/^import .+$/gm) ?? [];
  const allowedImports = new Set([
    'import type { CliIO } from "../index";',
    'import { buildLearnResult } from "../learn/buildLearnResult";',
    'import { formatLearnOptionsUsage, parseLearnOptions } from "../learn/learnOptions";',
    'import { renderLearnDebug, renderLearnJson, renderLearnText } from "../learn/renderLearn";',
    'import { writeRepositoryLearning } from "../learn/writeLearn";'
  ]);

  assert.ok(lines.length <= 35, `learn command has ${lines.length} lines`);
  assert.deepEqual(imports.filter((line) => !allowedImports.has(line)), []);
  assert.doesNotMatch(source, /node:fs\/promises|node:path/);
  assert.doesNotMatch(source, /from "\.\.\/\.\.\/core\/(?:fileSystem|workMemory|repositoryLearning|renderRepositoryLearning)"/);
  assert.doesNotMatch(source, /\breadFile\b|\bwriteFile\b|\bmkdir\b|\bpathExists\b/);
  assert.doesNotMatch(source, /WORK_LOG\.md|work-log|markdown|```/i);
  assert.doesNotMatch(source, /parseWorkMemoryEntries|readRepositoryLearningSources|buildRepositoryLearningModel/);
  assert.doesNotMatch(source, /renderRepositoryLearningBody|upsertRepositoryLearning/);
  assert.match(source, /const options = parseLearnOptions\(args\);/);
  assert.match(source, /io\.stderr\(formatLearnOptionsUsage\(\)\)/);
  assert.match(source, /const result = await buildLearnResult\(io\.cwd\);/);
  assert.match(source, /const writtenPath = options\.write \? await writeRepositoryLearning\(io\.cwd, result\.model\) : null;/);
  assert.match(source, /io\.stdout\(renderLearnJson\(result\.model\)\)/);
  assert.match(source, /io\.stdout\(`Wrote \$\{writtenPath\}\\n`\)/);
  assert.match(source, /renderLearnText\(result\.model\)/);
  assert.match(source, /renderLearnDebug\(result\.debug\)/);
});
