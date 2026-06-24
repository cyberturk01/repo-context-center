const assert = require("node:assert/strict");
const test = require("node:test");

const {
  failuresFor,
  pad,
  statusFor
} = require("../../scripts/benchmark-routing.js");

test("benchmark routing status passes only when case evaluation has no failures", () => {
  const benchmarkCase = {
    expect: {
      primaryContains: ["src/cli/work/renderAgent.ts"],
      testsContains: ["tests/work.test.js"]
    }
  };
  const passingBrief = {
    primaryFiles: ["src/cli/work/renderAgent.ts"],
    tests: ["tests/work.test.js"]
  };
  const failingBrief = {
    primaryFiles: ["src/cli/work/renderText.ts"],
    tests: []
  };

  assert.deepEqual(failuresFor(passingBrief, benchmarkCase), []);
  assert.equal(statusFor(passingBrief, benchmarkCase), "pass");
  assert.equal(statusFor(failingBrief, benchmarkCase), "fail");
});

test("benchmark routing table padding preserves original cell text", () => {
  assert.equal(pad("Case", 8), "Case    ");
  assert.equal(pad("Longer than width", 4), "Longer than width");
});
