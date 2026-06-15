const assert = require("node:assert/strict");
const test = require("node:test");

const { classifyRepoFile } = require("../dist/core/repoFileClassifier.js");

test("RepoFileClassifier classifies JS and TS source and test paths", () => {
  assert.deepEqual(pick("src/core/suggester.ts"), {
    role: "source",
    isNoise: false,
    isLikelyEntrypoint: false,
    language: "typescript",
    packageScope: undefined
  });

  assert.deepEqual(pick("app/components/Button.tsx"), {
    role: "source",
    isNoise: false,
    isLikelyEntrypoint: false,
    language: "typescriptreact",
    packageScope: undefined
  });

  assert.deepEqual(pick("tests/core/suggester.test.js"), {
    role: "test",
    isNoise: false,
    isLikelyEntrypoint: false,
    language: "javascript",
    packageScope: undefined
  });

  assert.deepEqual(pick("src/core/suggester.spec.ts"), {
    role: "test",
    isNoise: false,
    isLikelyEntrypoint: false,
    language: "typescript",
    packageScope: undefined
  });
});

test("RepoFileClassifier classifies Python test filename patterns", () => {
  assert.equal(classifyRepoFile("src/auth/test_tokens.py").role, "test");
  assert.equal(classifyRepoFile("src/auth/tokens_test.py").role, "test");
  assert.equal(classifyRepoFile("src/auth/tokens.py").role, "source");
  assert.equal(classifyRepoFile("src/auth/test_tokens.py").language, "python");
});

test("RepoFileClassifier detects monorepo package scope and package source/test paths", () => {
  assert.deepEqual(pick("packages/core/src/index.ts"), {
    role: "source",
    isNoise: false,
    isLikelyEntrypoint: true,
    language: "typescript",
    packageScope: "packages/core"
  });

  assert.deepEqual(pick("libs/auth/test_auth.py"), {
    role: "test",
    isNoise: false,
    isLikelyEntrypoint: false,
    language: "python",
    packageScope: "libs/auth"
  });

  assert.deepEqual(pick("libs/auth/tests/session_test.py"), {
    role: "test",
    isNoise: false,
    isLikelyEntrypoint: false,
    language: "python",
    packageScope: "libs/auth"
  });
});

test("RepoFileClassifier classifies workflow files", () => {
  assert.equal(classifyRepoFile(".github/workflows/ci.yml").role, "workflow");
  assert.equal(classifyRepoFile(".gitlab-ci.yml").role, "workflow");
  assert.equal(classifyRepoFile("Jenkinsfile").role, "workflow");
});

test("RepoFileClassifier classifies docs", () => {
  assert.equal(classifyRepoFile("README.md").role, "docs");
  assert.equal(classifyRepoFile("docs/ai-context/PROJECT_MAP.md").role, "docs");
  assert.equal(classifyRepoFile("CHANGELOG.md").role, "docs");
});

test("RepoFileClassifier marks generated files, fixtures, and snapshots as noise", () => {
  assert.deepEqual(pick("dist/tests/generated.test.js"), {
    role: "generated",
    isNoise: true,
    isLikelyEntrypoint: false,
    language: "javascript",
    packageScope: undefined
  });

  assert.deepEqual(pick("tests/fixtures/data.json"), {
    role: "fixture",
    isNoise: true,
    isLikelyEntrypoint: false,
    language: "json",
    packageScope: undefined
  });

  assert.deepEqual(pick("tests/__snapshots__/cli.test.js.snap"), {
    role: "snapshot",
    isNoise: true,
    isLikelyEntrypoint: false,
    language: undefined,
    packageScope: undefined
  });
});

test("RepoFileClassifier classifies package files", () => {
  assert.equal(classifyRepoFile("package.json").role, "package");
  assert.equal(classifyRepoFile("package-lock.json").role, "package");
  assert.equal(classifyRepoFile("pnpm-lock.yaml").role, "package");
  assert.equal(classifyRepoFile("yarn.lock").role, "package");
  assert.equal(classifyRepoFile("pyproject.toml").role, "package");
  assert.equal(classifyRepoFile("Cargo.toml").role, "package");
  assert.equal(classifyRepoFile("go.mod").role, "package");
  assert.equal(classifyRepoFile("pom.xml").role, "package");
  assert.equal(classifyRepoFile("build.gradle").role, "package");
});

function pick(filePath) {
  const info = classifyRepoFile(filePath);

  return {
    role: info.role,
    isNoise: info.isNoise,
    isLikelyEntrypoint: info.isLikelyEntrypoint,
    language: info.language,
    packageScope: info.packageScope
  };
}
