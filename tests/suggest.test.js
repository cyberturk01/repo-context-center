const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
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

async function withContextRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-suggest-"));
  const contextDir = path.join(tempDir, "docs", "ai-context");

  try {
    await mkdir(contextDir, { recursive: true });
    await writeFile(
      path.join(contextDir, "TASK_ROUTING.md"),
      [
        "# Task Routing",
        "",
        "- UI work: read `src/ui`, `tests/ui.test.ts`, and `docs/ai-context/MODULE_INDEX.md`.",
        "- Auth or security work: read `src/auth`, `tests/auth.test.ts`, and `docs/ai-context/RISK_REGISTER.md`."
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(contextDir, "MODULE_INDEX.md"),
      [
        "# Module Index",
        "",
        "| Path | Owns | Read When |",
        "| --- | --- | --- |",
        "| `src/ui` | UI module | UI, design, button, layout work |",
        "| `src/auth` | Auth module | auth, login, consent, security work |"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(contextDir, "DEPENDENCY_MAP.md"),
      [
        "# Dependency Map",
        "",
        "| From | Depends On | Why It Matters |",
        "| --- | --- | --- |",
        "| `src/auth` | `src/db`, `src/session` | Security and consent flows persist state |"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(contextDir, "RISK_REGISTER.md"),
      [
        "# Risk Register",
        "",
        "| Area | Risk | Check |",
        "| --- | --- | --- |",
        "| `src/auth` | Security regressions expose accounts | Run `tests/auth.test.ts` |"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(contextDir, "HOTSPOTS.md"),
      [
        "# Hotspots",
        "",
        "| Hotspot | Why | Safer Move |",
        "| --- | --- | --- |",
        "| `src/auth/session.ts` | Session state is easy to regress | Add auth tests |"
      ].join("\n"),
      "utf8"
    );

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("suggest uses compact mode for simple UI task", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "adjust UI button spacing", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(suggestion.mode, "Compact");
    assert.equal(suggestion.riskLevel, "low");
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/TASK_ROUTING.md"));
  });
});

test("suggest uses investigation mode for security task", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "fix security issue in auth consent", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(suggestion.mode, "Investigation");
    assert.equal(suggestion.riskLevel, "high");
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/RISK_REGISTER.md"));
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/HOTSPOTS.md"));
  });
});

test("suggest returns likely files from task routing", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "UI layout update", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(suggestion.likelySourceFiles.includes("src/ui"));
    assert.ok(suggestion.likelyTests.includes("tests/ui.test.ts"));
  });
});

test("suggest includes dependency map when module has dependencies", async () => {
  await withContextRepo(async (tempDir) => {
    const result = runCli(["suggest", "auth login change", "--json"], { cwd: tempDir });
    const suggestion = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(suggestion.contextFiles.includes("docs/ai-context/DEPENDENCY_MAP.md"));
    assert.ok(suggestion.likelySourceFiles.includes("src/db"));
    assert.ok(suggestion.likelySourceFiles.includes("src/session"));
  });
});
