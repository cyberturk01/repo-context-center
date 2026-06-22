const assert = require("node:assert/strict");
const test = require("node:test");

const {
  renderRepositoryLearning,
  renderRepositoryLearningBody,
  upsertRepositoryLearning
} = require("../dist/core/renderRepositoryLearning.js");

const emptyModel = {
  recentFocusAreas: [],
  commonFileRelationships: [],
  frequentlyModifiedTogether: [],
  verificationPatterns: [],
  repositoryHabits: []
};

test("renderRepositoryLearning renders an empty model with compact placeholders", () => {
  const rendered = renderRepositoryLearning(emptyModel);

  assert.match(rendered, /^# Repository Learning$/m);
  assert.match(rendered, /Compact learned repository behavior from completed RCC work\./);
  assert.match(rendered, /<!-- repo-context-center:repository-learning:start -->/);
  assert.match(rendered, /<!-- repo-context-center:repository-learning:end -->/);
  assert.match(rendered, /^## Recent Focus Areas$/m);
  assert.match(rendered, /- none detected yet/);
  assert.match(rendered, /\| Source \| Related \| Reason \| Count \|/);
  assert.match(rendered, /\| --- \| --- \| --- \| ---: \|/);
  assert.match(rendered, /\| none detected yet \| - \| - \| - \|/);
  assert.match(rendered, /\| Files \| Count \| Recent summary \|/);
  assert.match(rendered, /\| --- \| ---: \| --- \|/);
  assert.match(rendered, /\| Scope \| Command \| Count \|/);
  assert.doesNotMatch(rendered, /(^|\|)\s*--:\s*(?=\|)/);
  assert.doesNotMatch(rendered, /- Summary:/);
});

test("renderRepositoryLearningBody renders populated model tables", () => {
  const rendered = renderRepositoryLearningBody({
    recentFocusAreas: ["handoff (2)", "work (1)"],
    commonFileRelationships: [{
      source: "handoff",
      related: "tests/handoff.test.js",
      reason: "Observed in completed handoff work",
      count: 2
    }],
    frequentlyModifiedTogether: [{
      files: ["src/cli/handoff/renderJson.ts", "tests/handoff.test.js"],
      count: 2,
      recentSummary: "Fixed handoff source parsing"
    }],
    verificationPatterns: [{
      scope: "handoff",
      command: "node --test tests/handoff.test.js",
      count: 2
    }],
    repositoryHabits: ["Verification commands are recorded with completed work (2/2)."]
  });

  assert.match(rendered, /- handoff \(2\)/);
  assert.match(rendered, /\| handoff \| `tests\/handoff\.test\.js` \| Observed in completed handoff work \| 2 \|/);
  assert.match(rendered, /\| `src\/cli\/handoff\/renderJson\.ts`, `tests\/handoff\.test\.js` \| 2 \| Fixed handoff source parsing \|/);
  assert.match(rendered, /\| handoff \| `node --test tests\/handoff\.test\.js` \| 2 \|/);
  assert.match(rendered, /- Verification commands are recorded with completed work \(2\/2\)\./);
  assert.doesNotMatch(rendered, /(^|\|)\s*--:\s*(?=\|)/);
  assert.doesNotMatch(rendered, /\bwork work\b/);
});

test("renderRepositoryLearningBody uses useful fallback for populated co-change rows", () => {
  const rendered = renderRepositoryLearningBody({
    ...emptyModel,
    frequentlyModifiedTogether: [{
      files: ["src/cli/commands/done.ts", "tests/done.test.js"],
      count: 2,
      recentSummary: null
    }]
  });

  assert.match(rendered, /\| `src\/cli\/commands\/done\.ts`, `tests\/done\.test\.js` \| 2 \| observed together in completed work \|/);
  assert.doesNotMatch(rendered, /\| `src\/cli\/commands\/done\.ts`, `tests\/done\.test\.js` \| 2 \| none detected yet \|/);
});

test("upsertRepositoryLearning preserves manual content outside generated markers", () => {
  const existing = [
    "# Repository Learning",
    "",
    "Manual note before.",
    "",
    "<!-- repo-context-center:repository-learning:start -->",
    "old generated content",
    "<!-- repo-context-center:repository-learning:end -->",
    "",
    "Manual note after.",
    ""
  ].join("\n");
  const rendered = upsertRepositoryLearning(existing, emptyModel);

  assert.match(rendered, /Manual note before\./);
  assert.match(rendered, /Manual note after\./);
  assert.match(rendered, /Compact learned repository behavior|## Recent Focus Areas/);
  assert.doesNotMatch(rendered, /old generated content/);
});

test("upsertRepositoryLearning migrates legacy generic markers", () => {
  const existing = [
    "# Repository Learning",
    "",
    "Manual note before.",
    "",
    "<!-- repo-context-center:generated:start -->",
    "old generated content",
    "<!-- repo-context-center:generated:end -->",
    "",
    "Manual note after.",
    ""
  ].join("\n");
  const rendered = upsertRepositoryLearning(existing, emptyModel);

  assert.match(rendered, /Manual note before\./);
  assert.match(rendered, /Manual note after\./);
  assert.match(rendered, /<!-- repo-context-center:repository-learning:start -->/);
  assert.match(rendered, /<!-- repo-context-center:repository-learning:end -->/);
  assert.doesNotMatch(rendered, /repo-context-center:generated:start/);
  assert.doesNotMatch(rendered, /old generated content/);
});

test("upsertRepositoryLearning appends generated markers when none exist", () => {
  const rendered = upsertRepositoryLearning("# Repository Learning\n\nManual only.\n", emptyModel);

  assert.match(rendered, /Manual only\./);
  assert.match(rendered, /<!-- repo-context-center:repository-learning:start -->/);
  assert.match(rendered, /<!-- repo-context-center:repository-learning:end -->/);
});

test("renderRepositoryLearningBody does not exceed configured limits", () => {
  const many = Array.from({ length: 12 }, (_, index) => index + 1);
  const rendered = renderRepositoryLearningBody({
    recentFocusAreas: many.map((index) => `area ${index}`),
    commonFileRelationships: many.map((index) => ({
      source: `source ${index}`,
      related: `src/file${index}.ts`,
      reason: `reason ${index}`,
      count: index
    })),
    frequentlyModifiedTogether: many.map((index) => ({
      files: [`src/a${index}.ts`, `tests/a${index}.test.js`],
      count: index,
      recentSummary: `summary ${index}`
    })),
    verificationPatterns: many.map((index) => ({
      scope: `scope ${index}`,
      command: `node --test tests/${index}.test.js`,
      count: index
    })),
    repositoryHabits: many.map((index) => `habit ${index}`)
  });

  assert.doesNotMatch(rendered, /area 6/);
  assert.doesNotMatch(rendered, /source 9/);
  assert.doesNotMatch(rendered, /summary 9/);
  assert.doesNotMatch(rendered, /scope 9/);
  assert.doesNotMatch(rendered, /habit 7/);
});
