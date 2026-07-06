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

test("RepoFileClassifier recognizes app and service workspace source roots", () => {
  assert.equal(classifyRepoFile("apps/dashboard/src/reservations/ReservationFoundation.tsx").role, "source");
  assert.equal(classifyRepoFile("services/admin/app/pages/Home.jsx").role, "source");
});

test("RepoFileClassifier classifies workflow files", () => {
  assert.equal(classifyRepoFile(".github/workflows/ci.yml").role, "workflow");
  assert.equal(classifyRepoFile(".Github/workflows/ci.yml").role, "workflow");
  assert.equal(classifyRepoFile(".gitlab-ci.yml").role, "workflow");
  assert.equal(classifyRepoFile("Jenkinsfile").role, "workflow");
});

test("RepoFileClassifier handles case-insensitive package and config filenames", () => {
  assert.equal(classifyRepoFile("Package.json").role, "package");
  assert.equal(classifyRepoFile("package.json").role, "package");
  assert.equal(classifyRepoFile("Cargo.toml").role, "package");
  assert.equal(classifyRepoFile("cargo.toml").role, "package");
  assert.equal(classifyRepoFile("Dockerfile").role, "config");
  assert.equal(classifyRepoFile("dockerfile").role, "config");
});

test("RepoFileClassifier classifies static assets before source or docs layout", () => {
  assert.equal(classifyRepoFile("src/logo.svg").role, "asset");
  assert.equal(classifyRepoFile("src/assets/logo.png").role, "asset");
  assert.equal(classifyRepoFile("docs/assets/diagram.svg").role, "asset");
  assert.equal(classifyRepoFile("docs/assets/notes.md").role, "docs");
  assert.equal(classifyRepoFile("src/assets/generateLogo.ts").role, "source");
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

  for (const filePath of [
    ".turbo/cache/file.js",
    ".venv/lib/file.py",
    "public/build/app.js",
    ".cache/vite/file.js",
    ".pytest_cache/v/cache/nodeids",
    ".mypy_cache/module.json",
    ".parcel-cache/file.js",
    "out/server.js",
    "vendor/library/file.py"
  ]) {
    assert.equal(classifyRepoFile(filePath).role, "generated", filePath);
    assert.equal(classifyRepoFile(filePath).isNoise, true, filePath);
  }
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
