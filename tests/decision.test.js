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

async function writeFixture(root, relativePath, content) {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withDecisionRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-decision-"));

  try {
    await writeFixture(tempDir, "package.json", "{\"name\":\"fixture\"}\n");
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeDecisions(root) {
  await writeFixture(
    root,
    "docs/ai-context/DECISIONS.md",
    [
      "# Decisions",
      "",
      "Durable project decisions preserved across AI sessions.",
      "",
      "<!-- repo-context-center:manual-decisions:start -->",
      "| Date | Decision | Reason | Status | Files |",
      "| --- | --- | --- | --- | --- |",
      "| 2026-01-01 | Keep AGENTS.md compact | Reduce startup token overhead | Active | AGENTS.md |",
      "| 2026-01-02 | Use markdown decision memory | Keep decisions reviewable in git | Proposed | src/cli/commands/decision.ts, tests/decision.test.js |",
      "<!-- repo-context-center:manual-decisions:end -->",
      ""
    ].join("\n")
  );
}

test("decision add creates DECISIONS.md with a manual decisions table", async () => {
  await withDecisionRepo(async (tempDir) => {
    const result = runCli(tempDir, [
      "decision",
      "add",
      "Keep AGENTS.md compact",
      "--reason",
      "Reduce startup token overhead",
      "--status",
      "active",
      "--files",
      "AGENTS.md"
    ]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "DECISIONS.md"), "utf8");

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "Updated docs/ai-context/DECISIONS.md\n");
    assert.match(content, /^# Decisions/);
    assert.match(content, /Durable project decisions preserved across AI sessions\./);
    assert.match(content, /<!-- repo-context-center:manual-decisions:start -->/);
    assert.match(content, /\| Date \| Decision \| Reason \| Status \| Files \|/);
    assert.match(content, /\| \d{4}-\d{2}-\d{2} \| Keep AGENTS\.md compact \| Reduce startup token overhead \| Active \| AGENTS\.md \|/);
    assert.match(content, /<!-- repo-context-center:manual-decisions:end -->/);
  });
});

test("decision add appends rows and preserves existing decisions", async () => {
  await withDecisionRepo(async (tempDir) => {
    await writeFixture(
      tempDir,
      "docs/ai-context/DECISIONS.md",
      [
        "# Decisions",
        "",
        "Durable project decisions preserved across AI sessions.",
        "",
        "<!-- repo-context-center:manual-decisions:start -->",
        "| Date | Decision | Reason | Status | Files |",
        "| --- | --- | --- | --- | --- |",
        "| 2026-01-01 | Keep CLI stable | Avoid breaking integrations | Active | src/cli/index.ts |",
        "<!-- repo-context-center:manual-decisions:end -->",
        ""
      ].join("\n")
    );

    const result = runCli(tempDir, [
      "decision",
      "add",
      "Document durable decisions",
      "--reason",
      "Preserve project intent across sessions"
    ]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "DECISIONS.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Keep CLI stable/);
    assert.match(content, /Document durable decisions/);
    assert.ok(content.indexOf("Keep CLI stable") < content.indexOf("Document durable decisions"));
    assert.ok(content.indexOf("Document durable decisions") < content.indexOf("<!-- repo-context-center:manual-decisions:end -->"));
  });
});

test("decision add requires a reason", async () => {
  await withDecisionRepo(async (tempDir) => {
    const result = runCli(tempDir, ["decision", "add", "Keep AGENTS.md compact"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: repo-context-center decision add/);
  });
});

test("decision add defaults status to active and renders files comma-separated", async () => {
  await withDecisionRepo(async (tempDir) => {
    const result = runCli(tempDir, [
      "decision",
      "add",
      "Track decision memory",
      "--reason",
      "Keep durable context",
      "--files",
      "src/cli/index.ts,src/cli/commands/decision.ts,tests/decision.test.js"
    ]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "DECISIONS.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(
      content,
      /\| \d{4}-\d{2}-\d{2} \| Track decision memory \| Keep durable context \| Active \| src\/cli\/index\.ts, src\/cli\/commands\/decision\.ts, tests\/decision\.test\.js \|/
    );
  });
});

test("decision add escapes markdown table pipes in user input", async () => {
  await withDecisionRepo(async (tempDir) => {
    const result = runCli(tempDir, [
      "decision",
      "add",
      "Use A | B choice",
      "--reason",
      "Avoid alpha | beta ambiguity",
      "--status",
      "active | reviewed",
      "--files",
      "docs/a|b.md"
    ]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "DECISIONS.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Use A \\\| B choice/);
    assert.match(content, /Avoid alpha \\\| beta ambiguity/);
    assert.match(content, /Active \\\| reviewed/);
    assert.match(content, /docs\/a\\\|b\.md/);
  });
});

test("decision add does not overwrite generated context", async () => {
  await withDecisionRepo(async (tempDir) => {
    await writeFixture(
      tempDir,
      "docs/ai-context/DECISIONS.md",
      [
        "# Decisions",
        "",
        "<!-- repo-context-center:generated:start -->",
        "Generated context stays here.",
        "<!-- repo-context-center:generated:end -->",
        ""
      ].join("\n")
    );

    const result = runCli(tempDir, [
      "decision",
      "add",
      "Keep generated context",
      "--reason",
      "Manual decisions must be additive"
    ]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "DECISIONS.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Generated context stays here\./);
    assert.match(content, /Keep generated context/);
  });
});

test("decision list shows active decisions", async () => {
  await withDecisionRepo(async (tempDir) => {
    await writeDecisions(tempDir);

    const result = runCli(tempDir, ["decision", "list"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /2026-01-01 \| Active \| Keep AGENTS\.md compact \| Reduce startup token overhead \| AGENTS\.md/);
    assert.match(result.stdout, /2026-01-02 \| Proposed \| Use markdown decision memory \| Keep decisions reviewable in git \| src\/cli\/commands\/decision\.ts, tests\/decision\.test\.js/);
    assert.equal(result.stderr, "");
  });
});

test("decision search finds by decision text", async () => {
  await withDecisionRepo(async (tempDir) => {
    await writeDecisions(tempDir);

    const result = runCli(tempDir, ["decision", "search", "markdown decision"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Use markdown decision memory/);
    assert.doesNotMatch(result.stdout, /Keep AGENTS\.md compact/);
  });
});

test("decision search finds by reason", async () => {
  await withDecisionRepo(async (tempDir) => {
    await writeDecisions(tempDir);

    const result = runCli(tempDir, ["decision", "search", "startup token"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Keep AGENTS\.md compact/);
    assert.doesNotMatch(result.stdout, /Use markdown decision memory/);
  });
});

test("decision search finds by file name", async () => {
  await withDecisionRepo(async (tempDir) => {
    await writeDecisions(tempDir);

    const result = runCli(tempDir, ["decision", "search", "decision.test.js"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Use markdown decision memory/);
    assert.doesNotMatch(result.stdout, /Keep AGENTS\.md compact/);
  });
});

test("decision list gives helpful empty state when DECISIONS.md is missing", async () => {
  await withDecisionRepo(async (tempDir) => {
    const result = runCli(tempDir, ["decision", "list"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /No decisions recorded yet/);
    assert.match(result.stdout, /repo-context-center decision add/);
  });
});

test("decision search gives helpful no-match message", async () => {
  await withDecisionRepo(async (tempDir) => {
    await writeDecisions(tempDir);

    const result = runCli(tempDir, ["decision", "search", "database"]);

    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'No decisions matched "database".\n');
  });
});

test("decision list handles malformed manual section without crashing", async () => {
  await withDecisionRepo(async (tempDir) => {
    await writeFixture(
      tempDir,
      "docs/ai-context/DECISIONS.md",
      [
        "# Decisions",
        "",
        "<!-- repo-context-center:manual-decisions:start -->",
        "| Date | Decision | Reason |",
        "| 2026-01-01 | Missing cells | Still malformed |",
        "<!-- repo-context-center:manual-decisions:end -->",
        ""
      ].join("\n")
    );

    const result = runCli(tempDir, ["decision", "list"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /No decisions recorded yet/);
    assert.equal(result.stderr, "");
  });
});
