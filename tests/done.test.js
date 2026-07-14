const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const workLogPath = path.join("docs", "ai-context", "WORK_LOG.md");
const workEventsPath = path.join("docs", "ai-context", "WORK_EVENTS.jsonl");
const workIndexPath = path.join("docs", "ai-context", "WORK_INDEX.md");
const repositoryLearningPath = path.join("docs", "ai-context", "REPOSITORY_LEARNING.md");

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

function countOccurrences(content, value) {
  return (content.match(new RegExp(value, "g")) ?? []).length;
}

async function withDoneRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-done-"));

  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("done creates memory file if missing", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli(["done", "Fixed login redirect bug"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");
    const events = await readFile(path.join(tempDir, workEventsPath), "utf8");
    const event = JSON.parse(events.trim());

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Summary: Fixed login redirect bug/);
    assert.match(result.stdout, /RCC memory updated: docs\/ai-context\/WORK_LOG\.md; docs\/ai-context\/WORK_EVENTS\.jsonl/);
    assert.doesNotMatch(result.stdout, /Warning: docs\/ai-context\/WORK_LOG\.md is about/);
    assert.match(content, /# Work Log/);
    assert.match(content, /<!-- repo-context-center:work-log:start -->/);
    assert.match(content, /- Fixed login redirect bug/);
    assert.match(content, /- files: _not detected_/);
    assert.doesNotMatch(content, /<!-- rcc:handoff/);
    assert.doesNotMatch(content, /```json repo-context-center:done/);
    assert.match(event.t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.equal(event.s, "Fixed login redirect bug");
    assert.deepEqual(event.f, []);
    assert.deepEqual(event.v, []);
    assert.deepEqual(event.risk, []);
    assert.deepEqual(event.follow, []);
  });
});

test("done warns when the work log exceeds the token warning threshold", async () => {
  await withDoneRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, workLogPath, [
      "# Work Log",
      "",
      "Lightweight RCC memory from completed agent work.",
      "",
      "<!-- repo-context-center:work-log:start -->",
      "## 2026-07-14T10:00:00Z",
      `- ${"Verbose completed work ".repeat(900)}`,
      "- files: src/history.ts",
      "<!-- repo-context-center:work-log:end -->",
      ""
    ].join("\n"));

    const result = runCli(["done", "Added one more entry", "--files", "src/new.ts"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Warning: docs\/ai-context\/WORK_LOG\.md is about \d+ tokens, above the 4000 token warning threshold\./);
    assert.match(result.stdout, /RCC will try to compact\/archive above 8000 tokens\./);
  });
});

test("done archives by token budget before the entry-count trigger", async () => {
  await withDoneRepo(async (tempDir) => {
    const entries = Array.from({ length: 60 }, (_, index) => [
      `## ${new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()}`,
      `- ${`Historical token-heavy work ${index} `.repeat(20)}`,
      `- files: src/history-${index}.ts`
    ].join("\n"));
    await writeFixtureFile(tempDir, workLogPath, [
      "# Work Log",
      "",
      "Lightweight RCC memory from completed agent work.",
      "",
      "<!-- repo-context-center:work-log:start -->",
      "",
      ...entries.flatMap((entry) => [entry, ""]),
      "<!-- repo-context-center:work-log:end -->",
      ""
    ].join("\n"));

    const result = runCli(["done", "Newest token-budget work", "--files", "src/newest.ts"], { cwd: tempDir });
    const live = await readFile(path.join(tempDir, workLogPath), "utf8");
    const archived = await readFile(
      path.join(tempDir, "docs/ai-context/archive/WORK_LOG_ARCHIVE.md"),
      "utf8"
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Auto-archived 11 older work log entries\./);
    assert.equal((live.match(/^## /gm) ?? []).length, 50);
    assert.match(live, /Newest token-budget work/);
    assert.doesNotMatch(live, /Historical token-heavy work 0\b/);
    assert.match(archived, /Historical token-heavy work 0\b/);
  });
});

test("done appends new entry", async () => {
  await withDoneRepo(async (tempDir) => {
    const first = runCli(["done", "Fixed login redirect bug"], { cwd: tempDir });
    const second = runCli(["done", "Added coupon redemption tests", "--verify", "npm test -- coupons"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");
    const events = (await readFile(path.join(tempDir, workEventsPath), "utf8")).trim().split(/\r?\n/).map(JSON.parse);

    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    assert.ok(content.indexOf("Fixed login redirect bug") < content.indexOf("Added coupon redemption tests"));
    assert.match(content, /- verify: npm test -- coupons/);
    assert.equal(countOccurrences(content, "npm test -- coupons"), 1);
    assert.equal(events.length, 2);
    assert.equal(events[0].s, "Fixed login redirect bug");
    assert.equal(events[1].s, "Added coupon redemption tests");
    assert.deepEqual(events[1].v, ["npm test -- coupons"]);
  });
});

test("done preserves existing entries", async () => {
  await withDoneRepo(async (tempDir) => {
    await writeFixtureFile(
      tempDir,
      "docs/ai-context/WORK_LOG.md",
      [
        "# Work Log",
        "",
        "Manual intro stays.",
        "",
        "<!-- repo-context-center:work-log:start -->",
        "## 2026-01-01T00:00:00.000Z",
        "- Summary: Existing work",
        "- Changed files: `src/existing.ts`",
        "<!-- repo-context-center:work-log:end -->",
        ""
      ].join("\n")
    );

    const result = runCli(["done", "Updated routing docs", "--risk", "low"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Manual intro stays\./);
    assert.match(content, /- Summary: Existing work/);
    assert.match(content, /- Updated routing docs/);
    assert.match(content, /- risk: low/);
  });
});

test("done automatically archives an oversized work log", async () => {
  await withDoneRepo(async (tempDir) => {
    const entries = Array.from({ length: 100 }, (_, index) => [
      `## ${new Date(Date.UTC(2025, 0, 1, 0, 0, index)).toISOString()}`,
      `- Summary: Historical work ${index}`,
      `- Changed files: \`src/history-${index}.ts\``
    ].join("\n"));
    await writeFixtureFile(tempDir, workLogPath, [
      "# Work Log",
      "",
      "Lightweight RCC memory from completed agent work.",
      "",
      "<!-- repo-context-center:work-log:start -->",
      "",
      ...entries.flatMap((entry) => [entry, ""]),
      "<!-- repo-context-center:work-log:end -->",
      ""
    ].join("\n"));

    const result = runCli(["done", "Newest completed work", "--files", "src/newest.ts"], { cwd: tempDir });
    const live = await readFile(path.join(tempDir, workLogPath), "utf8");
    const archived = await readFile(
      path.join(tempDir, "docs/ai-context/archive/WORK_LOG_ARCHIVE.md"),
      "utf8"
    );
    const events = (await readFile(path.join(tempDir, workEventsPath), "utf8")).trim().split(/\r?\n/).map(JSON.parse);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Auto-archived 51 older work log entries\./);
    assert.match(result.stdout, /Auto-compacted 100 verbose work log entries\./);
    assert.equal((live.match(/^## /gm) ?? []).length, 50);
    assert.match(live, /Newest completed work/);
    assert.doesNotMatch(live, /- Summary:/);
    assert.doesNotMatch(live, /Historical work 0\b/);
    assert.match(archived, /Historical work 0\b/);
    assert.doesNotMatch(archived, /- Summary:/);
    assert.equal(events.length, 101);
    assert.ok(events.some((event) => event.s === "Historical work 0"));
    assert.ok(events.some((event) => event.s === "Newest completed work"));
  });
});

test("done works without git", async () => {
  await withDoneRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");

    const result = runCli(["done", "Finished non-git task"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Changed files: not detected/);
    assert.match(content, /- Finished non-git task/);
  });
});

test("done --files auto detects changed files and filters RCC memory files", async () => {
  await withDoneRepo(async (tempDir) => {
    spawnSync("git", ["init"], { cwd: tempDir, encoding: "utf8" });
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");
    await writeFixtureFile(tempDir, "docs/ai-context/TASK_ROUTING.md", "# Routing\n");
    await writeFixtureFile(tempDir, ".repo-context-center/config.json", "{}\n");

    const result = runCli(["done", "--summary", "Recorded source edit", "--files", "auto"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Changed files: src\/index\.ts/);
    assert.doesNotMatch(result.stdout, /docs\/ai-context\/TASK_ROUTING\.md/);
    assert.doesNotMatch(result.stdout, /\.repo-context-center\/config\.json/);
    assert.match(content, /- files: src\/index\.ts/);
    assert.doesNotMatch(content, /docs\/ai-context\/TASK_ROUTING\.md/);
    assert.doesNotMatch(content, /\.repo-context-center\/config\.json/);
  });
});

test("done --files none records no changed files", async () => {
  await withDoneRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "src/index.ts", "export const ok = true;\n");

    const result = runCli(["done", "--summary", "Recorded summary only", "--files", "none"], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Changed files: none/);
    assert.match(content, /- files: _none_/);
  });
});

test("done validates empty summary", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli(["done", "   "], { cwd: tempDir });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: rcc done --summary "<summary>"/);
  });
});

