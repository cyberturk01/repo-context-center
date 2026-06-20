const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildRepositoryLearningModel
} = require("../dist/core/repositoryLearning.js");
const { renderRepositoryLearningBody } = require("../dist/core/renderRepositoryLearning.js");

function structuredEntry(entry) {
  return [
    `## ${entry.timestamp}`,
    `- Summary: ${entry.summary}`,
    `- Changed files: ${entry.files.map((file) => `\`${file}\``).join(", ")}`,
    entry.verification ? `- Verification: ${entry.verification}` : "",
    "<!-- rcc:handoff",
    JSON.stringify({
      schemaVersion: 1,
      command: entry.command ?? "done",
      timestamp: entry.timestamp,
      summary: entry.summary,
      files: entry.files,
      verification: entry.verification ?? null,
      followUps: [],
      risks: []
    }, null, 2),
    "-->",
    "```json repo-context-center:done",
    JSON.stringify({
      schemaVersion: 1,
      command: entry.command ?? "done",
      timestamp: entry.timestamp,
      summary: entry.summary,
      files: entry.files,
      verification: entry.verification ?? null,
      followUps: [],
      risks: []
    }, null, 2),
    "```"
  ].filter(Boolean).join("\n");
}

function workLog(entries) {
  return [
    "# Work Log",
    "",
    "<!-- repo-context-center:work-log:start -->",
    ...entries.map(structuredEntry),
    "<!-- repo-context-center:work-log:end -->",
    ""
  ].join("\n\n");
}

function relationship(model, source, related) {
  return model.commonFileRelationships.find((item) => item.source === source && item.related === related);
}

test("repository learning model relates repeated handoff and work changes to their tests", () => {
  const model = buildRepositoryLearningModel({
    workLog: workLog([
      {
        timestamp: "2026-06-20T10:00:00.000Z",
        summary: "Updated handoff renderer",
        files: ["src/cli/handoff/renderJson.ts", "tests/handoff.test.js"],
        verification: "node --test tests/handoff.test.js"
      },
      {
        timestamp: "2026-06-20T11:00:00.000Z",
        summary: "Fixed handoff source parsing",
        files: ["src/cli/handoff/handoffSources.ts", "tests/handoff.test.js"],
        verification: "node --test tests/handoff.test.js"
      },
      {
        timestamp: "2026-06-20T12:00:00.000Z",
        summary: "Updated work route output",
        files: ["src/cli/commands/work.ts", "tests/work.test.js"],
        verification: "node --test tests/work.test.js"
      },
      {
        timestamp: "2026-06-20T13:00:00.000Z",
        summary: "Fixed work lookup ranking",
        files: ["src/cli/work/targetedLookup.ts", "tests/work.test.js"],
        verification: "node --test tests/work.test.js"
      }
    ])
  });

  assert.equal(relationship(model, "handoff", "tests/handoff.test.js")?.count, 2);
  assert.equal(relationship(model, "work", "tests/work.test.js")?.count, 2);
  assert.ok(model.recentFocusAreas.includes("handoff (2)"));
  assert.ok(model.recentFocusAreas.includes("work (2)"));
});

test("repository learning model counts verification commands by scope", () => {
  const model = buildRepositoryLearningModel({
    workLog: workLog([
      {
        timestamp: "2026-06-20T10:00:00.000Z",
        summary: "Updated handoff renderer",
        files: ["src/cli/handoff/renderJson.ts", "tests/handoff.test.js"],
        verification: "node --test tests/handoff.test.js; npm run build"
      },
      {
        timestamp: "2026-06-20T11:00:00.000Z",
        summary: "Fixed handoff source parsing",
        files: ["src/cli/handoff/handoffSources.ts", "tests/handoff.test.js"],
        verification: "node --test tests/handoff.test.js; npm run build"
      },
      {
        timestamp: "2026-06-20T12:00:00.000Z",
        summary: "Updated work route output",
        files: ["src/cli/commands/work.ts", "tests/work.test.js"],
        verification: "node --test tests/work.test.js"
      }
    ])
  });

  assert.deepEqual(
    model.verificationPatterns.map((pattern) => [pattern.scope, pattern.command, pattern.count]).slice(0, 3),
    [
      ["build", "npm run build", 2],
      ["handoff", "node --test tests/handoff.test.js", 2],
      ["work", "node --test tests/work.test.js", 1]
    ]
  );
});

test("repository learning model keeps one-off unrelated files from dominating repeated patterns", () => {
  const model = buildRepositoryLearningModel({
    workLog: workLog([
      {
        timestamp: "2026-06-20T10:00:00.000Z",
        summary: "Updated handoff renderer",
        files: ["src/cli/handoff/renderJson.ts", "tests/handoff.test.js"]
      },
      {
        timestamp: "2026-06-20T11:00:00.000Z",
        summary: "Fixed handoff source parsing",
        files: ["src/cli/handoff/handoffSources.ts", "tests/handoff.test.js"]
      },
      {
        timestamp: "2026-06-20T12:00:00.000Z",
        summary: "One-off unrelated cleanup",
        files: ["src/one-off/a.ts", "src/one-off/b.ts", "src/one-off/c.ts", "src/one-off/d.ts"]
      }
    ])
  });

  assert.equal(relationship(model, "handoff", "tests/handoff.test.js")?.count, 2);
  assert.equal(model.commonFileRelationships.some((item) => item.related.startsWith("src/one-off/")), false);
  assert.equal(model.frequentlyModifiedTogether.some((item) => item.files.some((file) => file.startsWith("src/one-off/"))), false);
});

test("repository learning model ignores generated asset and archive files", () => {
  const model = buildRepositoryLearningModel({
    workLog: workLog([
      {
        timestamp: "2026-06-20T10:00:00.000Z",
        summary: "Updated handoff renderer",
        files: [
          "src/cli/handoff/renderJson.ts",
          "tests/handoff.test.js",
          "dist/cli/index.js",
          "docs/ai-context/archive/WORK_LOG_ARCHIVE.md",
          "src/logo.svg"
        ]
      },
      {
        timestamp: "2026-06-20T11:00:00.000Z",
        summary: "Fixed handoff source parsing",
        files: [
          "src/cli/handoff/handoffSources.ts",
          "tests/handoff.test.js",
          "dist/cli/index.js",
          "docs/ai-context/archive/WORK_LOG_ARCHIVE.md",
          "src/logo.svg"
        ]
      }
    ])
  });
  const rendered = renderRepositoryLearningBody(model);

  assert.equal(relationship(model, "handoff", "tests/handoff.test.js")?.count, 2);
  assert.doesNotMatch(rendered, /dist\/cli\/index\.js/);
  assert.doesNotMatch(rendered, /WORK_LOG_ARCHIVE\.md/);
  assert.doesNotMatch(rendered, /src\/logo\.svg/);
});
