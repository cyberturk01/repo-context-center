const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, stat, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runArchive(cwd, args = []) {
  return spawnSync(process.execPath, [cliPath, "archive", ...args], {
    cwd,
    encoding: "utf8"
  });
}

async function createTempRepo() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-archive-"));
  await mkdir(path.join(tempDir, "docs", "ai-context"), { recursive: true });
  return tempDir;
}

async function writeContextFile(tempDir, relativePath, rows) {
  const content = [
    relativePath.includes("CHANGE_LOG") ? "# Change Log" : "# Lessons Learned",
    "",
    "Short heading text.",
    "",
    "| Date | Entry | Source |",
    "| --- | --- | --- |",
    ...rows,
    "",
    "Trailing guidance stays here.",
    ""
  ].join("\n");

  await writeFile(path.join(tempDir, relativePath), content, "utf8");
  return content;
}

async function writeWorkLog(tempDir, entries) {
  const content = [
    "# Work Log",
    "",
    "Lightweight RCC memory from completed agent work.",
    "",
    "<!-- repo-context-center:work-log:start -->",
    "",
    ...entries.flatMap((entry) => [
      `## ${entry.timestamp}`,
      `- Summary: ${entry.summary}`,
      `- Changed files: ${entry.files.map((file) => `\`${file}\``).join(", ")}`,
      `- Verification: ${entry.verify}`,
      "<!-- rcc:handoff",
      JSON.stringify({
        schemaVersion: 1,
        timestamp: entry.timestamp,
        summary: entry.summary,
        files: entry.files,
        verification: [entry.verify],
        followUps: [],
        risks: []
      }, null, 2),
      "-->",
      "",
    ]),
    "<!-- repo-context-center:work-log:end -->",
    ""
  ].join("\n");

  await writeFile(path.join(tempDir, "docs", "ai-context", "WORK_LOG.md"), content, "utf8");
  return content;
}

test("archive keeps newest entries in the original file", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeContextFile(tempDir, "docs/ai-context/CHANGE_LOG.md", [
      "| 2024-01-01 | old | one |",
      "| 2024-03-01 | newest | three |",
      "| 2024-02-01 | middle | two |"
    ]);

    const result = runArchive(tempDir, ["--keep", "2"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "CHANGE_LOG.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /^# Change Log/m);
    assert.match(content, /2024-03-01/);
    assert.match(content, /2024-02-01/);
    assert.doesNotMatch(content, /2024-01-01/);
    assert.match(content, /Trailing guidance stays here/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive moves older entries to archive files", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeContextFile(tempDir, "docs/ai-context/LESSONS_LEARNED.md", [
      "| 2024-04-01 | fourth | test |",
      "| 2024-03-01 | third | test |",
      "| 2024-02-01 | second | test |",
      "| 2024-01-01 | first | test |"
    ]);

    const result = runArchive(tempDir, ["--keep", "1"]);
    const archiveContent = await readFile(
      path.join(tempDir, "docs", "ai-context", "archive", "LESSONS_LEARNED_ARCHIVE.md"),
      "utf8"
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Archived 3 entries/);
    assert.match(archiveContent, /^# Lessons Learned Archive/m);
    assert.match(archiveContent, /2024-03-01/);
    assert.match(archiveContent, /2024-02-01/);
    assert.match(archiveContent, /2024-01-01/);
    assert.doesNotMatch(archiveContent, /2024-04-01/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive dry-run does not write files", async () => {
  const tempDir = await createTempRepo();

  try {
    const original = await writeContextFile(tempDir, "docs/ai-context/CHANGE_LOG.md", [
      "| 2024-02-01 | newer | test |",
      "| 2024-01-01 | older | test |"
    ]);

    const result = runArchive(tempDir, ["--keep", "1", "--dry-run"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "CHANGE_LOG.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Archive dry run/);
    assert.equal(content, original);
    await assert.rejects(
      () => stat(path.join(tempDir, "docs", "ai-context", "archive", "CHANGE_LOG_ARCHIVE.md")),
      { code: "ENOENT" }
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive handles missing optional files gracefully", async () => {
  const tempDir = await createTempRepo();

  try {
    const result = runArchive(tempDir, ["--keep", "2"]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Skipped missing optional file: docs\/ai-context\/CHANGE_LOG\.md/);
    assert.match(result.stdout, /Skipped missing optional file: docs\/ai-context\/LESSONS_LEARNED\.md/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive creates WORK_INDEX from retained and archived work log entries", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeWorkLog(tempDir, [
      {
        timestamp: "2026-06-18T10:00:00.000Z",
        summary: "Implemented old routing cleanup",
        files: ["src/cli/work/old.ts"],
        verify: "node --test tests/work.test.js"
      },
      {
        timestamp: "2026-06-19T10:00:00.000Z",
        summary: "Added handoff memory reader",
        files: ["src/cli/handoff/handoffSources.ts"],
        verify: "node --test tests/handoff.test.js"
      },
      {
        timestamp: "2026-06-20T10:00:00.000Z",
        summary: "Added work index compaction",
        files: ["src/core/workMemory.ts", "tests/archive.test.js"],
        verify: "npm test"
      }
    ]);

    const result = runArchive(tempDir, ["--keep", "2"]);
    const workLog = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_LOG.md"), "utf8");
    const workArchive = await readFile(
      path.join(tempDir, "docs", "ai-context", "archive", "WORK_LOG_ARCHIVE.md"),
      "utf8"
    );
    const workIndex = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_INDEX.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Archived 1 entries from docs\/ai-context\/WORK_LOG\.md/);
    assert.match(workLog, /Added work index compaction/);
    assert.match(workLog, /Added handoff memory reader/);
    assert.doesNotMatch(workLog, /Implemented old routing cleanup/);
    assert.match(workArchive, /Implemented old routing cleanup/);
    assert.match(workIndex, /<!-- repo-context-center:work-index:start -->/);
    assert.match(workIndex, /## Recent Focus/);
    assert.match(workIndex, /## Hot Files/);
    assert.match(workIndex, /## Completed Work Themes/);
    assert.match(workIndex, /## Verification Patterns/);
    assert.match(workIndex, /Added work index compaction/);
    assert.match(workIndex, /Implemented old routing cleanup/);
    assert.ok(workIndex.length < workLog.length + workArchive.length);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive updates WORK_INDEX without changing CHANGE_LOG behavior", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeContextFile(tempDir, "docs/ai-context/CHANGE_LOG.md", [
      "| 2024-03-01 | newest | three |",
      "| 2024-02-01 | middle | two |",
      "| 2024-01-01 | old | one |"
    ]);
    await writeWorkLog(tempDir, [
      {
        timestamp: "2026-06-20T10:00:00.000Z",
        summary: "Kept archive behavior stable",
        files: ["src/core/archiver.ts"],
        verify: "node --test tests/archive.test.js"
      }
    ]);

    const result = runArchive(tempDir, ["--keep", "2"]);
    const changeLog = await readFile(path.join(tempDir, "docs", "ai-context", "CHANGE_LOG.md"), "utf8");
    const changeArchive = await readFile(
      path.join(tempDir, "docs", "ai-context", "archive", "CHANGE_LOG_ARCHIVE.md"),
      "utf8"
    );
    const workIndex = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_INDEX.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(changeLog, /2024-03-01/);
    assert.match(changeLog, /2024-02-01/);
    assert.doesNotMatch(changeLog, /2024-01-01/);
    assert.match(changeArchive, /2024-01-01/);
    assert.match(workIndex, /Kept archive behavior stable/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
