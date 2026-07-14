const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const {
  evaluateLearningQuality,
  learningDuplicateKey
} = require("../dist/core/learningQuality.js");
const {
  buildRepositoryLearningModelFromEntries
} = require("../dist/core/repositoryLearning.js");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const learningCases = require("./fixtures/learning-cases.json");

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

async function withTempRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-learning-quality-"));

  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function entry(index, summary, files, verification = []) {
  return {
    files,
    followUps: [],
    risks: [],
    summary,
    timestamp: `2026-06-23T10:${String(index).padStart(2, "0")}:00.000Z`,
    verification
  };
}

test("learning quality fixture covers high, medium, and low-value decisions", () => {
  assert.ok(learningCases.length >= 8);
  assert.ok(learningCases.some((item) => item.expect.signal === "high"));
  assert.ok(learningCases.some((item) => item.expect.signal === "low"));
});

test("learning quality evaluator classifies representative tasks", () => {
  for (const learningCase of learningCases) {
    const evaluation = evaluateLearningQuality(learningCase);

    assert.equal(evaluation.signal, learningCase.expect.signal, learningCase.name);
    assert.equal(evaluation.shouldLearn, learningCase.expect.shouldLearn, learningCase.name);
    assert.equal(typeof evaluation.score, "number", learningCase.name);
    assert.equal(typeof evaluation.confidence, "number", learningCase.name);
    assert.ok(evaluation.score >= 0 && evaluation.score <= 1, learningCase.name);
    assert.ok(evaluation.confidence >= 0 && evaluation.confidence <= 1, learningCase.name);
    assert.ok(evaluation.reasons.length > 0, learningCase.name);
  }
});

test("learning recommendation favors fewer but higher-signal entries", () => {
  const shouldLearn = [
    "introduced routing benchmark",
    "added release safety guard",
    "implemented handoff memory",
    "improved workflow verification"
  ];
  const shouldSkip = [
    "fixed typo",
    "renamed variable",
    "adjusted spacing",
    "updated comment wording"
  ];

  for (const summary of shouldLearn) {
    const evaluation = evaluateLearningQuality({
      files: ["src/cli/work/taskFileRecommendations.ts", "tests/work.test.js"],
      summary,
      verification: ["npm test"]
    });
    assert.equal(evaluation.shouldLearn, true, summary);
    assert.ok(["medium", "high"].includes(evaluation.signal), summary);
  }

  for (const summary of shouldSkip) {
    const evaluation = evaluateLearningQuality({
      files: ["src/cli/work/renderAgent.ts"],
      summary,
      verification: ["node --test tests/work.test.js"]
    });
    assert.equal(evaluation.shouldLearn, false, summary);
    assert.equal(evaluation.signal, "low", summary);
  }
});

test("repository learning ignores repeated low-value duplicates", () => {
  const model = buildRepositoryLearningModelFromEntries([
    entry(1, "fixed typo", ["src/cli/work/renderAgent.ts"], ["node --test tests/work.test.js"]),
    entry(2, "fix typo in renderAgent output", ["src/cli/work/renderAgent.ts"], ["node --test tests/work.test.js"]),
    entry(3, "fixed typo in renderAgent output", ["src/cli/work/renderAgent.ts"], ["node --test tests/work.test.js"])
  ]);

  assert.deepEqual(model.recentFocusAreas, []);
  assert.deepEqual(model.commonFileRelationships, []);
  assert.deepEqual(model.frequentlyModifiedTogether, []);
  assert.deepEqual(model.verificationPatterns, []);
});

test("repository learning keeps legitimate repeated architectural patterns", () => {
  const model = buildRepositoryLearningModelFromEntries([
    entry(1, "decouple work command modules", ["src/cli/commands/work.ts", "tests/work.test.js"], ["node --test tests/work.test.js"]),
    entry(2, "decouple work command modules", ["src/cli/work/buildWorkBrief.ts", "tests/work.test.js"], ["node --test tests/work.test.js"]),
    entry(3, "improve Turkish task routing", ["src/core/taskIntent.ts", "tests/taskIntent.test.js"], ["node --test tests/taskIntent.test.js"])
  ]);

  assert.ok(model.recentFocusAreas.some((area) => area.startsWith("work ")), model.recentFocusAreas.join("\n"));
  assert.equal(model.commonFileRelationships.some((item) => item.related === "tests/work.test.js" && item.count === 2), true);
  assert.equal(model.verificationPatterns.some((item) => item.command === "node --test tests/work.test.js" && item.count === 2), true);
});

test("near-identical low-value summaries normalize to the same duplicate key", () => {
  assert.equal(learningDuplicateKey("fixed typo"), learningDuplicateKey("fixing the typo"));
  assert.equal(learningDuplicateKey("adjusted spacing in renderer"), learningDuplicateKey("fix spacing renderer"));
});

test("done --files auto does not learn from low-confidence dirty worktree files", async () => {
  await withTempRepo(async (tempDir) => {
    spawnSync("git", ["init"], { cwd: tempDir, encoding: "utf8" });
    await writeFixtureFile(tempDir, "src/cli/work/renderAgent.ts", "export const agent = true;\n");
    await writeFixtureFile(tempDir, "src/unrelated.ts", "export const unrelated = true;\n");
    await writeFixtureFile(tempDir, "README.md", "# Dirty docs\n");

    const result = runCli([
      "done",
      "--summary",
      "fixed typo",
      "--files",
      "auto",
      "--verify",
      "node --test tests/work.test.js"
    ], { cwd: tempDir });
    const workLog = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_LOG.md"), "utf8");
    const workIndex = await readFile(path.join(tempDir, "docs", "ai-context", "WORK_INDEX.md"), "utf8");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /RCC learning skipped: docs\/ai-context\/REPOSITORY_LEARNING\.md \(tiny\/noise task; use --learn to force\)/);
    assert.match(result.stdout, /Changed files: README\.md, src\/cli\/work\/renderAgent\.ts, src\/unrelated\.ts/);
    assert.match(workLog, /- files: README\.md, src\/cli\/work\/renderAgent\.ts, \+1/);
    assert.match(workIndex, /fixed typo/);
    await assert.rejects(
      () => readFile(path.join(tempDir, "docs", "ai-context", "REPOSITORY_LEARNING.md"), "utf8"),
      { code: "ENOENT" }
    );
  });
});
