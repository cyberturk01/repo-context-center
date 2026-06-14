const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const generatedStart = "<!-- repo-context-center:generated:start -->";
const generatedEnd = "<!-- repo-context-center:generated:end -->";

function runCli(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8"
  });
}

async function writeFixture(root, filePath, content) {
  await mkdir(path.dirname(path.join(root, filePath)), { recursive: true });
  await writeFile(path.join(root, filePath), content, "utf8");
}

function generatedSection(content) {
  const start = content.indexOf(generatedStart);
  const end = content.indexOf(generatedEnd);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.ok(end > start);

  return content.slice(start, end + generatedEnd.length);
}

async function withMappedRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-map-"));

  try {
    const initResult = runCli(tempDir, ["init"]);
    assert.equal(initResult.status, 0);

    await writeFixture(tempDir, "package.json", JSON.stringify({
      scripts: {
        build: "tsc",
        test: "node --test tests/*.test.js",
        lint: "eslint ."
      }
    }, null, 2));
    await writeFixture(
      tempDir,
      "src/cli/index.ts",
      "import { loadConfig } from '../core/config';\nexport function runCli() { return loadConfig(); }\n"
    );
    await writeFixture(
      tempDir,
      "src/core/config.ts",
      "export function loadConfig() { return {}; }\nexport function validateConfig() { return true; }\n"
    );
    await writeFixture(
      tempDir,
      "src/core/scanner.ts",
      "export function scanRepository() { return []; }\n"
    );
    await writeFixture(
      tempDir,
      "src/auth/session.ts",
      "import { DbClient } from '../db/client';\nexport function requireSession() { return new DbClient(); }\n"
    );
    await writeFixture(tempDir, "src/db/client.ts", "export class DbClient {}\n");
    await writeFixture(tempDir, "src/email/sendMail.ts", "export function sendMail() { return true; }\n");
    await writeFixture(tempDir, "tests/auth/session.test.ts", "import { requireSession } from '../../src/auth/session';\n");
    await writeFixture(tempDir, "tests/core/config.test.ts", "import { loadConfig } from '../../src/core/config';\n");
    await writeFixture(tempDir, ".github/workflows/ci.yml", "name: ci\n");
    await mkdir(path.join(tempDir, "dist"), { recursive: true });

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withGuardianLikeRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-guardian-map-"));

  try {
    assert.equal(runCli(tempDir, ["init"]).status, 0);

    const files = {
      "package.json": JSON.stringify({
        bin: {
          "repo-context-center": "./dist/cli/index.js"
        },
        main: "./dist/cli/index.js",
        scripts: {
          build: "tsc",
          coverage: "c8 npm test",
          lint: "eslint .",
          test: "node --test tests/*.test.js"
        }
      }, null, 2),
      "src/cli/index.ts": "export function runCli() { return true; }\n",
      "src/cli/commands/map.ts": "export function mapCommand() { return true; }\n",
      "src/config/defaults.ts": "export const defaults = {};\n",
      "src/core/config.ts": "export function loadConfig() { return {}; }\n",
      "src/core/validator.ts": "export function validateConfig() { return true; }\n",
      "src/analyzers/index.ts": "export function createAnalyzer() { return true; }\n",
      "src/renderers/markdown.ts": "export function renderMarkdown() { return true; }\n",
      "src/repo/index.ts": "export function createRepo() { return true; }\n",
      "src/project-brain/index.ts": "export function createProjectBrain() { return true; }\n",
      "guardian.config.json": "{}\n",
      "examples/basic/guardian.config.json": "{}\n",
      ".github/workflows/release.yml": "name: release\n",
      ".github/workflows/ci.yml": "name: ci\n",
      "src/release/deploymentAnalyzer.ts": "export function analyzeDeployment() { return true; }\n",
      "docs/deployment/railway.md": "# Railway deployment\n",
      "templates/deployment/checklist.md": "# Deployment checklist\n",
      "AGENTS.md": "# Agents\n",
      "docs/ai-context/TASK_ROUTING.md": "# Task Routing\n",
      "docs/ai-context/MODULE_INDEX.md": "# Module Index\n",
      "docs/ai-context/PROJECT_MAP.md": "# Project Map\n",
      ".project-brain/metrics/latest.md": "# Metrics\n",
      ".project-brain/metrics/history.json": "{}\n",
      "tests/cli.test.js": "import '../src/cli/index';\n",
      "tests/core/config.test.ts": "import '../../src/core/config';\n",
      "tests/integration/release.ts": "import '../../src/release/deploymentAnalyzer';\n",
      "tests/fixtures/config.test.ts": "fixture should not be a related test\n",
      "tests/fixtures/context.md": "# fixture context\n",
      "tests/__snapshots__/cli.test.js": "snapshot should not be a related test\n"
    };

    for (const [filePath, content] of Object.entries(files)) {
      await writeFixture(tempDir, filePath, content);
    }

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function moduleByName(data, name) {
  const module = data.modules.find((entry) => entry.name === name);
  assert.ok(module, `Expected module ${name}`);
  return module;
}

function moduleSection(content, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`## ${escapedName}\\n[\\s\\S]*?(?=\\n\\n## |$)`));
  assert.ok(match, `Expected module section ${name}`);
  return match[0];
}

