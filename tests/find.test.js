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

async function writeFixtureFile(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withFindRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-find-"));

  try {
    await writeFixtureFile(tempDir, "package.json", "{\"name\":\"fixture\"}\n");
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- CLI command work: start with `src/cli/index.ts` and `src/cli/commands`.",
        "- Manual changelog entries: use `src/cli/commands/log.ts` and `docs/ai-context/CHANGE_LOG.md`."
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
        "| `src/cli` | CLI command registration and command handlers | command, option, stdout, stderr work |",
        "| `src/core` | Core repository understanding and ranking | scanner, ranking, context guidance work |"
      ].join("\n")
    );
    await writeFixtureFile(tempDir, "docs/ai-context/CHANGE_LOG.md", "# Change Log\n");
    await writeFixtureFile(tempDir, "src/cli/index.ts", "export const commands = {};\n");
    await writeFixtureFile(tempDir, "src/cli/commands/decision.ts", "export async function decisionCommand() {}\n");
    await writeFixtureFile(tempDir, "src/cli/commands/log.ts", "export async function logCommand() {}\n");
    await writeFixtureFile(tempDir, "src/cli/commands/map.ts", "export async function mapCommand() {}\n");
    await writeFixtureFile(tempDir, "src/cli/commands/start.ts", "export async function startCommand() {}\n");
    await writeFixtureFile(tempDir, "src/core/suggester.ts", "export function rankFiles() {}\n");
    await writeFixtureFile(tempDir, "tests/decision.test.js", "test('decision', () => {});\n");
    await writeFixtureFile(tempDir, "tests/cli.test.js", "test('cli', () => {});\n");
    await writeFixtureFile(tempDir, "tests/log.test.js", "test('log', () => {});\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function candidateLines(stdout) {
  return stdout.split(/\r?\n/).filter((line) => line.startsWith("- "));
}

test("find decision command returns CLI command-related files with reasons", async () => {
  await withFindRepo(async (tempDir) => {
    const result = runCli(["find", "decision command"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /src\/cli\/commands\/decision\.ts/);
    assert.match(result.stdout, /src\/cli\/index\.ts/);
    assert.match(result.stdout, /Reasons:/);
    assert.doesNotMatch(result.stdout, /score/i);
  });
});

test("find locates where CLI commands are registered", async () => {
  await withFindRepo(async (tempDir) => {
    const result = runCli(["find", "where cli commands are registered"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /src\/cli\/index\.ts/);
    assert.match(result.stdout, /known CLI command registry/);
  });
});

test("find manual changelog entries returns log command or changelog context", async () => {
  await withFindRepo(async (tempDir) => {
    const result = runCli(["find", "manual changelog entries"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /src\/cli\/commands\/log\.ts|docs\/ai-context\/CHANGE_LOG\.md/);
    assert.match(result.stdout, /similar command file: log-style durable entry|changelog context file/);
  });
});

test("find caps results with --limit", async () => {
  await withFindRepo(async (tempDir) => {
    const result = runCli(["find", "command", "--limit", "2"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.ok(candidateLines(result.stdout).length <= 2);
  });
});

test("find prints a helpful message when no focused match is found", async () => {
  await withFindRepo(async (tempDir) => {
    const before = await readFile(path.join(tempDir, "package.json"), "utf8");
    const result = runCli(["find", "zzzz unmatched concept"], { cwd: tempDir });
    const after = await readFile(path.join(tempDir, "package.json"), "utf8");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "No focused matches found. Try a more specific query.\n");
    assert.equal(after, before);
  });
});
