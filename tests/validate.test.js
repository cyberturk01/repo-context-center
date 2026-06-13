const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
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

async function createTempRepo() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-validate-"));
  const initResult = runCli(tempDir, ["init"]);
  assert.equal(initResult.status, 0);
  return tempDir;
}

test("validate passes on complete setup", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runCli(tempDir, ["validate"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Required files: ok/);
    assert.match(result.stdout, /Warnings: none/);
    assert.match(result.stdout, /Result: passed/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("validate fails on missing required file", async () => {
  const tempDir = await createTempRepo();

  try {
    await rm(path.join(tempDir, "docs", "ai-context", "PROJECT_MAP.md"));
    const result = runCli(tempDir, ["validate"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing required files: 1/);
    assert.match(result.stderr, /docs\/ai-context\/PROJECT_MAP\.md/);
    assert.match(result.stderr, /Result: failed/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("validate warns on oversized context file", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeFile(
      path.join(tempDir, "docs", "ai-context", "CHANGE_LOG.md"),
      `${"large\n".repeat(6000)}`,
      "utf8"
    );

    const result = runCli(tempDir, ["validate"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Warnings: 1/);
    assert.match(result.stdout, /CHANGE_LOG\.md: Context file is large/);
    assert.match(result.stdout, /Result: passed/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("validate strict mode fails on warnings", async () => {
  const tempDir = await createTempRepo();

  try {
    await rm(path.join(tempDir, "docs", "ai-context", "archive"), {
      recursive: true,
      force: true
    });

    const result = runCli(tempDir, ["validate", "--strict"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Warnings: 1/);
    assert.match(result.stderr, /docs\/ai-context\/archive: Archive directory is missing/);
    assert.match(result.stderr, /Result: failed in strict mode/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("validate warns when archive directory is missing", async () => {
  const tempDir = await createTempRepo();

  try {
    await rm(path.join(tempDir, "docs", "ai-context", "archive"), {
      recursive: true,
      force: true
    });

    const result = runCli(tempDir, ["validate"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /docs\/ai-context\/archive: Archive directory is missing/);
    assert.match(result.stdout, /Result: passed/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("validate warns when config metadata is missing", async () => {
  const tempDir = await createTempRepo();

  try {
    await rm(path.join(tempDir, ".repo-context-center", "config.json"), {
      force: true
    });

    const result = runCli(tempDir, ["validate"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Warnings: 1/);
    assert.match(result.stdout, /\.repo-context-center\/config\.json: Config file is missing/);
    assert.match(result.stdout, /Result: passed/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("validate strict mode fails when config metadata is missing", async () => {
  const tempDir = await createTempRepo();

  try {
    await rm(path.join(tempDir, ".repo-context-center", "config.json"), {
      force: true
    });

    const result = runCli(tempDir, ["validate", "--strict"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Warnings: 1/);
    assert.match(result.stderr, /\.repo-context-center\/config\.json: Config file is missing/);
    assert.match(result.stderr, /Result: failed in strict mode/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("validate warns when Compact Mode is missing", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeFile(
      path.join(tempDir, "docs", "ai-context", "TOKEN_BUDGET.md"),
      "# Token Budget\n\nInvestigation Mode:\n- Read more when needed.\n",
      "utf8"
    );

    const result = runCli(tempDir, ["validate"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /TOKEN_BUDGET\.md: Compact Mode is not defined/);
    assert.match(result.stdout, /Result: passed/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("validate warns when Investigation Mode is missing", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeFile(
      path.join(tempDir, "docs", "ai-context", "TOKEN_BUDGET.md"),
      "# Token Budget\n\nCompact Mode:\n- Keep context small.\n",
      "utf8"
    );

    const result = runCli(tempDir, ["validate"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /TOKEN_BUDGET\.md: Investigation Mode is not defined/);
    assert.match(result.stdout, /Result: passed/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("validate warns when generated folder exclusions are missing", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeFile(
      path.join(tempDir, "docs", "ai-context", "DO_NOT_READ.md"),
      "# Do Not Read\n\n- `node_modules/`\n",
      "utf8"
    );

    const result = runCli(tempDir, ["validate"]);

    assert.equal(result.status, 0);
    assert.match(
      result.stdout,
      /DO_NOT_READ\.md: Missing generated folder exclusions: dist, build, coverage, archive/
    );
    assert.match(result.stdout, /Result: passed/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("validate warns when AGENTS does not reference DO_NOT_READ", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeFile(
      path.join(tempDir, "AGENTS.md"),
      "# AGENTS.md\n\nRead task routing before editing.\n",
      "utf8"
    );

    const result = runCli(tempDir, ["validate"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /AGENTS\.md: Does not mention docs\/ai-context\/DO_NOT_READ\.md/);
    assert.match(result.stdout, /Result: passed/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
