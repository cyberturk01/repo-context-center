const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

async function writeFixtureFile(root, relativePath, content = "") {
  const fullPath = path.join(root, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

async function withFixtureRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-ecosystem-"));

  try {
    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function ids(report) {
  return report.detections.map((detection) => detection.id);
}

test("ecosystem detector recognizes Maven repositories", async () => {
  await withFixtureRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "pom.xml", "<project></project>\n");
    const { detectRepositoryEcosystems } = require("../dist/core/ecosystemDetector");
    const report = await detectRepositoryEcosystems(tempDir);

    assert.equal(report.primary.id, "maven");
    assert.equal(report.primary.confidence, "high");
    assert.deepEqual(report.primary.matchedSignals, ["pom.xml"]);
    assert.equal(report.primary.rootPath, ".");
  });
});

test("ecosystem detector recognizes Gradle repositories", async () => {
  await withFixtureRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "build.gradle.kts", "plugins {}\n");
    await writeFixtureFile(tempDir, "gradlew", "");
    const { detectRepositoryEcosystems } = require("../dist/core/ecosystemDetector");
    const report = await detectRepositoryEcosystems(tempDir);

    assert.equal(report.primary.id, "gradle");
    assert.equal(report.primary.confidence, "high");
    assert.ok(report.primary.matchedSignals.includes("build.gradle.kts"));
    assert.ok(report.primary.matchedSignals.includes("gradlew"));
  });
});

test("ecosystem detector recognizes Python repositories", async () => {
  await withFixtureRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "pyproject.toml", "[project]\nname = \"fixture\"\n[tool.pytest.ini_options]\ntestpaths = [\"tests\"]\n");
    await writeFixtureFile(tempDir, "requirements.txt", "pytest\n");
    const { detectRepositoryEcosystems } = require("../dist/core/ecosystemDetector");
    const report = await detectRepositoryEcosystems(tempDir);

    assert.equal(report.primary.id, "python");
    assert.equal(report.primary.confidence, "high");
    assert.ok(report.primary.matchedSignals.includes("pyproject.toml"));
    assert.ok(report.primary.matchedSignals.includes("requirements.txt"));
    assert.ok(report.primary.matchedSignals.includes("pyproject.toml#pytest"));
    assert.ok(report.primary.matchedSignals.includes("requirements.txt#pytest"));
  });
});

test("ecosystem detector recognizes Python repositories from pyproject.toml", async () => {
  await withFixtureRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "pyproject.toml", "[project]\nname = \"fixture\"\n");
    const { detectRepositoryEcosystems } = require("../dist/core/ecosystemDetector");
    const report = await detectRepositoryEcosystems(tempDir);

    assert.equal(report.primary.id, "python");
    assert.equal(report.primary.confidence, "high");
    assert.deepEqual(report.primary.matchedSignals, ["pyproject.toml"]);
  });
});

test("ecosystem detector recognizes Python repositories from requirements.txt", async () => {
  await withFixtureRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "requirements.txt", "fastapi\nuvicorn\n");
    const { detectRepositoryEcosystems } = require("../dist/core/ecosystemDetector");
    const report = await detectRepositoryEcosystems(tempDir);

    assert.equal(report.primary.id, "python");
    assert.equal(report.primary.confidence, "medium");
    assert.deepEqual(report.primary.matchedSignals, ["requirements.txt"]);
  });
});

test("ecosystem detector recognizes Go repositories", async () => {
  await withFixtureRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "go.mod", "module example.com/fixture\n");
    const { detectRepositoryEcosystems } = require("../dist/core/ecosystemDetector");
    const report = await detectRepositoryEcosystems(tempDir);

    assert.equal(report.primary.id, "go");
    assert.equal(report.primary.confidence, "high");
    assert.deepEqual(report.primary.matchedSignals, ["go.mod"]);
  });
});

test("ecosystem detector recognizes Go modules inside service monorepos", async () => {
  await withFixtureRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "services/accounts/go.mod", "module example.com/accounts\n");
    await writeFixtureFile(tempDir, "services/billing/go.mod", "module example.com/billing\n");
    const { detectRepositoryEcosystems } = require("../dist/core/ecosystemDetector");
    const report = await detectRepositoryEcosystems(tempDir);

    assert.ok(ids(report).includes("go"));
    assert.ok(ids(report).includes("monorepo"));
    assert.ok(report.detections.some((detection) => (
      detection.id === "go"
      && detection.rootPath === "services/accounts"
      && detection.matchedSignals.includes("services/accounts/go.mod")
    )));
    assert.ok(report.detections.some((detection) => (
      detection.id === "go"
      && detection.rootPath === "services/billing"
      && detection.matchedSignals.includes("services/billing/go.mod")
    )));
  });
});

test("ecosystem detector recognizes dotnet repositories", async () => {
  await withFixtureRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "Fixture.sln", "");
    await writeFixtureFile(tempDir, "Fixture.csproj", "<Project />\n");
    const { detectRepositoryEcosystems } = require("../dist/core/ecosystemDetector");
    const report = await detectRepositoryEcosystems(tempDir);

    assert.equal(report.primary.id, "dotnet");
    assert.equal(report.primary.confidence, "high");
    assert.ok(report.primary.matchedSignals.includes("Fixture.csproj"));
    assert.ok(report.primary.matchedSignals.includes("Fixture.sln"));
  });
});

test("ecosystem detector preserves Node as the primary ecosystem for Node repositories", async () => {
  await withFixtureRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "package.json", JSON.stringify({ scripts: { test: "node --test" } }, null, 2));
    await writeFixtureFile(tempDir, "package-lock.json", "{}\n");
    const { detectRepositoryEcosystems } = require("../dist/core/ecosystemDetector");
    const report = await detectRepositoryEcosystems(tempDir);

    assert.equal(report.primary.id, "node");
    assert.equal(report.primary.confidence, "high");
    assert.deepEqual(report.primary.matchedSignals, ["package.json", "package-lock.json"]);
    assert.equal(ids(report).includes("monorepo"), false);
  });
});

test("ecosystem detector recognizes mixed workspace-style monorepos", async () => {
  await withFixtureRepo(async (tempDir) => {
    await writeFixtureFile(tempDir, "package.json", JSON.stringify({
      private: true,
      workspaces: ["packages/*", "services/*"]
    }, null, 2));
    await writeFixtureFile(tempDir, "packages/web/package.json", JSON.stringify({ name: "web" }, null, 2));
    await writeFixtureFile(tempDir, "services/api/pom.xml", "<project></project>\n");
    await writeFixtureFile(tempDir, "services/worker/go.mod", "module example.com/worker\n");
    const { detectRepositoryEcosystems } = require("../dist/core/ecosystemDetector");
    const report = await detectRepositoryEcosystems(tempDir);

    assert.equal(report.primary.id, "node");
    assert.ok(ids(report).includes("maven"));
    assert.ok(ids(report).includes("go"));
    assert.ok(ids(report).includes("monorepo"));
    assert.ok(report.detections.some((detection) => detection.id === "node" && detection.rootPath === "packages/web"));
    assert.ok(report.detections.some((detection) => detection.id === "maven" && detection.rootPath === "services/api"));
    assert.ok(report.detections.some((detection) => detection.id === "go" && detection.rootPath === "services/worker"));
    assert.ok(report.detections.find((detection) => detection.id === "monorepo").matchedSignals.includes("package.json#workspaces"));
  });
});