test("done output tells agent what was saved", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "Updated routing docs",
      "--verify",
      "npm test -- routing",
      "--risk",
      "low",
      "--follow-ups",
      "Refresh map after docs settle",
      "--files",
      "docs/ai-context/TASK_ROUTING.md,AGENTS.md"
    ], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Summary: Updated routing docs/);
    assert.match(result.stdout, /Changed files: docs\/ai-context\/TASK_ROUTING\.md, AGENTS\.md/);
    assert.match(result.stdout, /RCC memory updated: docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /Verification: npm test -- routing/);
    assert.match(result.stdout, /Risk: low/);
    assert.match(result.stdout, /Follow-ups: Refresh map after docs settle/);
  });
});

test("done writes compact handoff-friendly data without duplicate JSON blocks", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Finished handoff integration",
      "--verify",
      "node --test tests/handoff.test.js",
      "--risk",
      "Parser should tolerate legacy entries",
      "--follow-ups",
      "Wire full handoff assembly",
      "--files",
      "src/cli/commands/done.ts,src/cli/handoff/handoffSources.ts"
    ], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /^## \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
    assert.match(content, /- Finished handoff integration/);
    assert.match(content, /- files: src\/cli\/commands\/done\.ts, src\/cli\/handoff\/handoffSources\.ts/);
    assert.match(content, /- verify: node --test tests\/handoff\.test\.js/);
    assert.match(content, /- risk: Parser should tolerate legacy entries/);
    assert.match(content, /- follow-ups: Wire full handoff assembly/);
    assert.doesNotMatch(content, /<!-- rcc:handoff/);
    assert.doesNotMatch(content, /```json repo-context-center:done/);
    assert.equal(countOccurrences(content, "node --test tests/handoff.test.js"), 1);
  });
});

test("done --log-format verbose writes legacy duplicated JSON blocks", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Finished legacy handoff logging",
      "--verify",
      "node --test tests/done.test.js",
      "--risk",
      "Compatibility mode only",
      "--follow-ups",
      "Prefer compact for new entries",
      "--files",
      "src/cli/commands/done.ts,tests/done.test.js",
      "--log-format",
      "verbose"
    ], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /^## \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
    assert.match(content, /- Summary: Finished legacy handoff logging/);
    assert.match(content, /- Changed files: `src\/cli\/commands\/done\.ts`, `tests\/done\.test\.js`/);
    assert.match(content, /- Verification: node --test tests\/done\.test\.js/);
    assert.match(content, /<!-- rcc:handoff/);
    assert.match(content, /```json repo-context-center:done/);
    assert.match(content, /"summary": "Finished legacy handoff logging"/);
    assert.match(content, /"command": "done"/);
    assert.equal(countOccurrences(content, "node --test tests/done.test.js"), 3);
  });
});

