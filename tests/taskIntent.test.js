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

test("generic task verbs do not lead agent handover lookup terms", () => {
  const intent = analyzeTaskIntent("continue agent handover implementation");

  assert.deepEqual(intent.rawTokens, ["continue", "agent", "handover", "implementation"]);
  assert.deepEqual(intent.lookupTerms.slice(0, 2), ["agent", "handover"]);
  assert.ok(!intent.lookupTerms.includes("continue"));
  assert.ok(!intent.lookupTerms.includes("implementation"));
  assert.equal(intent.nextLookupKeyword, "agent");
});

test("generic action words are filtered from handoff json lookup terms", () => {
  const intent = analyzeTaskIntent("fix handoff json output");

  assert.ok(intent.lookupTerms.includes("handoff"));
  assert.ok(intent.lookupTerms.includes("json"));
  assert.ok(!intent.lookupTerms.includes("fix"));
  assert.equal(intent.nextLookupKeyword, "handoff");
});

test("generic update verb is filtered from workflow validation lookup terms", () => {
  const intent = analyzeTaskIntent("update workflow validation");

  assert.ok(intent.lookupTerms.includes("workflow"));
  assert.ok(intent.lookupTerms.includes("validation"));
  assert.ok(!intent.lookupTerms.includes("update"));
  assert.equal(intent.nextLookupKeyword, "workflow");
});

test("generic-only tasks do not keep noisy fallback lookup terms", () => {
  const intent = analyzeTaskIntent("continue implementation");

  assert.deepEqual(intent.lookupTerms, []);
  assert.equal(intent.nextLookupKeyword, null);
});

test("generic action words are ignored while technical terms remain", () => {
  const intent = analyzeTaskIntent("fix bug issue update improve change refactor cleanup login auth cache redis workflow docker");

  for (const genericTerm of ["fix", "bug", "issue", "update", "improve", "change", "refactor", "cleanup"]) {
    assert.equal(intent.lookupTerms.includes(genericTerm), false, `${genericTerm} should not be a lookup term`);
  }
  for (const technicalTerm of ["login", "auth", "cache", "redis", "workflow", "docker"]) {
    assert.equal(intent.lookupTerms.includes(technicalTerm), true, `${technicalTerm} should remain a lookup term`);
  }
  assert.equal(intent.nextLookupKeyword, "login");
});

test("code investigation detection includes English and Turkish signals", () => {
  assert.equal(analyzeTaskIntent("inspect auth bug").isCodeInvestigation, true);
  assert.equal(analyzeTaskIntent("hata ihtimallerini bul").isCodeInvestigation, true);
  assert.equal(analyzeTaskIntent("write release notes").isCodeInvestigation, false);
});

test("workflow-domain detection includes expanded CI and release signals", () => {
  assert.equal(analyzeTaskIntent("inspect ci release risk").hasWorkflowDomain, true);
  assert.equal(analyzeTaskIntent("inspect ci release risk").hasCiWorkflowIntent, true);
  assert.equal(analyzeTaskIntent("fix login bug").hasWorkflowDomain, false);
});

test("release hardening output tasks prioritize report contract terms over broad product words", () => {
  const intent = analyzeTaskIntent("Prepare AI Project Guardian v0.1.5 release hardening for Phase 7C QA evidence JSON Markdown SARIF output");

  assert.equal(intent.hasReleaseIntent, true);
  assert.equal(intent.hasCiWorkflowIntent, false);
  assert.deepEqual(intent.lookupTerms.slice(0, 6), ["qa", "evidence", "json", "markdown", "sarif", "report"]);
  assert.ok(!intent.lookupTerms.includes("guardian"));
  assert.ok(!intent.lookupTerms.includes("project"));
  assert.ok(!intent.lookupTerms.includes("release"));
  assert.equal(intent.nextLookupKeyword, "qa");
});

test("routing implementation intent overrides workflow CI intent", () => {
  const turkishIntent = analyzeTaskIntent("workflow tasklari icin turkce routing duzelt");
  const englishIntent = analyzeTaskIntent("fix Turkish task routing for workflow tasks");

  assert.equal(turkishIntent.hasRoutingImplementationIntent, true);
  assert.equal(turkishIntent.hasWorkflowDomain, true);
  assert.equal(turkishIntent.hasCiWorkflowIntent, false);
  assert.equal(turkishIntent.lookupTerms[0], "routing");
  assert.ok(turkishIntent.lookupTerms.indexOf("routing") < turkishIntent.lookupTerms.indexOf("workflow"));

  assert.equal(englishIntent.hasRoutingImplementationIntent, true);
  assert.equal(englishIntent.hasCiWorkflowIntent, false);
  assert.equal(analyzeTaskIntent("fix GitHub Actions workflow").hasRoutingImplementationIntent, false);
  assert.equal(analyzeTaskIntent("fix GitHub Actions workflow").hasCiWorkflowIntent, true);
});

test("documentation workflow intent does not imply CI workflow intent", () => {
  const intent = analyzeTaskIntent("document the new agent workflow in README");

  assert.equal(intent.hasDocumentationIntent, true);
  assert.equal(intent.hasWorkflowDomain, true);
  assert.equal(intent.hasCiWorkflowIntent, false);
});

test("version strings alone do not imply release intent", () => {
  assert.equal(analyzeTaskIntent("update README for v1.0 roadmap").hasReleaseIntent, false);
  assert.equal(analyzeTaskIntent("prepare npm release for v1.0").hasReleaseIntent, true);
});

test("next lookup keyword follows filtered lookup term order", () => {
  assert.equal(analyzeTaskIntent("find Workflow risks").nextLookupKeyword, "workflow");
  assert.equal(analyzeTaskIntent("fix rcc find command").nextLookupKeyword, "find");
  assert.equal(analyzeTaskIntent("fix possible issue").nextLookupKeyword, null);
});