test("map --dry-run prints proposed updates without writing", async () => {
  await withMappedRepo(async (tempDir) => {
    const targetPath = path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md");
    const before = await readFile(targetPath, "utf8");
    const result = runCli(tempDir, ["map", "--dry-run"]);
    const after = await readFile(targetPath, "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Proposed updates:/);
    assert.equal(after, before);
    assert.doesNotMatch(after, /repo-context-center:generated:start/);
  });
});

test("map --write updates generated sections", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const taskRouting = await readFile(path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Updated files:/);
    assert.match(taskRouting, /repo-context-center:generated:start/);
    assert.match(taskRouting, /\| Task Type \| Start With \| Then Check \| Tests \| Notes \|/);
    assert.match(taskRouting, /CLI flags\/output/);
    assert.match(taskRouting, /`src\/cli\/index\.ts`/);
  });
});

test("TASK_ROUTING.md uses task-oriented rows instead of generic module fallback", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8"));

    assert.equal(result.status, 0);
    assert.match(content, /\| Task Type \| Start With \| Then Check \| Tests \| Notes \|/);
    assert.match(content, /\| CLI flags\/output \| `src\/cli\/index\.ts` \| core command handler, README examples, CLI tests \|/);
    assert.match(content, /\| Auth\/access \| `src\/auth\/session\.ts` \| database\/session code, risk register, auth tests \|/);
    assert.doesNotMatch(content, /src\/\.\.\.\s*\|\s*boundary\s*\|\s*task touches area/i);
    assert.doesNotMatch(content, /\|\s*`?src\/[^|`]*`?\s*\|\s*boundary\s*\|\s*task touches (this )?area/i);
  });
});

test("map preserves manual content outside generated markers", async () => {
  await withMappedRepo(async (tempDir) => {
    const targetPath = path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md");
    await writeFile(targetPath, "# Task Routing\n\nManual note: keep this.\n", "utf8");

    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(targetPath, "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Manual note: keep this\./);
    assert.match(content, /repo-context-center:generated:start/);
  });
});

test("map preserves manual content before and after generated markers", async () => {
  await withMappedRepo(async (tempDir) => {
    const targetPath = path.join(tempDir, "docs", "ai-context", "MODULE_INDEX.md");
    await writeFile(targetPath, [
      "# Module Index",
      "",
      "Manual before marker.",
      "",
      generatedStart,
      "old generated content",
      generatedEnd,
      "",
      "Manual after marker."
    ].join("\n"), "utf8");

    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(targetPath, "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Manual before marker\./);
    assert.match(content, /Manual after marker\./);
    assert.match(generatedSection(content), /## Auth\/access/);
    assert.doesNotMatch(content, /old generated content/);
  });
});

test("TASK_ROUTING.md includes real repo files only", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /`src\/auth\/session\.ts`/);
    assert.match(content, /`src\/cli\/index\.ts`/);
    assert.match(content, /Auth\/access \| `src\/auth\/session\.ts`/);
    assert.doesNotMatch(content, /path\/or\/flow/);
    assert.doesNotMatch(content, /src\/missing/);
  });
});

test("map output does not include placeholder paths", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    assert.equal(result.status, 0);

    for (const file of [
      "TASK_ROUTING.md",
      "MODULE_INDEX.md",
      "PROJECT_MAP.md",
      "RISK_REGISTER.md",
      "DEPENDENCY_MAP.md",
      "SYMBOL_MAP.md",
      "HOTSPOTS.md"
    ]) {
      const content = await readFile(path.join(tempDir, "docs", "ai-context", file), "utf8");
      assert.doesNotMatch(content, /path\/or\/flow|src\/\.\.\.|module\/package/);
    }
  });
});

test("MODULE_INDEX.md groups source and tests", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "MODULE_INDEX.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /## Auth\/access/);
    assert.match(content, /- Purpose: Authentication, sessions, roles, and permissions\./);
    assert.match(content, /`src\/auth\/session\.ts`/);
    assert.match(content, /`tests\/auth\/session\.test\.ts`/);
    assert.match(content, /- Risks: permission bypass, session handling regression\./);
  });
});

test("MODULE_INDEX.md named module sections include required guidance fields", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "MODULE_INDEX.md"), "utf8"));

    assert.equal(result.status, 0);
    for (const section of ["CLI", "Configuration", "Auth/access"]) {
      assert.match(content, new RegExp(`## ${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }

    assert.match(content, /- Purpose:/);
    assert.match(content, /- Primary files:/);
    assert.match(content, /- Common tasks:/);
    assert.match(content, /- Related tests:/);
  });
});