test("done compacts long file lists with a remainder count", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Updated many routing surfaces",
      "--files",
      "scripts/benchmark-routing.js,src/cli/work/taskFileRecommendations.ts,tests/helpers/routingEvaluation.js,tests/scripts/benchmark-routing.test.js,tests/fixtures/routing-cases.json"
    ], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /- files: scripts\/benchmark-routing\.js, src\/cli\/work\/taskFileRecommendations\.ts, \+3/);
    assert.doesNotMatch(content, /tests\/fixtures\/routing-cases\.json/);
  });
});

test("done --memory-only writes a simple log entry and skips derived memory artifacts", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Fixed small README typo",
      "--verify",
      "not run (docs only)",
      "--files",
      "README.md",
      "--memory-only"
    ], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /RCC memory updated: docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /RCC work index skipped: docs\/ai-context\/WORK_INDEX\.md \(--memory-only\)/);
    assert.match(result.stdout, /RCC learning skipped: docs\/ai-context\/REPOSITORY_LEARNING\.md \(--memory-only\)/);
    assert.match(content, /- Fixed small README typo/);
    assert.match(content, /- files: README\.md/);
    assert.match(content, /- verify: not run \(docs only\)/);
    assert.doesNotMatch(content, /<!-- rcc:handoff/);
    assert.doesNotMatch(content, /```json repo-context-center:done/);
    await assert.rejects(() => readFile(path.join(tempDir, workIndexPath), "utf8"), { code: "ENOENT" });
    await assert.rejects(() => readFile(path.join(tempDir, repositoryLearningPath), "utf8"), { code: "ENOENT" });
  });
});

test("done neutralizes handoff comment injection in untrusted fields", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Finished task --> <!-- injected",
      "--verify",
      "node --test tests/done.test.js\n- forged verification",
      "--risk",
      "low --> forged",
      "--files",
      "src/cli/commands/done.ts"
    ], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.doesNotMatch(content, /Finished task -->/);
    assert.doesNotMatch(content, /<!-- injected/);
    assert.doesNotMatch(content, /low --> forged/);
    assert.match(content, /Finished task -- > <! -- injected/);
    assert.match(content, /node --test tests\/done\.test\.js - forged verification/);
    assert.doesNotMatch(content, /^\- forged verification$/m);
    assert.match(content, /- risk: low -- > forged/);
  });
});

test("done neutralizes handoff comment injection in file paths", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Recorded suspicious path",
      "--files",
      "src/cli/commands/done.ts --> <!-- forged,tests/done.test.js"
    ], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, workLogPath), "utf8");

    assert.equal(result.status, 0);
    assert.doesNotMatch(content, /done\.ts --> <!-- forged/);
    assert.match(content, /done\.ts -- > <! -- forged/);
    assert.match(content, /- files: src\/cli\/commands\/done\.ts -- > <! -- forged, tests\/done\.test\.js/);
  });
});

test("done updates repository learning with compact generated patterns", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Updated repository learning foundation",
      "--verify",
      "node --test tests/done.test.js",
      "--files",
      "src/cli/commands/done.ts,tests/done.test.js"
    ], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, repositoryLearningPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /RCC memory updated: docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /RCC work index updated: docs\/ai-context\/WORK_INDEX\.md/);
    assert.match(result.stdout, /RCC learning updated: docs\/ai-context\/REPOSITORY_LEARNING\.md/);
    assert.match(content, /^# Repository Learning$/m);
    assert.match(content, /<!-- repo-context-center:repository-learning:start -->/);
    assert.match(content, /<!-- repo-context-center:repository-learning:end -->/);
    assert.match(content, /^## Recent Focus Areas$/m);
    assert.match(content, /^## Common File Relationships$/m);
    assert.match(content, /^## Frequently Modified Together$/m);
    assert.match(content, /^## Verification Patterns$/m);
    assert.match(content, /^## Repository Habits$/m);
    assert.match(content, /\| done \| `tests\/done\.test\.js` \| Observed in completed done work \| 1 \|/);
    assert.match(content, /\| none detected yet \| - \| - \|/);
    assert.match(content, /\| done \| `node --test tests\/done\.test\.js` \| 1 \|/);
    assert.doesNotMatch(content, /(^|\|)\s*--:\s*(?=\|)/);
    assert.doesNotMatch(content, /\bwork work\b/);
    assert.doesNotMatch(content, /- Summary:/);
    assert.equal(countOccurrences(content, "<!-- repo-context-center:repository-learning:start -->"), 1);
    assert.equal(countOccurrences(content, "<!-- repo-context-center:repository-learning:end -->"), 1);
  });
});

test("done skips repository learning for tiny typo-only tasks by default", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Fixed renderAgent guidance typo to refer to rcc work explicitly.",
      "--verify",
      "npm run build; node --test tests/handoff.test.js",
      "--files",
      "src/cli/work/renderAgent.ts"
    ], { cwd: tempDir });
    const workLog = await readFile(path.join(tempDir, workLogPath), "utf8");
    const workIndex = await readFile(path.join(tempDir, workIndexPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /RCC memory updated: docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /RCC work index updated: docs\/ai-context\/WORK_INDEX\.md/);
    assert.match(result.stdout, /RCC learning skipped: docs\/ai-context\/REPOSITORY_LEARNING\.md \(tiny\/noise task; use --learn to force\)/);
    assert.match(workLog, /Fixed renderAgent guidance typo/);
    assert.match(workIndex, /Fixed renderAgent guidance typo/);
    await assert.rejects(() => readFile(path.join(tempDir, repositoryLearningPath), "utf8"), { code: "ENOENT" });
  });
});

test("done --learn forces repository learning for tiny typo-only tasks", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Fixed renderAgent guidance typo to refer to rcc work explicitly.",
      "--verify",
      "npm run build",
      "--files",
      "src/cli/work/renderAgent.ts",
      "--learn"
    ], { cwd: tempDir });
    const learning = await readFile(path.join(tempDir, repositoryLearningPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /RCC learning updated: docs\/ai-context\/REPOSITORY_LEARNING\.md/);
    assert.match(learning, /^# Repository Learning$/m);
    assert.match(learning, /renderAgent\.ts/);
  });
});

test("done --no-learn skips repository learning for any task", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Implemented parser routing memory update",
      "--verify",
      "node --test tests/done.test.js",
      "--files",
      "src/cli/commands/done.ts,tests/done.test.js",
      "--no-learn"
    ], { cwd: tempDir });
    const workIndex = await readFile(path.join(tempDir, workIndexPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /RCC learning skipped: docs\/ai-context\/REPOSITORY_LEARNING\.md \(--no-learn\)/);
    assert.match(workIndex, /Implemented parser routing memory update/);
    await assert.rejects(() => readFile(path.join(tempDir, repositoryLearningPath), "utf8"), { code: "ENOENT" });
  });
});

test("done keeps repository learning for medium implementation summaries by default", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Implemented parser routing memory update",
      "--verify",
      "node --test tests/done.test.js",
      "--files",
      "src/cli/commands/done.ts"
    ], { cwd: tempDir });
    const learning = await readFile(path.join(tempDir, repositoryLearningPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /RCC learning updated: docs\/ai-context\/REPOSITORY_LEARNING\.md/);
    assert.match(learning, /src\/cli\/commands\/done\.ts/);
  });
});

test("done refreshes work index and repository learning from the completed entry", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli([
      "done",
      "--summary",
      "Refreshed memory artifacts",
      "--verify",
      "node --test tests/done.test.js",
      "--files",
      "src/cli/commands/done.ts,tests/done.test.js"
    ], { cwd: tempDir });
    const workIndex = await readFile(path.join(tempDir, workIndexPath), "utf8");
    const learning = await readFile(path.join(tempDir, repositoryLearningPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /RCC work index updated: docs\/ai-context\/WORK_INDEX\.md/);
    assert.match(result.stdout, /RCC learning updated: docs\/ai-context\/REPOSITORY_LEARNING\.md/);
    assert.match(workIndex, /Refreshed memory artifacts/);
    assert.match(workIndex, /src\/cli\/commands\/done\.ts/);
    assert.match(learning, /\| done \| `tests\/done\.test\.js` \| Observed in completed done work \| 1 \|/);
    assert.match(learning, /\| done \| `node --test tests\/done\.test\.js` \| 1 \|/);
  });
});

test("done refreshes derived memory from JSONL events when WORK_LOG is stale", async () => {
  await withDoneRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, workEventsPath, `${JSON.stringify({
      t: "2026-07-13T10:00:00Z",
      s: "Canonical JSONL memory",
      f: ["src/canonical.ts"],
      v: ["node --test tests/canonical.test.js"],
      risk: [],
      follow: []
    })}\n`);
    await writeFixtureFile(tempDir, workLogPath, [
      "# Work Log",
      "",
      "<!-- repo-context-center:work-log:start -->",
      "## 2026-07-14T10:00:00Z",
      "- Stale markdown memory",
      "- files: src/stale.ts",
      "<!-- repo-context-center:work-log:end -->",
      ""
    ].join("\n"));

    const result = runCli([
      "done",
      "--summary",
      "Updated canonical event stream",
      "--files",
      "src/cli/commands/done.ts"
    ], { cwd: tempDir });
    const workIndex = await readFile(path.join(tempDir, workIndexPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(workIndex, /Canonical JSONL memory/);
    assert.match(workIndex, /Updated canonical event stream/);
    assert.doesNotMatch(workIndex, /Stale markdown memory|src\/stale\.ts/);
  });
});

test("done preserves manual repository learning content outside generated markers", async () => {
  await withDoneRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, repositoryLearningPath, [
      "# Repository Learning",
      "",
      "Manual note before generated content.",
      "",
      "<!-- repo-context-center:repository-learning:start -->",
      "stale generated content",
      "<!-- repo-context-center:repository-learning:end -->",
      "",
      "Manual note after generated content.",
      ""
    ].join("\n"));

    const result = runCli([
      "done",
      "--summary",
      "Updated done memory",
      "--files",
      "src/cli/commands/done.ts"
    ], { cwd: tempDir });
    const content = await readFile(path.join(tempDir, repositoryLearningPath), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Manual note before generated content\./);
    assert.match(content, /Manual note after generated content\./);
    assert.match(content, /## Recent Focus Areas/);
    assert.doesNotMatch(content, /stale generated content/);
  });
});

test("done dry-run does not write work log", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli(["done", "Preview routing docs", "--verify", "npm test -- routing", "--dry-run"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /RCC memory would update: docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /RCC work index would update: docs\/ai-context\/WORK_INDEX\.md/);
    assert.match(result.stdout, /RCC learning would update: docs\/ai-context\/REPOSITORY_LEARNING\.md/);
    await assert.rejects(() => readFile(path.join(tempDir, workLogPath), "utf8"), { code: "ENOENT" });
    await assert.rejects(() => readFile(path.join(tempDir, workEventsPath), "utf8"), { code: "ENOENT" });
  });
});

test("done help documents auto and none file modes", async () => {
  await withDoneRepo(async (tempDir) => {
    const result = runCli(["done", "--help"], { cwd: tempDir });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /--files auto\|none\|"<path,path>"/);
    assert.match(result.stdout, /--files auto\s+Detect changed files from git status/);
    assert.match(result.stdout, /--files none\s+Record no changed files/);
    assert.match(result.stdout, /--log-format compact\|verbose/);
    assert.match(result.stdout, /--log-format compact\s+Write one compact markdown entry \(default\)/);
    assert.match(result.stdout, /--log-format verbose\s+Write legacy handoff JSON and done JSON blocks/);
  });
});
