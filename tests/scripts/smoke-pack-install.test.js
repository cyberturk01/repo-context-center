const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parsePackOutput,
  validateInstalledWorkRoute
} = require("../../scripts/smoke-pack-install.js");

test("smoke pack install parses the single npm pack filename", () => {
  assert.deepEqual(
    parsePackOutput(JSON.stringify([{ name: "repo-context-center", version: "0.10.1", filename: "repo-context-center-0.10.1.tgz" }])),
    { name: "repo-context-center", version: "0.10.1", filename: "repo-context-center-0.10.1.tgz" }
  );
});

test("smoke pack install rejects ambiguous or malformed npm pack output", () => {
  assert.throws(
    () => parsePackOutput(JSON.stringify([])),
    /npm pack --json did not return a single package filename/
  );
  assert.throws(
    () => parsePackOutput(JSON.stringify([{ filename: "a.tgz" }, { filename: "b.tgz" }])),
    /npm pack --json did not return a single package filename/
  );
  assert.throws(
    () => parsePackOutput(JSON.stringify([{ name: "repo-context-center" }])),
    /npm pack --json did not return a single package filename/
  );
});

test("smoke pack install validates compact agent route shape", () => {
  assert.doesNotThrow(() => validateInstalledWorkRoute({
    primaryFiles: ["src/cli/work/renderAgent.ts"],
    briefTokens: 42
  }));
  assert.throws(
    () => validateInstalledWorkRoute({ primaryFiles: "src/cli/work/renderAgent.ts", briefTokens: 42 }),
    /compact JSON shape/
  );
  assert.throws(
    () => validateInstalledWorkRoute({ primaryFiles: [], briefTokens: "42" }),
    /compact JSON shape/
  );
});