test("PROJECT_MAP.md describes purpose, flow, tests, and ignored areas", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "PROJECT_MAP.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /### Main Purpose/);
    assert.match(content, /Repository Context Center CLI/);
    assert.match(content, /### Main Execution Flow/);
    assert.match(content, /`src\/cli\/index\.ts`/);
    assert.match(content, /### Generated \/ Ignored Areas/);
    assert.match(content, /`docs\/ai-context\/archive\/`/);
  });
});

test("RISK_REGISTER.md includes auth security only when matching files exist", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--json"]);
    const data = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(data.risks.some((risk) => risk.area.includes("Auth/access")));
  });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-map-no-auth-"));
  try {
    assert.equal(runCli(tempDir, ["init"]).status, 0);
    await writeFixture(tempDir, "src/ui/button.ts", "export function Button() { return null; }\n");

    const result = runCli(tempDir, ["map", "--json"]);
    const data = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(!data.risks.some((risk) => risk.area.includes("Auth/access")));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("DO_NOT_READ.md includes generated folders", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "DO_NOT_READ.md"), "utf8");

    assert.equal(result.status, 0);
    for (const folder of ["node_modules", "dist", "build", "coverage", ".next", "target", "docs/ai-context/archive"]) {
      assert.match(content, new RegExp(folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });
});

test("DO_NOT_READ.md includes noisy generated and fixture areas", async () => {
  await withMappedRepo(async (tempDir) => {
    await writeFixture(tempDir, "src/__snapshots__/session.snap.ts", "export const snapshotSession = {};\n");
    await writeFixture(tempDir, "src/fixtures/user.ts", "export function fixtureUser() { return {}; }\n");

    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "DO_NOT_READ.md"), "utf8");

    assert.equal(result.status, 0);
    for (const area of ["node_modules", "dist", "build", "coverage", ".next", "target", "snapshots", "__snapshots__", "fixtures", "package-lock.json"]) {
      assert.match(content, new RegExp(area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(content, /`src\/__snapshots__\/`/);
    assert.match(content, /`src\/fixtures\/`/);
  });
});

test("SYMBOL_MAP.md avoids fixture snapshot and generated noise", async () => {
  await withMappedRepo(async (tempDir) => {
    await writeFixture(tempDir, "src/__snapshots__/session.snap.ts", "export function snapshotSession() { return {}; }\n");
    await writeFixture(tempDir, "src/fixtures/user.ts", "export function fixtureUser() { return {}; }\n");

    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "SYMBOL_MAP.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /`requireSession`/);
    assert.doesNotMatch(content, /snapshotSession|fixtureUser/);
    assert.doesNotMatch(content, /src\/__snapshots__|src\/fixtures|dist\//);
  });
});

test("CHANGE_LOG.md records map generation", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "CHANGE_LOG.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /`repo-context-center map --write`/);
    assert.match(content, /generated repo-specific context map/);
    assert.doesNotMatch(content, /release|released|published|deployed|version\s+0\./i);
  });
});

test("LESSONS_LEARNED.md does not invent history", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "LESSONS_LEARNED.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /No generated lessons yet\. Add stable lessons manually after repeated issues\./);
    assert.doesNotMatch(content, /2026-/);
    assert.doesNotMatch(content, /fixed .* bug|discovered .* cause|root cause|auth .* issue|release .* failed/i);
  });
});

