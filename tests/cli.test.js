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

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function writeLocalRccPackage(root, version) {
  await writeJson(path.join(root, "node_modules", "repo-context-center", "package.json"), {
    name: "repo-context-center",
    version
  });
}

test("CLI help prints usage", () => {
  const result = runCli(["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /repo-context-center <command>/);
  assert.match(result.stdout, /work\s+Print a concise work brief for an AI coding agent/);
  assert.match(result.stdout, /Usage: work "<task>"/);
  assert.match(result.stdout, /done\s+Save lightweight memory after completed agent work/);
  assert.match(result.stdout, /Usage: done --summary "<summary>" \[--files auto\|none\|"<path,path>"\] \[--verify "<command\/result>"\] \[--dry-run\]/);
  assert.match(result.stdout, /init\s+Install generic context templates and config/);
  assert.match(result.stdout, /Options: --update, --dry-run, --force/);
  assert.match(result.stdout, /validate\s+Validate required context files and warnings/);
  assert.match(result.stdout, /Options: --strict/);
  assert.match(result.stdout, /archive\s+Archive older CHANGE_LOG and LESSONS_LEARNED entries/);
  assert.match(result.stdout, /Options: --keep <number>, --dry-run/);
  assert.match(result.stdout, /decision\s+Add a durable project decision to docs\/ai-context\/DECISIONS\.md/);
  assert.match(result.stdout, /Usage: decision add "<decision>" --reason "<reason>" \[--status <status>\] \[--files <path,path>\]/);
  assert.match(result.stdout, /decision list/);
  assert.match(result.stdout, /decision search "<query>"/);
  assert.match(result.stdout, /doctor\s+Check local development CLI\/version alignment/);
  assert.match(result.stdout, /find\s+Find focused file candidates for a concept or query/);
  assert.match(result.stdout, /Usage: find "<query>" \[--limit <number>\]/);
  assert.match(result.stdout, /learn\s+Regenerate repository learning on demand/);
  assert.match(result.stdout, /Usage: learn \[--json\] \[--write\] \[--debug\]/);
  assert.match(result.stdout, /log\s+Add a durable entry to docs\/ai-context\/CHANGE_LOG\.md/);
  assert.match(result.stdout, /Usage: log "<summary>" \[--files <path,path>\] \[--dry-run\]/);
  assert.match(result.stdout, /Options: --write, --check, --json, --dry-run, --max-files <number>, --repo <path>/);
  assert.match(result.stdout, /measure\s+Estimate RCC token savings for a task/);
  assert.match(result.stdout, /Usage: rcc measure "<task>"/);
  assert.match(result.stdout, /rcc measure "<task>" --json/);
  assert.match(result.stdout, /start\s+Print a startup prompt for an AI coding agent/);
  assert.match(result.stdout, /Usage: start "<task>" \[--max-files <number>\] \[--copy\]/);
  assert.match(result.stdout, /--version\s+Show version/);
});

test("CLI --version prints running package version", () => {
  const result = runCli(["--version"]);
  const packageJson = require(path.join(repoRoot, "package.json"));

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, `${packageJson.version}\n`);
});

test("doctor reports matching local development version without warning", () => {
  const result = runCli(["doctor"]);
  const packageJson = require(path.join(repoRoot, "package.json"));

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /repo-context-center doctor/);
  assert.match(result.stdout, new RegExp(`Running CLI version: ${packageJson.version}`));
  assert.match(result.stdout, new RegExp(`Repo package version: ${packageJson.version}`));
  assert.match(result.stdout, /Package dependency version: not declared/);
  assert.match(result.stdout, /Nearest local install version: (?:unknown|\d+\.\d+\.\d+)/);
  assert.match(result.stdout, /Supports work --agent: yes/);
  assert.match(result.stdout, /Execution path: /);
  assert.match(result.stdout, /Local package and active CLI are aligned\./);
  assert.doesNotMatch(result.stdout, /Warning: running global RCC version/);
});

