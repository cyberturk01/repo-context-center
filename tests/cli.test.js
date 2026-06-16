const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
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

test("CLI help prints usage", () => {
  const result = runCli(["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /repo-context-center <command>/);
  assert.match(result.stdout, /work\s+Print a concise work brief for an AI coding agent/);
  assert.match(result.stdout, /Usage: work \["<task>"\] \[--max-files <number>\]/);
  assert.match(result.stdout, /done\s+Save lightweight memory after completed agent work/);
  assert.match(result.stdout, /Usage: done --summary "<summary>" \[--tests "<command\/result>"\] \[--risk <level>\]/);
  assert.match(result.stdout, /init\s+Install generic context templates and config/);
  assert.match(result.stdout, /Options: --dry-run, --force/);
  assert.match(result.stdout, /validate\s+Validate required context files and warnings/);
  assert.match(result.stdout, /Options: --strict/);
  assert.match(result.stdout, /archive\s+Archive older CHANGE_LOG and LESSONS_LEARNED entries/);
  assert.match(result.stdout, /Options: --keep <number>, --dry-run/);
  assert.match(result.stdout, /decision\s+Add a durable project decision to docs\/ai-context\/DECISIONS\.md/);
  assert.match(result.stdout, /Usage: decision add "<decision>" --reason "<reason>" \[--status <status>\] \[--files <path,path>\]/);
  assert.match(result.stdout, /decision list/);
  assert.match(result.stdout, /decision search "<query>"/);
  assert.match(result.stdout, /find\s+Find focused file candidates for a concept or query/);
  assert.match(result.stdout, /Usage: find "<query>" \[--limit <number>\]/);
  assert.match(result.stdout, /log\s+Add a durable entry to docs\/ai-context\/CHANGE_LOG\.md/);
  assert.match(result.stdout, /Usage: log "<summary>" \[--files <path,path>\] \[--dry-run\]/);
  assert.match(result.stdout, /Options: --write, --check, --json, --dry-run, --max-files <number>, --repo <path>/);
  assert.match(result.stdout, /start\s+Print a startup prompt for an AI coding agent/);
  assert.match(result.stdout, /Usage: start "<task>" \[--max-files <number>\] \[--copy\]/);
});

test("unknown command returns an error", () => {
  const result = runCli(["nope"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command: nope/);
});

test("init dispatch creates a basic config", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-"));

  try {
    const result = runCli(["init"], { cwd: tempDir });
    const configPath = path.join(tempDir, ".repo-context-center", "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));

    assert.equal(result.status, 0);
    assert.equal(config.version, 1);
    assert.equal(config.createdBy, "repo-context-center");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
