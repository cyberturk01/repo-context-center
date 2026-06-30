const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const {
  detectDomains,
  taskMentionsDomain
} = require(path.join(repoRoot, "dist", "core", "domainEngine.js"));

function domain(matches, name) {
  return matches.find((match) => match.domain === name);
}

test("DomainEngine returns structured task and path evidence", () => {
  const matches = detectDomains({
    task: "fix auth login session handling",
    affectedFilePaths: ["src/auth/sessionMiddleware.ts"],
    affectedTestPaths: ["tests/auth/sessionMiddleware.test.ts"]
  });
  const auth = domain(matches, "auth");
  const login = domain(matches, "login");

  assert.ok(auth);
  assert.ok(login);
  assert.equal(typeof auth.confidence, "number");
  assert.ok(auth.confidence > 0);
  assert.deepEqual(auth.matchedPaths, [
    "src/auth/sessionMiddleware.ts",
    "tests/auth/sessionMiddleware.test.ts"
  ]);
  assert.ok(auth.signals.some((signal) => signal.source === "task text" && signal.value === "auth"));
  assert.ok(auth.signals.some((signal) => signal.source === "affected file path" && signal.path === "src/auth/sessionMiddleware.ts"));
  assert.ok(auth.signals.some((signal) => signal.source === "affected test path" && signal.path === "tests/auth/sessionMiddleware.test.ts"));
});

test("DomainEngine ignores test-only domain evidence", () => {
  const matches = detectDomains({
    task: "update markdown formatting",
    affectedTestPaths: ["tests/auth/login.test.ts"]
  });

  assert.equal(domain(matches, "auth"), undefined);
  assert.equal(domain(matches, "login"), undefined);
});

test("DomainEngine separates workflow and GitHub integration paths", () => {
  const matches = detectDomains({
    task: "tighten github actions permissions",
    affectedFilePaths: [
      ".github/workflows/release.yaml",
      "src/integrations/githubWebhook.ts"
    ]
  });

  assert.deepEqual(domain(matches, "workflow").matchedPaths, [".github/workflows/release.yaml"]);
  assert.deepEqual(domain(matches, "github-integration").matchedPaths, ["src/integrations/githubWebhook.ts"]);
});

test("DomainEngine supports API and context domains with evidence sources", () => {
  const matches = detectDomains({
    task: "update api contract and rcc context",
    affectedFilePaths: ["src/api/public.ts"],
    contextPaths: ["docs/ai-context/TASK_ROUTING.md"],
    includeContext: true
  });
  const api = domain(matches, "api");
  const context = domain(matches, "context");

  assert.ok(api);
  assert.deepEqual(api.matchedPaths, ["src/api/public.ts"]);
  assert.ok(api.signals.some((signal) => signal.source === "task text" && signal.value === "api"));
  assert.ok(context);
  assert.deepEqual(context.matchedPaths, ["docs/ai-context/TASK_ROUTING.md"]);
  assert.ok(context.signals.every((signal) => signal.source === "context path"));
  assert.equal(taskMentionsDomain("refresh repo context routing", "context"), true);
});
