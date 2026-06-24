const assert = require("node:assert/strict");
const test = require("node:test");

const {
  npmCommand,
  releaseSteps
} = require("../../scripts/release-check.js");

test("release check runs build, tests, benchmarks, pack, and smoke in order", () => {
  assert.deepEqual(releaseSteps("npm-test-bin"), [
    ["npm run build", "npm-test-bin", ["run", "build"]],
    ["npm test", "npm-test-bin", ["test"]],
    ["npm run benchmark:routing", "npm-test-bin", ["run", "benchmark:routing"]],
    ["npm pack --dry-run", "npm-test-bin", ["pack", "--dry-run"]],
    ["npm run smoke:pack-install", "npm-test-bin", ["run", "smoke:pack-install"]]
  ]);
});

test("release check uses the platform npm executable", () => {
  assert.equal(npmCommand(), process.platform === "win32" ? "npm.cmd" : "npm");
});
