const assert = require("node:assert/strict");
const { chmod, mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env
  });
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function writeText(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withMetricsRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-cli-metrics-"));

  try {
    await writeText(tempDir, "AGENTS.md", "Fixture repo guidance.\n");
    await writeText(
      tempDir,
      "docs/ai-context/TASK_ROUTING.md",
      [
        "# Task Routing",
        "",
        "- Auth or login work: read `src/auth/login.ts` and `tests/auth/login.test.ts`."
      ].join("\n")
    );
    await writeText(
      tempDir,
      "docs/ai-context/MODULE_INDEX.md",
      [
        "# Module Index",
        "",
        "| Path | Owns | Read When |",
        "| --- | --- | --- |",
        "| `src/auth/login.ts` | Auth login | login work |"
      ].join("\n")
    );
    await writeText(tempDir, "docs/ai-context/DO_NOT_READ.md", "- `node_modules/`\n- `dist/`\n");
    await writeText(tempDir, "src/auth/login.ts", "export function login() { return true; }\n");
    await writeText(tempDir, "tests/auth/login.test.ts", "test('login', () => {});\n");
    await writeText(tempDir, "README.md", "# Fixture\n");

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeLocalRccPackage(root, version) {
  await writeJson(path.join(root, "node_modules", "repo-context-center", "package.json"), {
    name: "repo-context-center",
    version
  });
}

async function writeFakeCommand(root, name, { version = "0.11.0", supportsAgent = true } = {}) {
  const commandPath = path.join(root, name);
  const script = supportsAgent
    ? [
      "#!/usr/bin/env node",
      "const args = process.argv.slice(2);",
      "if (args[0] === '--version') { console.log(JSON.stringify(process.env.FAKE_RCC_VERSION).slice(1, -1)); process.exit(0); }",
      "if (args[0] === 'work' && args.includes('--agent')) { console.log(JSON.stringify({ task: args[1], mode: 'agent', briefTokens: 1, primaryFiles: [], supportingFiles: [], tests: [] })); process.exit(0); }",
      "console.error('Usage: rcc work \"<task>\"');",
      "process.exit(1);",
      ""
    ].join("\n")
    : [
      "#!/usr/bin/env node",
      "const args = process.argv.slice(2);",
      "if (args[0] === '--version') { console.log(JSON.stringify(process.env.FAKE_RCC_VERSION).slice(1, -1)); process.exit(0); }",
      "console.error('Usage: rcc work \"<task>\"');",
      "process.exit(1);",
      ""
    ].join("\n");

  await writeFile(commandPath, script, "utf8");
  await chmod(commandPath, 0o755);
  return {
    commandPath,
    env: {
      ...process.env,
      PATH: `${root}${path.delimiter}${process.env.PATH ?? ""}`,
      FAKE_RCC_VERSION: version
    }
  };
}

test("CLI help prints usage", () => {
  const result = runCli(["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /repo-context-center <command>/);
  assert.match(result.stdout, /work\s+Print a concise work brief for an AI coding agent/);
  assert.match(result.stdout, /Usage: work "<task>"/);
  assert.match(result.stdout, /done\s+Save lightweight memory after completed agent work/);
  assert.match(result.stdout, /Usage: done --summary "<summary>" \[--files auto\|none\|"<path,path>"\] \[--verify "<command\/result>"\] \[--learn\|--no-learn\] \[--memory-only\] \[--dry-run\]/);
  assert.match(result.stdout, /init\s+Install generic context templates and config/);
  assert.match(result.stdout, /Options: --update, --dry-run, --force/);
  assert.match(result.stdout, /validate\s+Validate required context files and warnings/);
  assert.match(result.stdout, /Options: --strict/);
  assert.match(result.stdout, /verify\s+Recommend verification checks from impact analysis/);
  assert.match(result.stdout, /Usage: verify "<task>" \[--json\] \[--task-only\] \[--planned\]/);
  assert.match(result.stdout, /archive\s+Archive older CHANGE_LOG and LESSONS_LEARNED entries/);
  assert.match(result.stdout, /Options: --keep <number>, --dry-run/);
  assert.match(result.stdout, /decision\s+Add a durable project decision to docs\/ai-context\/DECISIONS\.md/);
  assert.match(result.stdout, /Usage: decision add "<decision>" --reason "<reason>" \[--status <status>\] \[--files <path,path>\]/);
  assert.match(result.stdout, /decision list/);
  assert.match(result.stdout, /decision search "<query>"/);
  assert.match(result.stdout, /doctor\s+Check local development CLI\/version alignment/);
  assert.match(result.stdout, /find\s+Find focused file candidates for a concept or query/);
  assert.match(result.stdout, /Usage: find "<query>" \[--limit <number>\]/);
  assert.match(result.stdout, /impact\s+Estimate affected files, tests, and commands/);
  assert.match(result.stdout, /Usage: impact "<task>" \[--json\] \[--task-only\] \[--max-files <number>\]/);
  assert.match(result.stdout, /learn\s+Regenerate repository learning on demand/);
  assert.match(result.stdout, /Usage: learn \[--json\] \[--write\] \[--debug\]/);
  assert.match(result.stdout, /log\s+Add a durable entry to docs\/ai-context\/CHANGE_LOG\.md/);
  assert.match(result.stdout, /Usage: log "<summary>" \[--files <path,path>\] \[--dry-run\]/);
  assert.match(result.stdout, /Options: --write, --check, --json, --dry-run, --max-files <number>, --repo <path>/);
  assert.match(result.stdout, /estimate\s+Estimate installed context costs and naive comparisons/);
  assert.match(result.stdout, /measure\s+Task-first route-vs-naive token estimate/);
  assert.match(result.stdout, /Usage: rcc measure "<task>"/);
  assert.match(result.stdout, /rcc measure "<task>" --json/);
  assert.match(result.stdout, /metrics\s+Summarize repository intelligence metrics for a task/);
  assert.match(result.stdout, /Usage: rcc metrics "<task>" \[--json\]/);
  assert.match(result.stdout, /start\s+Print a startup prompt for an AI coding agent/);
  assert.match(result.stdout, /Usage: start "<task>" \[--max-files <number>\] \[--copy\]/);
  assert.match(result.stdout, /--version\s+Show version/);
});

test("metrics requires a task", () => {
  const result = runCli(["metrics"]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, 'Usage: rcc metrics "<task>" [--json]\n');
});

test("metrics prints human-readable repository metric sections", async () => {
  await withMetricsRepo(async (tempDir) => {
    const result = runCli(["metrics", "fix login bug"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^repo-context-center metrics\n/);
    assert.match(result.stdout, /Task: fix login bug/);
    assert.match(result.stdout, /Routing:\n- Task size:/);
    assert.match(result.stdout, /Token savings:\n- Naive tokens:/);
    assert.match(result.stdout, /Freshness:\n- Status:/);
    assert.match(result.stdout, /Impact:\n- Mode:/);
    assert.match(result.stdout, /Verification:\n- Mode:/);
  });
});

test("metrics --json returns parseable metrics output", async () => {
  await withMetricsRepo(async (tempDir) => {
    const result = runCli(["metrics", "fix login bug", "--json"], { cwd: tempDir });
    const metrics = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(metrics.schemaVersion, 1);
    assert.equal(metrics.command, "metrics");
    assert.equal(metrics.task, "fix login bug");
    assert.ok("routing" in metrics);
    assert.ok("tokens" in metrics);
    assert.ok("freshness" in metrics);
    assert.ok("impact" in metrics);
    assert.ok("verification" in metrics);
    assert.equal(result.stdout, `${JSON.stringify(metrics, null, 2)}\n`);
  });
});

test("CLI --version prints running package version", () => {
  const result = runCli(["--version"]);
  const packageJson = require(path.join(repoRoot, "package.json"));

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, `${packageJson.version}\n`);
});

test("doctor reports matching active CLI and shell command capabilities", async () => {
  const packageJson = require(path.join(repoRoot, "package.json"));
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-active-"));
  const binDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-bin-"));

  try {
    await writeJson(path.join(tempDir, "package.json"), {
      name: "repo-context-center",
      version: packageJson.version
    });
    const fake = await writeFakeCommand(binDir, "rcc", { version: packageJson.version, supportsAgent: true });
    await writeFakeCommand(binDir, "repo-context-center", { version: packageJson.version, supportsAgent: true });

    const result = runCli(["doctor"], { cwd: tempDir, env: fake.env });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /repo-context-center doctor/);
    assert.match(result.stdout, new RegExp(`Running CLI version: ${packageJson.version}`));
    assert.match(result.stdout, /Running CLI supports work --agent: yes/);
    assert.match(result.stdout, new RegExp(`Repo package version: ${packageJson.version}`));
    assert.match(result.stdout, /Package dependency version: not declared/);
    assert.match(result.stdout, /Nearest local install: (?:unknown|\d+\.\d+\.\d+ \(.+repo-context-center\))/);
    assert.match(result.stdout, /Execution path: /);
    assert.match(result.stdout, /rcc: ok/);
    assert.match(result.stdout, /repo-context-center: ok/);
    assert.match(result.stdout, /Shell command paths differ from the active CLI execution path; command capabilities were checked above\./);
    assert.doesNotMatch(result.stdout, /Local package and active CLI are aligned\./);
    assert.doesNotMatch(result.stdout, /Warning: running global RCC version/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    await rm(binDir, { recursive: true, force: true });
  }
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
    const binDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-bin-"));
    const fakeRcc = await writeFakeCommand(binDir, "rcc", { version: packageJson.version, supportsAgent: true });
    await writeFakeCommand(binDir, "repo-context-center", { version: packageJson.version, supportsAgent: true });

    const result = runCli(["doctor"], { cwd: tempDir, env: fakeRcc.env });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, new RegExp(`Running CLI version: ${packageJson.version}`));
    assert.match(result.stdout, new RegExp(`Package dependency version: ${packageJson.version}`));
    assert.match(result.stdout, new RegExp(`Nearest local install: ${packageJson.version} \\(.+node_modules.+repo-context-center\\)`));
    assert.match(result.stdout, /Running CLI supports work --agent: yes/);
    assert.match(result.stdout, /Shell command paths differ from the active CLI execution path; command capabilities were checked above\./);
    assert.doesNotMatch(result.stdout, /Local package and active CLI are aligned\./);
    await rm(binDir, { recursive: true, force: true });
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
    assert.match(result.stdout, /Nearest local install: unknown/);
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
    assert.match(result.stdout, /Nearest local install: 99\.0\.0 \(.+node_modules.+repo-context-center\)/);
    assert.match(result.stdout, /Detected local repo-context-center@99\.0\.0 but active rcc command appears older\./);
    assert.match(result.stdout, /Try: npx repo-context-center@99\.0\.0 work "<task>" --agent/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("doctor warns when nearest local install is older than active CLI", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-local-older-"));
  const binDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-bin-"));
  const packageJson = require(path.join(repoRoot, "package.json"));

  try {
    await writeJson(path.join(tempDir, "package.json"), {
      name: "app",
      version: "1.0.0"
    });
    await writeLocalRccPackage(tempDir, "0.0.1");
    const fakeRcc = await writeFakeCommand(binDir, "rcc", { version: packageJson.version, supportsAgent: true });
    await writeFakeCommand(binDir, "repo-context-center", { version: packageJson.version, supportsAgent: true });

    const result = runCli(["doctor"], { cwd: tempDir, env: fakeRcc.env });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Nearest local install: 0\.0\.1 \(.+node_modules.+repo-context-center\)/);
    assert.match(result.stdout, /rcc: ok/);
    assert.match(result.stdout, /repo-context-center: ok/);
    assert.match(result.stdout, /Old local install detected but active CLI is healthy: repo-context-center@0\.0\.1 is nearest local install, active CLI is \d+\.\d+\.\d+\./);
    assert.match(result.stdout, /Remove or upgrade local dependency only if this repository intends to use local RCC\./);
    assert.doesNotMatch(result.stdout, /Suggested fixes:/);
    assert.doesNotMatch(result.stdout, /npm uninstall -g repo-context-center/);
    assert.doesNotMatch(result.stdout, /npm install -g repo-context-center@latest/);
    assert.doesNotMatch(result.stdout, /Local package and active CLI are aligned\./);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    await rm(binDir, { recursive: true, force: true });
  }
});

test("doctor detects shell rcc capability mismatch even with same version", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-shell-mismatch-"));
  const binDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-bin-"));
  const packageJson = require(path.join(repoRoot, "package.json"));

  try {
    const fakeRcc = await writeFakeCommand(binDir, "rcc", { version: packageJson.version, supportsAgent: false });
    await writeFakeCommand(binDir, "repo-context-center", { version: packageJson.version, supportsAgent: true });

    const result = runCli(["doctor"], { cwd: tempDir, env: fakeRcc.env });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /rcc: capability mismatch/);
    assert.match(result.stdout, new RegExp(`Capability mismatch: command reports ${packageJson.version.replace(/\./g, "\\.")} but does not support work --agent\\.`));
    assert.doesNotMatch(result.stdout, /Local package and active CLI are aligned\./);
    assert.match(result.stdout, /npm uninstall -g repo-context-center/);
    assert.match(result.stdout, /npm install -g repo-context-center@latest/);
    assert.match(result.stdout, /hash -r/);
    assert.match(result.stdout, /Get-Command rcc/);
    assert.match(result.stdout, /which rcc/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    await rm(binDir, { recursive: true, force: true });
  }
});

test("doctor reports missing shell commands as warnings without failing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-missing-shell-"));
  const binDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-empty-bin-"));

  try {
    const result = runCli(["doctor"], {
      cwd: tempDir,
      env: {
        ...process.env,
        PATH: binDir
      }
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /rcc: missing/);
    assert.match(result.stdout, /repo-context-center: missing/);
    assert.match(result.stdout, /Command was not found on PATH\./);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    await rm(binDir, { recursive: true, force: true });
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
    assert.match(result.stdout, /Nearest local install: unknown/);
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
  assert.ok(lines.length <= 40, `doctor output has ${lines.length} lines`);
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

    const binDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-doctor-bin-"));
    const packageJson = require(path.join(repoRoot, "package.json"));
    const fakeRcc = await writeFakeCommand(binDir, "rcc", { version: packageJson.version, supportsAgent: true });
    await writeFakeCommand(binDir, "repo-context-center", { version: packageJson.version, supportsAgent: true });

    const result = runCli(["doctor"], { cwd: tempDir, env: fakeRcc.env });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Repo package version: not repo-context-center/);
    assert.match(result.stdout, /Shell command paths differ from the active CLI execution path; command capabilities were checked above\./);
    assert.doesNotMatch(result.stdout, /Local package and active CLI are aligned\./);
    assert.doesNotMatch(result.stdout, /Warning: running global RCC version/);
    await rm(binDir, { recursive: true, force: true });
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
