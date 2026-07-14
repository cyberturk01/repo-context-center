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

async function writeArchivedWorkLog(tempDir, entries) {
  const content = [
    "# Work Log Archive",
    "",
    "Older completed-work entries archived from WORK_LOG.md.",
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

  await mkdir(path.join(tempDir, "docs", "ai-context", "archive"), { recursive: true });
  await writeFile(path.join(tempDir, "docs", "ai-context", "archive", "WORK_LOG_ARCHIVE.md"), content, "utf8");
  return content;
}

async function writeVerboseWorkLog(tempDir, entries) {
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
        followUps: entry.followUps ?? [],
        risks: entry.risks ?? []
      }, null, 2),
      "-->",
      "```json repo-context-center:done",
      JSON.stringify({
        schemaVersion: 1,
        command: "done",
        timestamp: entry.timestamp,
        summary: entry.summary,
        files: entry.files,
        verification: entry.verify,
        followUps: entry.followUps ?? [],
        risks: entry.risks ?? []
      }, null, 2),
      "```",
      "",
    ]),
    "<!-- repo-context-center:work-log:end -->",
    ""
  ].join("\n");

  await writeFile(path.join(tempDir, "docs", "ai-context", "WORK_LOG.md"), content, "utf8");
  return content;
}

function countOccurrences(content, value) {
  return (content.match(new RegExp(value, "g")) ?? []).length;
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
    assert.match(result.stdout, /RCC memory updated: docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /RCC work index updated: docs\/ai-context\/WORK_INDEX\.md/);
    assert.match(result.stdout, /RCC learning updated: docs\/ai-context\/REPOSITORY_LEARNING\.md/);
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

test("archive updates repository learning from retained and archived work log entries", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeWorkLog(tempDir, [
      {
        timestamp: "2026-06-18T10:00:00.000Z",
        summary: "Implemented old routing cleanup",
        files: ["src/cli/work/old.ts", "tests/work.test.js"],
        verify: "node --test tests/work.test.js"
      },
      {
        timestamp: "2026-06-19T10:00:00.000Z",
        summary: "Added handoff memory reader",
        files: ["src/cli/handoff/handoffSources.ts", "tests/handoff.test.js"],
        verify: "node --test tests/handoff.test.js"
      },
      {
        timestamp: "2026-06-20T10:00:00.000Z",
        summary: "Added work index compaction",
        files: ["src/core/workMemory.ts", "tests/archive.test.js"],
        verify: "npm test"
      }
    ]);

    const result = runArchive(tempDir, ["--keep", "1"]);
    const learning = await readFile(path.join(tempDir, "docs", "ai-context", "REPOSITORY_LEARNING.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(learning, /^# Repository Learning$/m);
    assert.match(learning, /<!-- repo-context-center:repository-learning:start -->/);
    assert.match(learning, /^## Recent Focus Areas$/m);
    assert.match(learning, /archive \(1\)/);
    assert.match(learning, /work \(1\)/);
    assert.match(learning, /handoff \(1\)/);
    assert.match(learning, /`node --test tests\/work\.test\.js`/);
    assert.doesNotMatch(learning, /(^|\|)\s*--:\s*(?=\|)/);
    assert.doesNotMatch(learning, /\bwork work\b/);
    assert.equal(countOccurrences(learning, "<!-- repo-context-center:repository-learning:start -->"), 1);
    assert.equal(countOccurrences(learning, "<!-- repo-context-center:repository-learning:end -->"), 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive refreshes compact memory from archived work log when live work log is missing", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeArchivedWorkLog(tempDir, [
      {
        timestamp: "2026-06-18T10:00:00.000Z",
        summary: "Preserved archived memory refresh",
        files: ["src/core/archiver.ts", "tests/archive.test.js"],
        verify: "node --test tests/archive.test.js"
      }
    ]);

    const result = runArchive(tempDir, ["--keep", "2"]);
    const workIndex = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_INDEX.md"), "utf8");
    const learning = await readFile(path.join(tempDir, "docs", "ai-context", "REPOSITORY_LEARNING.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Skipped missing optional file: docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /RCC work index updated: docs\/ai-context\/WORK_INDEX\.md/);
    assert.match(result.stdout, /RCC learning updated: docs\/ai-context\/REPOSITORY_LEARNING\.md/);
    assert.match(workIndex, /Preserved archived memory refresh/);
    assert.match(learning, /archive \(1\)/);
    assert.match(learning, /`node --test tests\/archive\.test\.js`/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive --compact-work-log converts verbose work log entries and preserves JSONL metadata", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeVerboseWorkLog(tempDir, [
      {
        timestamp: "2026-07-14T10:00:00.000Z",
        summary: "Documented verbose compaction",
        files: ["src/core/workMemory.ts", "src/core/archiver.ts", "tests/archive.test.js"],
        verify: "node --test tests/archive.test.js",
        risks: ["Legacy parser compatibility"],
        followUps: ["Watch compact archive output"]
      }
    ]);

    const result = runArchive(tempDir, ["--compact-work-log", "--keep", "5"]);
    const workLog = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_LOG.md"), "utf8");
    const events = (await readFile(
      path.join(tempDir, "docs", "ai-context", "WORK_EVENTS.jsonl"),
      "utf8"
    )).trim().split(/\r?\n/).map(JSON.parse);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Compacted 1 verbose entries in docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /Preserved 1 work log metadata entries in docs\/ai-context\/WORK_EVENTS\.jsonl/);
    assert.match(workLog, /- Documented verbose compaction/);
    assert.match(workLog, /- files: src\/core\/workMemory\.ts, src\/core\/archiver\.ts, \+1/);
    assert.match(workLog, /- verify: node --test tests\/archive\.test\.js/);
    assert.match(workLog, /- risk: Legacy parser compatibility/);
    assert.match(workLog, /- follow-ups: Watch compact archive output/);
    assert.doesNotMatch(workLog, /<!-- rcc:handoff/);
    assert.doesNotMatch(workLog, /```json repo-context-center:done/);
    assert.equal(events.length, 1);
    assert.equal(events[0].s, "Documented verbose compaction");
    assert.deepEqual(events[0].f, ["src/core/workMemory.ts", "src/core/archiver.ts", "tests/archive.test.js"]);
    assert.deepEqual(events[0].v, ["node --test tests/archive.test.js"]);
    assert.deepEqual(events[0].risk, ["Legacy parser compatibility"]);
    assert.deepEqual(events[0].follow, ["Watch compact archive output"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive --compact-work-log dry-run reports compaction without writing files", async () => {
  const tempDir = await createTempRepo();

  try {
    const original = await writeVerboseWorkLog(tempDir, [
      {
        timestamp: "2026-07-14T10:00:00.000Z",
        summary: "Preview verbose compaction",
        files: ["src/core/workMemory.ts"],
        verify: "node --test tests/archive.test.js"
      }
    ]);

    const result = runArchive(tempDir, ["--compact-work-log", "--keep", "5", "--dry-run"]);
    const workLog = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_LOG.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Archive dry run/);
    assert.match(result.stdout, /Would compact 1 verbose entries in docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /Would preserve 1 work log metadata entries in docs\/ai-context\/WORK_EVENTS\.jsonl/);
    assert.equal(workLog, original);
    await assert.rejects(
      () => stat(path.join(tempDir, "docs", "ai-context", "WORK_EVENTS.jsonl")),
      { code: "ENOENT" }
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive --compact-work-log compacts before archiving older work log entries", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeVerboseWorkLog(tempDir, [
      {
        timestamp: "2026-07-14T10:00:00.000Z",
        summary: "Newest compacted entry",
        files: ["src/newest.ts"],
        verify: "npm run build"
      },
      {
        timestamp: "2026-07-13T10:00:00.000Z",
        summary: "Middle compacted entry",
        files: ["src/middle.ts"],
        verify: "node --test tests/archive.test.js"
      },
      {
        timestamp: "2026-07-12T10:00:00.000Z",
        summary: "Oldest compacted entry",
        files: ["src/oldest.ts"],
        verify: "node --test tests/done.test.js"
      }
    ]);

    const result = runArchive(tempDir, ["--compact-work-log", "--keep", "1"]);
    const workLog = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_LOG.md"), "utf8");
    const archive = await readFile(
      path.join(tempDir, "docs", "ai-context", "archive", "WORK_LOG_ARCHIVE.md"),
      "utf8"
    );
    const events = (await readFile(
      path.join(tempDir, "docs", "ai-context", "WORK_EVENTS.jsonl"),
      "utf8"
    )).trim().split(/\r?\n/).map(JSON.parse);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Compacted 3 verbose entries in docs\/ai-context\/WORK_LOG\.md/);
    assert.match(result.stdout, /Archived 2 entries from docs\/ai-context\/WORK_LOG\.md/);
    assert.match(workLog, /Newest compacted entry/);
    assert.doesNotMatch(workLog, /Middle compacted entry|Oldest compacted entry/);
    assert.match(archive, /Middle compacted entry/);
    assert.match(archive, /Oldest compacted entry/);
    assert.doesNotMatch(archive, /<!-- rcc:handoff/);
    assert.doesNotMatch(archive, /```json repo-context-center:done/);
    assert.equal(events.length, 3);
    assert.deepEqual(events.map((event) => event.s).sort(), [
      "Middle compacted entry",
      "Newest compacted entry",
      "Oldest compacted entry"
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive --compact-work-log is idempotent", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeVerboseWorkLog(tempDir, [
      {
        timestamp: "2026-07-14T10:00:00.000Z",
        summary: "Stable compacted entry",
        files: ["src/core/workMemory.ts", "tests/archive.test.js"],
        verify: "node --test tests/archive.test.js"
      }
    ]);

    const first = runArchive(tempDir, ["--compact-work-log", "--keep", "5"]);
    const firstWorkLog = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_LOG.md"), "utf8");
    const firstEvents = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_EVENTS.jsonl"), "utf8");
    const second = runArchive(tempDir, ["--compact-work-log", "--keep", "5"]);
    const secondWorkLog = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_LOG.md"), "utf8");
    const secondEvents = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_EVENTS.jsonl"), "utf8");

    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    assert.match(first.stdout, /Compacted 1 verbose entries/);
    assert.doesNotMatch(second.stdout, /Compacted 1 verbose entries/);
    assert.equal(secondWorkLog, firstWorkLog);
    assert.equal(secondEvents, firstEvents);
    assert.equal(secondEvents.trim().split(/\r?\n/).length, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("archive creates missing repository learning file and preserves manual sections", async () => {
  const tempDir = await createTempRepo();

  try {
    await writeWorkLog(tempDir, [
      {
        timestamp: "2026-06-20T10:00:00.000Z",
        summary: "Kept archive learning current",
        files: ["src/core/archiver.ts", "tests/archive.test.js"],
        verify: "node --test tests/archive.test.js"
      }
    ]);

    const first = runArchive(tempDir, ["--keep", "5"]);
    const created = await readFile(path.join(tempDir, "docs", "ai-context", "REPOSITORY_LEARNING.md"), "utf8");
    assert.equal(first.status, 0);
    assert.match(created, /archive \(1\)/);
    assert.match(created, /`node --test tests\/archive\.test\.js`/);

    await writeFile(path.join(tempDir, "docs", "ai-context", "REPOSITORY_LEARNING.md"), [
      "# Repository Learning",
      "",
      "Manual note before.",
      "",
      "<!-- repo-context-center:repository-learning:start -->",
      "stale generated content",
      "<!-- repo-context-center:repository-learning:end -->",
      "",
      "Manual note after.",
      ""
    ].join("\n"), "utf8");

    const second = runArchive(tempDir, ["--keep", "5"]);
    const preserved = await readFile(path.join(tempDir, "docs", "ai-context", "REPOSITORY_LEARNING.md"), "utf8");

    assert.equal(second.status, 0);
    assert.match(preserved, /Manual note before\./);
    assert.match(preserved, /Manual note after\./);
    assert.match(preserved, /^## Recent Focus Areas$/m);
    assert.doesNotMatch(preserved, /stale generated content/);
    assert.equal(countOccurrences(preserved, "<!-- repo-context-center:repository-learning:start -->"), 1);
    assert.equal(countOccurrences(preserved, "<!-- repo-context-center:repository-learning:end -->"), 1);
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
