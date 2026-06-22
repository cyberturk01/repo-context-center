const assert = require("node:assert/strict");
const test = require("node:test");

const { classifyTaskSize } = require("../dist/cli/work/taskSize.js");

test("typo tasks are tiny fast fixes", () => {
  const classification = classifyTaskSize("fix workfor typo");

  assert.equal(classification.size, "tiny");
  assert.equal(classification.mode, "fast_fix");
  assert.equal(classification.confidence, "high");
  assert.deepEqual(classification.reasons, ["typo"]);
});

test("small CLI bugs are small fast fixes", () => {
  const classification = classifyTaskSize("fix small CLI bug");

  assert.equal(classification.size, "small");
  assert.equal(classification.mode, "fast_fix");
  assert.ok(classification.reasons.includes("small bug"));
});

test("JSON output tasks are medium normal work", () => {
  const classification = classifyTaskSize("add JSON output for work briefs");

  assert.equal(classification.size, "medium");
  assert.equal(classification.mode, "normal");
  assert.ok(classification.reasons.includes("JSON output"));
});

test("architecture refactors are large deep work", () => {
  const classification = classifyTaskSize("refactor the handoff architecture");

  assert.equal(classification.size, "large");
  assert.equal(classification.mode, "deep");
  assert.equal(classification.confidence, "high");
});

test("empty or unclear tasks default to medium normal with low confidence", () => {
  for (const task of ["", "   ", "make it better"]) {
    const classification = classifyTaskSize(task);

    assert.equal(classification.size, "medium");
    assert.equal(classification.mode, "normal");
    assert.equal(classification.confidence, "low");
  }
});
