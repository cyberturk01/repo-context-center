const assert = require("node:assert/strict");
const { readFile, stat } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const benchmarkScriptNames = ["benchmark:routing", "benchmark:work-repeat"];
const expectedBenchmarkFiles = [
  "scripts/benchmark-routing.js",
  "scripts/benchmark-work-repeat.js"
];
const expectedBenchmarkFixtures = [
  "tests/fixtures/routing-cases.json"
];

async function readPackageJson() {
  return JSON.parse(await readFile(packageJsonPath, "utf8"));
}

function scriptTarget(scriptCommand) {
  const match = /^node\s+(scripts\/[^\s]+\.js)$/.exec(scriptCommand);
  return match?.[1];
}

test("benchmark helper scripts exist", async () => {
  for (const file of [...expectedBenchmarkFiles, ...expectedBenchmarkFixtures]) {
    const fileStat = await stat(path.join(repoRoot, file));
    assert.equal(fileStat.isFile(), true, file);
  }
});

test("benchmark package scripts point to existing helper files", async () => {
  const packageJson = await readPackageJson();

  for (const scriptName of benchmarkScriptNames) {
    const target = scriptTarget(packageJson.scripts?.[scriptName] ?? "");

    assert.ok(target, `${scriptName} should run a scripts/*.js file with node`);
    assert.ok(expectedBenchmarkFiles.includes(target), `${scriptName} points to ${target}`);

    const fileStat = await stat(path.join(repoRoot, target));
    assert.equal(fileStat.isFile(), true, target);
  }
});

test("benchmark helpers stay developer-only and outside runtime CLI packaging", async () => {
  const packageJson = await readPackageJson();
  const runtimeEntries = [
    packageJson.main,
    packageJson.types,
    ...Object.values(packageJson.bin ?? {})
  ];

  assert.deepEqual(runtimeEntries.filter((entry) => entry.includes("benchmark")), []);
  assert.deepEqual((packageJson.files ?? []).filter((entry) => entry === "scripts"), []);

  for (const file of expectedBenchmarkFiles) {
    assert.ok(!runtimeEntries.includes(file), `${file} should not be a runtime entry`);
  }
});
