const assert = require("node:assert/strict");
const test = require("node:test");

const {
  analyzeTaskIntent,
  termWeight,
  weightedScore
} = require("../dist/core/taskIntent.js");

test("task intent normalizes Turkish role wording and expands related lookup terms", () => {
  const intent = analyzeTaskIntent("Role lerle ilgili bug ihtimallerini bul");

  assert.equal(intent.normalizedTask, "role ilgili bug ihtimalleri bul");
  assert.ok(intent.rawTokens.includes("role"));
  assert.ok(intent.expandedTerms.includes("roles"));
  assert.ok(intent.expandedTerms.includes("classify"));
  assert.ok(intent.expandedTerms.includes("classification"));
  assert.ok(intent.expandedTerms.includes("repofileclassifier"));
  assert.ok(intent.expandedTerms.includes("authorization"));
  assert.equal(intent.lookupTerms[0], "role");
  assert.equal(intent.nextLookupKeyword, "role");
});

test("workflow risk task prioritizes domain lookup terms over action words", () => {
  const intent = analyzeTaskIntent("find Workflow risks");

  assert.deepEqual(intent.lookupTerms.slice(0, 4), ["workflow", "workflows", "risks", "risk"]);
  assert.ok(!intent.lookupTerms.includes("find"));
  assert.equal(intent.nextLookupKeyword, "workflow");
  assert.equal(intent.hasWorkflowDomain, true);
});

test("action terms receive low direct score weight", () => {
  assert.equal(termWeight("fix"), 0.25);
  assert.equal(weightedScore(100, "fix"), 25);
  assert.equal(termWeight("workflow"), 1.35);
  assert.equal(weightedScore(100, "workflow"), 135);
});

test("explicit command task preserves command-name action terms", () => {
  const intent = analyzeTaskIntent("fix rcc find command");

  assert.equal(intent.isExplicitCommandTask, true);
  assert.ok(intent.lookupTerms.includes("find"));
  assert.ok(!intent.lookupTerms.includes("rcc"));
  assert.ok(!intent.lookupTerms.includes("command"));
  assert.equal(intent.nextLookupKeyword, "find");
});

test("low-signal task terms are excluded from lookup terms", () => {
  const intent = analyzeTaskIntent("fix possible issue");

  assert.deepEqual(intent.lookupTerms, []);
  assert.ok(intent.lowSignalTerms.includes("fix"));
  assert.ok(intent.lowSignalTerms.includes("possible"));
  assert.ok(intent.lowSignalTerms.includes("issue"));
});

test("code investigation detection includes English and Turkish signals", () => {
  assert.equal(analyzeTaskIntent("inspect auth bug").isCodeInvestigation, true);
  assert.equal(analyzeTaskIntent("hata ihtimallerini bul").isCodeInvestigation, true);
  assert.equal(analyzeTaskIntent("write release notes").isCodeInvestigation, false);
});

test("workflow-domain detection includes expanded CI and release signals", () => {
  assert.equal(analyzeTaskIntent("inspect ci release risk").hasWorkflowDomain, true);
  assert.equal(analyzeTaskIntent("fix login bug").hasWorkflowDomain, false);
});

test("next lookup keyword follows filtered lookup term order", () => {
  assert.equal(analyzeTaskIntent("find Workflow risks").nextLookupKeyword, "workflow");
  assert.equal(analyzeTaskIntent("fix rcc find command").nextLookupKeyword, "find");
  assert.equal(analyzeTaskIntent("fix possible issue").nextLookupKeyword, null);
});