test("doctor reports aligned local package and active CLI", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-aligned-"));
  const packageJson = require(path.join(repoRoot, "package.json"));

  try {
    await writeJson(path.join(tempDir, "package.json"), {
      name: "app",
      version: "1.0.0",
      dependencies: {
        "repo-context-center": packageJson.version
      }
    });
    await writeLocalRccPackage(tempDir, packageJson.version);

    const result = runCli(["doctor"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, new RegExp(`Running CLI version: ${packageJson.version}`));
    assert.match(result.stdout, new RegExp(`Package dependency version: ${packageJson.version}`));
    assert.match(result.stdout, new RegExp(`Nearest local install version: ${packageJson.version}`));
    assert.match(result.stdout, /Supports work --agent: yes/);
    assert.match(result.stdout, /Local package and active CLI are aligned\./);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("doctor warns when a repo-context-center repo version differs from the running CLI outside that repo", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-mismatch-"));
  const packageJson = require(path.join(repoRoot, "package.json"));

  try {
    await writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "repo-context-center", version: "9.9.9" }, null, 2),
      "utf8"
    );

    const result = runCli(["doctor"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(
      result.stdout,
      new RegExp(`Warning: running global RCC version ${packageJson.version} while repo package version is 9\\.9\\.9\\. Use node dist/cli/index\\.js during local development\\.`)
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("doctor warns when package dependency is newer than active CLI", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-dep-newer-"));

  try {
    await writeJson(path.join(tempDir, "package.json"), {
      name: "app",
      version: "1.0.0",
      dependencies: {
        "repo-context-center": "^99.0.0"
      }
    });

    const result = runCli(["doctor"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Package dependency version: \^99\.0\.0/);
    assert.match(result.stdout, /Nearest local install version: unknown/);
    assert.match(result.stdout, /Detected package dependency repo-context-center@\^99\.0\.0 but active rcc command appears older\./);
    assert.match(result.stdout, /Try: npx repo-context-center@99\.0\.0 work "<task>" --agent/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("doctor warns when local install is newer than active CLI", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-local-newer-"));

  try {
    await writeJson(path.join(tempDir, "package.json"), {
      name: "app",
      version: "1.0.0"
    });
    await writeLocalRccPackage(tempDir, "99.0.0");

    const result = runCli(["doctor"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Nearest local install version: 99\.0\.0/);
    assert.match(result.stdout, /Detected local repo-context-center@99\.0\.0 but active rcc command appears older\./);
    assert.match(result.stdout, /Try: npx repo-context-center@99\.0\.0 work "<task>" --agent/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("doctor reports missing local dependency install", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-missing-local-"));
  const packageJson = require(path.join(repoRoot, "package.json"));

  try {
    await writeJson(path.join(tempDir, "package.json"), {
      name: "app",
      version: "1.0.0",
      devDependencies: {
        "repo-context-center": packageJson.version
      }
    });

    const result = runCli(["doctor"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, new RegExp(`Package dependency version: ${packageJson.version}`));
    assert.match(result.stdout, /Nearest local install version: unknown/);
    assert.match(result.stdout, new RegExp(`Package declares repo-context-center@${packageJson.version}, but no local node_modules install was found\\.`));
    assert.match(result.stdout, /Run your package manager install command, or use npx with the declared version\./);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("doctor output stays compact and human-readable", () => {
  const result = runCli(["doctor"]);
  const lines = result.stdout.trim().split("\n");

  assert.equal(result.status, 0);
  assert.ok(lines.length <= 12, `doctor output has ${lines.length} lines`);
  assert.doesNotMatch(result.stdout, /^[{\[]/);
  assert.doesNotMatch(result.stdout, /undefined|null/);
});

test("doctor does not warn noisily outside a repo-context-center repo", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-other-"));

  try {
    await writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "not-rcc", version: "9.9.9" }, null, 2),
      "utf8"
    );

    const result = runCli(["doctor"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Repo package version: not repo-context-center/);
    assert.match(result.stdout, /Local package and active CLI are aligned\./);
    assert.doesNotMatch(result.stdout, /Warning: running global RCC version/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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

test("rcc decision dispatch records a durable decision", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-cli-decision-"));

  try {
    const result = runCli([
      "decision",
      "add",
      "Keep CLI decision command covered",
      "--reason",
      "Prevent command dispatch regressions",
      "--files",
      "tests/cli.test.js"
    ], { cwd: tempDir });
    const decisions = await readFile(path.join(tempDir, "docs", "ai-context", "DECISIONS.md"), "utf8");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "Updated docs/ai-context/DECISIONS.md\n");
    assert.match(
      decisions,
      /\| \d{4}-\d{2}-\d{2} \| Keep CLI decision command covered \| Prevent command dispatch regressions \| Active \| tests\/cli\.test\.js \|/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
