const assert = require("node:assert/strict");
const test = require("node:test");

const { buildRepositoryUnderstanding } = require("../dist/core/repositoryUnderstanding.js");

const guardianLikeFiles = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "src/cli/index.ts",
  "src/cli/commands/map.ts",
  "src/config/defaults.ts",
  "src/core/config.ts",
  "src/core/repoMapper.ts",
  "src/core/scanner.ts",
  "src/analyzers/index.ts",
  "src/renderers/markdown.ts",
  "src/repo/index.ts",
  "src/project-brain/index.ts",
  "guardian.config.json",
  "examples/basic/guardian.config.json",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  "docs/ai-context/PROJECT_MAP.md",
  "docs/ai-context/archive/2026-01-01.md",
  "tests/cli.test.js",
  "tests/core/config.test.ts",
  "tests/integration/release.ts",
  "tests/fixtures/config.test.ts",
  "tests/fixtures/context.md",
  "tests/__snapshots__/cli.test.js",
  "dist/cli/index.js",
  "coverage/lcov.info"
];

test("RepositoryUnderstanding detects package scripts from package.json", async () => {
  const understanding = await buildRepositoryUnderstanding({
    files: guardianLikeFiles,
    packageJson: {
      scripts: {
        build: "tsc",
        coverage: "c8 npm test",
        lint: "eslint .",
        test: "node --test tests/*.test.js"
      }
    }
  });

  assert.equal(understanding.packageManager, "npm");
  assert.deepEqual(understanding.scripts, {
    build: "tsc",
    coverage: "c8 npm test",
    lint: "eslint .",
    test: "node --test tests/*.test.js"
  });
});

test("RepositoryUnderstanding identifies real test files separately from fixtures and snapshots", async () => {
  const understanding = await buildRepositoryUnderstanding({
    files: guardianLikeFiles,
    packageJson: {}
  });

  assert.deepEqual(understanding.testFiles, [
    "tests/cli.test.js",
    "tests/core/config.test.ts",
    "tests/integration/release.ts"
  ]);
  assert.ok(!understanding.testFiles.includes("tests/fixtures/config.test.ts"));
  assert.ok(!understanding.testFiles.includes("tests/__snapshots__/cli.test.js"));
});

test("RepositoryUnderstanding keeps ignored and generated areas separate", async () => {
  const understanding = await buildRepositoryUnderstanding({
    files: guardianLikeFiles,
    packageJson: {}
  });

  assert.deepEqual(understanding.ignoredAreas, [
    { path: "coverage", reason: "generated" },
    { path: "dist", reason: "generated" },
    { path: "docs/ai-context/archive", reason: "archive" },
    { path: "package-lock.json", reason: "lockfile" },
    { path: "tests/__snapshots__", reason: "snapshot" },
    { path: "tests/fixtures", reason: "fixture" }
  ]);
});

test("RepositoryUnderstanding builds deterministic directories, modules, entrypoints, and config files", async () => {
  const understanding = await buildRepositoryUnderstanding({
    files: guardianLikeFiles,
    packageJson: {
      bin: {
        "repo-context-center": "dist/cli/index.js"
      },
      main: "dist/cli/index.js"
    },
    scanner: {
      modules: [
        { name: "core", path: "src/core", sourceRoot: "src" },
        { name: "cli", path: "src/cli", sourceRoot: "src" }
      ],
      sourceFolders: ["src"],
      testFolders: ["tests"]
    }
  });

  assert.deepEqual(understanding.entrypoints, ["dist/cli/index.js", "src/cli/index.ts"]);
  assert.ok(!understanding.entrypoints.includes("src/analyzers/index.ts"));
  assert.ok(!understanding.entrypoints.includes("src/repo/index.ts"));
  assert.ok(!understanding.entrypoints.includes("src/project-brain/index.ts"));
  assert.deepEqual(understanding.keyDirectories, [
    "`src/cli` - CLI commands and command entrypoints",
    "`src/config` - configuration loading and validation",
    "`src/analyzers` - analysis and rule logic",
    "`src/renderers` - report rendering and output formatting",
    "`src/core` - orchestration and core business logic",
    "`src/repo` - repository scanning and git helpers",
    "`tests` - test coverage, fixtures, and regression cases",
    "`.github/workflows` - CI and release automation",
    "`docs/ai-context` - generated agent context"
  ]);
  assert.deepEqual(understanding.modules, [
    { name: "cli", path: "src/cli", sourceRoot: "src" },
    { name: "core", path: "src/core", sourceRoot: "src" }
  ]);
  assert.deepEqual(understanding.configFiles, [
    "examples/basic/guardian.config.json",
    "guardian.config.json",
    "package.json",
    "tsconfig.json"
  ]);
});