test("map classifies Guardian-like repo files without fixture or metrics noise", async () => {
  await withGuardianLikeRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write", "--json"]);
    const data = JSON.parse(result.stdout);
    const taskRouting = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8"));
    const moduleIndex = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "MODULE_INDEX.md"), "utf8"));

    assert.equal(result.status, 0);

    const config = moduleByName(data, "Configuration");
    assert.deepEqual(config.primaryFiles.slice(0, 4), [
      "src/config/defaults.ts",
      "src/core/config.ts",
      "guardian.config.json",
      "examples/basic/guardian.config.json"
    ]);
    assert.ok(!config.primaryFiles.some((file) => file.startsWith(".github/workflows/")));

    const release = moduleByName(data, "Release workflow");
    assert.ok(release.primaryFiles.includes(".github/workflows/ci.yml"));
    assert.ok(release.primaryFiles.includes(".github/workflows/release.yml"));
    assert.ok(release.primaryFiles.includes("src/release/deploymentAnalyzer.ts"));
    assert.ok(release.primaryFiles.some((file) => file.includes("deployment")));

    const cli = moduleByName(data, "CLI");
    assert.ok(cli.tests.includes("tests/cli.test.js"));

    const context = moduleByName(data, "Context docs");
    assert.deepEqual(context.primaryFiles.slice(0, 5), [
      "AGENTS.md",
      "docs/ai-context/TASK_ROUTING.md",
      "docs/ai-context/MODULE_INDEX.md",
      "docs/ai-context/PROJECT_MAP.md",
      ".repo-context-center/config.json"
    ]);
    assert.ok(!context.primaryFiles.some((file) => file.startsWith(".project-brain/metrics/")));

    for (const module of data.modules) {
      assert.ok(!module.tests.some((file) => file.startsWith("tests/fixtures/")), module.name);
      assert.ok(!module.tests.some((file) => file.startsWith("tests/__snapshots__/")), module.name);
    }

    assert.doesNotMatch(taskRouting, /tests\/fixtures|tests\/__snapshots__|tests\/fixtures\/context\.md/);
    assert.doesNotMatch(moduleSection(moduleIndex, "Release workflow"), /tests\/fixtures|tests\/__snapshots__/);
    assert.doesNotMatch(moduleSection(moduleIndex, "Context docs"), /tests\/fixtures|tests\/__snapshots__/);
    assert.match(moduleIndex, /## Test fixtures[\s\S]*`tests\/fixtures\/config\.test\.ts`/);
    assert.match(moduleIndex, /## Release workflow[\s\S]*- Related tests: `tests\/integration\/release\.ts`\./);
    assert.match(moduleIndex, /## Context docs[\s\S]*`AGENTS\.md`/);
    assert.match(moduleIndex, /## Context docs[\s\S]*`docs\/ai-context\/TASK_ROUTING\.md`/);
    assert.match(moduleIndex, /## Context docs[\s\S]*`.repo-context-center\/config\.json`/);
    assert.match(moduleIndex, /## Context docs[\s\S]*- Related tests: none detected\./);
    assert.doesNotMatch(moduleIndex, /## Context docs[\s\S]*\.project-brain\/metrics/);
  });
});

test("PROJECT_MAP.md uses real entrypoints and package scripts for Guardian-like repo", async () => {
  await withGuardianLikeRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write", "--json"]);
    const data = JSON.parse(result.stdout);
    const projectMap = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "PROJECT_MAP.md"), "utf8"));

    assert.equal(result.status, 0);
    assert.deepEqual(data.projectMap.entrypoints, [
      "dist/cli/index.js",
      "src/cli/index.ts"
    ]);
    assert.doesNotMatch(projectMap, /src\/analyzers\/index\.ts/);
    assert.doesNotMatch(projectMap, /src\/repo\/index\.ts/);
    assert.doesNotMatch(projectMap, /src\/project-brain\/index\.ts/);
    assert.match(projectMap, /### Startup \/ Entrypoints[\s\S]*`dist\/cli\/index\.js`[\s\S]*`src\/cli\/index\.ts`/);
    assert.deepEqual(data.projectMap.keyDirectories, [
      "`src/cli` - CLI commands and command entrypoints",
      "`src/config` - configuration loading and validation",
      "`src/analyzers` - analysis and rule logic",
      "`src/renderers` - report rendering and output formatting",
      "`src/core` - orchestration and core business logic",
      "`src/repo` - repository scanning and git helpers",
      "`templates` - generated templates and starter context",
      "`tests` - test coverage, fixtures, and regression cases",
      "`.github/workflows` - CI and release automation",
      "`docs/ai-context` - generated agent context",
      "`.repo-context-center` - tool config"
    ]);
    assert.match(projectMap, /### Key Directories[\s\S]*`src\/cli` - CLI commands and command entrypoints/);
    assert.match(projectMap, /### Key Directories[\s\S]*`src\/renderers` - report rendering and output formatting/);
    assert.match(projectMap, /### Key Directories[\s\S]*`templates` - generated templates and starter context/);
    assert.match(projectMap, /### Key Directories[\s\S]*`\.github\/workflows` - CI and release automation/);
    assert.doesNotMatch(projectMap, /- src\/ source root/);
    assert.doesNotMatch(projectMap, /tests\/fixtures` -/);
    assert.ok(data.projectMap.productionCriticalFlows.length > 0);
    assert.ok(data.projectMap.productionCriticalFlows.every((flow) => flow["First check"] === "npm run build"));
    assert.match(projectMap, /\| Flow \| Why critical \| First check \|/);
    assert.match(projectMap, /\| .* \| .* \| npm run build \|/);
  });
});

test("map keeps fixture security files out of auth primary files and task routing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-map-fixture-leak-"));

  try {
    assert.equal(runCli(tempDir, ["init"]).status, 0);
    await writeFixture(tempDir, "package.json", JSON.stringify({
      scripts: {
        build: "tsc",
        lint: "eslint .",
        test: "node --test tests/*.test.js"
      }
    }, null, 2));
    await writeFixture(
      tempDir,
      "src/analyzers/securityAnalyzer.ts",
      "export function analyzeSecurityRules() { return true; }\n"
    );
    await writeFixture(
      tempDir,
      "templates/project-brain/security-rules.md",
      "# Security rules template\n"
    );
    await writeFixture(
      tempDir,
      "tests/fixtures/project-brain/complete/.project-brain/security-rules.md",
      "# Fixture security rules\n"
    );
    await writeFixture(
      tempDir,
      "tests/securityAnalyzer.test.ts",
      "import '../src/analyzers/securityAnalyzer';\n"
    );

    const result = runCli(tempDir, ["map", "--write", "--json"]);
    const data = JSON.parse(result.stdout);
    const taskRouting = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8"));
    const moduleIndex = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "MODULE_INDEX.md"), "utf8"));
    const auth = moduleByName(data, "Auth/access");
    const fixtures = moduleByName(data, "Test fixtures");

    assert.equal(result.status, 0);
    assert.ok(auth.primaryFiles.includes("src/analyzers/securityAnalyzer.ts"));
    assert.ok(auth.primaryFiles.includes("templates/project-brain/security-rules.md"));
    assert.ok(!auth.primaryFiles.some((file) => file.startsWith("tests/fixtures/")));
    assert.ok(fixtures.primaryFiles.includes("tests/fixtures/project-brain/complete/.project-brain/security-rules.md"));

    assert.match(taskRouting, /Auth\/access \| `src\/analyzers\/securityAnalyzer\.ts`, `templates\/project-brain\/security-rules\.md`/);
    assert.doesNotMatch(taskRouting, /tests\/fixtures\/project-brain\/complete\/\.project-brain\/security-rules\.md/);
    assert.doesNotMatch(moduleSection(moduleIndex, "Auth/access"), /tests\/fixtures\/project-brain\/complete\/\.project-brain\/security-rules\.md/);
    assert.match(moduleSection(moduleIndex, "Test fixtures"), /tests\/fixtures\/project-brain\/complete\/\.project-brain\/security-rules\.md/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("map --json contains structured mapping data", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--json", "--max-files", "50"]);
    const data = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(Array.isArray(data.taskRouting));
    assert.ok(Array.isArray(data.modules));
    assert.ok(Array.isArray(data.risks));
    assert.ok(Array.isArray(data.dependencies));
    assert.ok(Array.isArray(data.symbols));
    assert.ok(Array.isArray(data.hotspots));
    assert.ok(data.dependencies.some((dependency) => dependency.from === "src/auth/session.ts"));
    assert.ok(data.symbols.some((symbol) => symbol.symbol === "requireSession"));
    assert.ok(data.symbols.length <= 30);
  });
});

test("empty repo map does not fail and preserves compact generic guidance", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-map-empty-"));

  try {
    assert.equal(runCli(tempDir, ["init"]).status, 0);
    const result = runCli(tempDir, ["map", "--write", "--json"]);
    const data = JSON.parse(result.stdout);
    const taskRouting = await readFile(path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8");

    assert.equal(result.status, 0);
    assert.deepEqual(data.risks, []);
    assert.match(taskRouting, /Before broad search: check `DO_NOT_READ\.md`/);
    assert.match(taskRouting, new RegExp(generatedStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(taskRouting, /No repo-specific rows detected/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
