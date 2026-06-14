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
        name: "ai-project-guardian",
        description: "CLI repository risk analysis reports for QA, release, and security workflows.",
        bin: {
          "ai-project-guardian": "./dist/cli/index.js"
        },
        main: "./dist/cli/index.js",
        scripts: {
          build: "tsc",
          coverage: "c8 npm test",
          lint: "eslint .",
          test: "node --test tests/*.test.js"
        }
      }, null, 2),
      "README.md": "# ai-project-guardian\n\n`ai-project-guardian` is a TypeScript CLI for analyzing another repository and producing QA, release, security, workflow, coverage, and external-scanner risk reports that can be published from GitHub Actions.\n",
      "src/cli/index.ts": "export function runCli() { return true; }\n",
      "src/cli/commands/map.ts": "export function mapCommand() { return true; }\n",
      "src/config/defaults.ts": "export const defaults = {};\n",
      "src/core/config.ts": "export function loadConfig() { return {}; }\n",
      "src/core/guardian.ts": "export function runGuardian() { return true; }\n",
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

async function withFastApiLikeRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-fastapi-map-"));
  const repoDir = path.join(tempDir, "fastapi");

  try {
    await mkdir(repoDir, { recursive: true });
    assert.equal(runCli(repoDir, ["init"]).status, 0);

    const files = {
      "README.md": [
        "<p align=\"center\">",
        "  <img src=\"https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png\" alt=\"FastAPI\">",
        "</p>",
        "",
        "<p align=\"center\">",
        "  <a href=\"https://github.com/fastapi/fastapi/actions\"><img src=\"https://img.shields.io/badge/build-passing-green\" alt=\"Build\"></a>",
        "</p>",
        "",
        "<p align=\"center\"><em>FastAPI framework, high performance, easy to learn, fast to code, ready for production</em></p>",
        "",
        "## Installation",
        "",
        "Install with pip."
      ].join("\n"),
      "pyproject.toml": "[project]\nname = \"fastapi\"\n",
      "fastapi/__init__.py": "__version__ = '0.1.0'\n",
      "fastapi/applications.py": "class FastAPI:\n    pass\n",
      "fastapi/security/http.py": "class HTTPBasic:\n    pass\n",
      "tests/test_applications.py": "from fastapi.applications import FastAPI\n",
      "docs/en/docs/advanced/security/http-basic-auth.md": "# HTTP Basic Auth\n",
      "docs/en/docs/tutorial/static-files.md": "# Static Files\n",
      "scripts/format-imports.py": "print('format')\n",
      ".github/workflows/test.yml": "name: test\n"
    };

    for (const [filePath, content] of Object.entries(files)) {
      await writeFixture(repoDir, filePath, content);
    }

    return await callback(repoDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function withLangChainLikeRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-langchain-map-"));

  try {
    assert.equal(runCli(tempDir, ["init"]).status, 0);

    const files = {
      "pyproject.toml": "[project]\nname = \"langchain\"\n",
      "libs/core/langchain_core/__init__.py": "\n",
      "libs/core/langchain_core/runnables/base.py": "class Runnable:\n    pass\n",
      "libs/core/tests/unit_tests/runnables/test_base.py": "def test_base():\n    assert True\n",
      "libs/community/langchain_community/__init__.py": "\n",
      "libs/community/tests/unit_tests/test_tools.py": "def test_tools():\n    assert True\n",
      "libs/langchain/langchain/__init__.py": "\n",
      "libs/langchain/tests/unit_tests/test_chains.py": "def test_chains():\n    assert True\n",
      "docs/docs/get_started/introduction.mdx": "# Introduction\n",
      "templates/rag-pinecone/package.json": "{}\n",
      "examples/cookbook/retrieval.ipynb": "{}\n",
      "scripts/check_imports.py": "print('check')\n",
      ".github/workflows/ci.yml": "name: ci\n"
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

function tableRow(content, firstCell) {
  const escapedCell = firstCell.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`\\| ${escapedCell} \\|[^\\n]+`));
  assert.ok(match, `Expected table row ${firstCell}`);
  return match[0];
}

function headingSection(content, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`### ${escapedHeading}\\n[\\s\\S]*?(?=\\n\\n### |\\n\\n_Generated by|$)`));
  assert.ok(match, `Expected heading section ${heading}`);
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

test("map --check passes when generated files are current", async () => {
  await withMappedRepo(async (tempDir) => {
    const writeResult = runCli(tempDir, ["map", "--write", "--max-files", "500"]);
    const checkResult = runCli(tempDir, ["map", "--check", "--max-files", "500"]);

    assert.equal(writeResult.status, 0);
    assert.equal(checkResult.status, 0);
    assert.match(checkResult.stdout, /repo-context-center map --check/);
    assert.match(checkResult.stdout, /Generated context files are up to date\./);
    assert.doesNotMatch(checkResult.stdout, /Files that would change:/);
  });
});

test("map --check fails when a generated file is stale", async () => {
  await withMappedRepo(async (tempDir) => {
    assert.equal(runCli(tempDir, ["map", "--write"]).status, 0);

    const targetPath = path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md");
    const before = await readFile(targetPath, "utf8");
    await writeFile(targetPath, before.replace("CLI flags/output", "STALE CLI flags/output"), "utf8");
    const staleContent = await readFile(targetPath, "utf8");

    const result = runCli(tempDir, ["map", "--check", "--max-files", "75"]);
    const after = await readFile(targetPath, "utf8");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Generated context files are stale or missing\./);
    assert.match(result.stdout, /Files that would change:/);
    assert.match(result.stdout, /- docs\/ai-context\/TASK_ROUTING\.md \(update\)/);
    assert.match(result.stdout, /Run: npx repo-context-center map --write --max-files 75/);
    assert.equal(after, staleContent);
  });
});

test("map --check fails when generated files are missing", async () => {
  await withMappedRepo(async (tempDir) => {
    assert.equal(runCli(tempDir, ["map", "--write"]).status, 0);

    const targetPath = path.join(tempDir, "docs", "ai-context", "HOTSPOTS.md");
    await rm(targetPath, { force: true });

    const result = runCli(tempDir, ["map", "--check"]);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Generated context files are stale or missing\./);
    assert.match(result.stdout, /- docs\/ai-context\/HOTSPOTS\.md \(create\)/);
    assert.match(result.stdout, /Run: npx repo-context-center map --write --max-files 500/);
  });
});

test("map --check does not write files", async () => {
  await withMappedRepo(async (tempDir) => {
    const targetPath = path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md");
    const before = await readFile(targetPath, "utf8");
    const result = runCli(tempDir, ["map", "--check"]);
    const after = await readFile(targetPath, "utf8");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Generated context files are stale or missing\./);
    assert.equal(after, before);
    assert.doesNotMatch(after, /repo-context-center:generated:start/);
  });
});

test("map --check and --write cannot be used together", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--check", "--write"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: repo-context-center map/);
  });
});

test("map --check and --dry-run cannot be used together", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--check", "--dry-run"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: repo-context-center map/);
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

test("AGENTS.md generated from scratch contains complete compact startup guidance", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-map-agents-"));

  try {
    await writeFixture(tempDir, "src/api/main.py", "def app():\n    return True\n");

    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "AGENTS.md"), "utf8");
    const generated = generatedSection(content);

    assert.equal(result.status, 0);
    assert.match(generated, /COMMUNICATION_MODE\.md/);
    assert.match(generated, /TASK_ROUTING\.md/);
    assert.match(generated, /TOKEN_BUDGET\.md/);
    assert.match(generated, /DO_NOT_READ\.md/);
    assert.match(generated, /Compact: default/);
    assert.match(generated, /Investigation: security\/auth/);
    assert.match(generated, /Detailed: explicit request/);
    assert.match(generated, /MODULE_INDEX\.md/);
    assert.match(generated, /PROJECT_MAP\.md/);
    assert.match(generated, /DEPENDENCY_MAP\.md/);
    assert.match(generated, /RISK_REGISTER\.md/);
    assert.match(generated, /HOTSPOTS\.md/);
    assert.match(generated, /SYMBOL_MAP\.md/);
    assert.match(generated, /LESSONS_LEARNED\.md/);
    assert.match(generated, /docs\/ai-context\/archive\/\*/);
    assert.match(generated, /paths in `DO_NOT_READ\.md`/);
    assert.match(generated, /\.repo-context-center\/config\.json/);
    assert.match(generated, /Code is source of truth\./);
    assert.doesNotMatch(generated, /\| Task Type \||src\/api\/main\.py|FastAPI|Repository purpose/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("AGENTS.md preserves manual content and updates only generated markers", async () => {
  await withMappedRepo(async (tempDir) => {
    const targetPath = path.join(tempDir, "AGENTS.md");
    await writeFile(targetPath, [
      "# Agents",
      "",
      "Manual before marker.",
      "",
      generatedStart,
      "old minimal generated content",
      generatedEnd,
      "",
      "Manual after marker."
    ].join("\n"), "utf8");

    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(targetPath, "utf8");
    const generated = generatedSection(content);

    assert.equal(result.status, 0);
    assert.match(content, /Manual before marker\./);
    assert.match(content, /Manual after marker\./);
    assert.match(generated, /COMMUNICATION_MODE\.md/);
    assert.match(generated, /Code is source of truth\./);
    assert.doesNotMatch(content, /old minimal generated content/);
  });
});

test("AGENTS.md preserves existing markerless content when adding generated startup guidance", async () => {
  await withMappedRepo(async (tempDir) => {
    const targetPath = path.join(tempDir, "AGENTS.md");
    await writeFile(targetPath, "# Agents\n\nManual owner guidance.\n", "utf8");

    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(targetPath, "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /Manual owner guidance\./);
    assert.match(generatedSection(content), /TASK_ROUTING\.md/);
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
    assert.match(content, /Repository purpose not declared in package metadata or README\./);
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

test("RISK_REGISTER.md keeps default checks separate from focused risk checks", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "RISK_REGISTER.md"), "utf8"));
    const focusedRisks = headingSection(content, "Focused Risks");

    assert.equal(result.status, 0);
    assert.match(content, /### Default Checks/);
    assert.match(content, /- `npm run build`/);
    assert.match(content, /- `npm test`/);
    assert.match(content, /- `npm run lint`/);
    assert.match(content, /\| Area \| Why risky \| Focused checks \|/);
    assert.doesNotMatch(focusedRisks, /npm run build|npm test|npm run lint/);
    assert.match(focusedRisks, /node --test tests\/auth\/session\.test\.ts/);
  });
});

test("RISK_REGISTER.md does not label normal benchmark tests as fixture drift", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-map-benchmark-risk-"));

  try {
    assert.equal(runCli(tempDir, ["init"]).status, 0);
    await writeFixture(tempDir, "package.json", JSON.stringify({
      scripts: {
        test: "pytest"
      }
    }, null, 2));
    await writeFixture(tempDir, "fastapi/applications.py", "class FastAPI: pass\n");
    await writeFixture(tempDir, "tests/benchmarks/test_general_performance.py", "def test_general_performance(): pass\n");

    const result = runCli(tempDir, ["map", "--json"]);
    const data = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.ok(!data.risks.some((risk) => risk.area.includes("Fixture/snapshot drift")));
    assert.ok(!data.risks.some((risk) => risk.area.includes("tests/benchmarks/test_general_performance.py")));
    for (const risk of data.risks) {
      assert.deepEqual(risk.checks, [...new Set(risk.checks)]);
    }
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

    const normalRouting = headingSection(taskRouting, "Task Routing")
      .split(/\r?\n/)
      .filter((line) => !line.includes("Test fixture/snapshot updates"))
      .join("\n");
    assert.doesNotMatch(normalRouting, /tests\/fixtures|tests\/__snapshots__|tests\/fixtures\/context\.md/);
    assert.doesNotMatch(moduleSection(moduleIndex, "Release workflow"), /tests\/fixtures|tests\/__snapshots__/);
    assert.doesNotMatch(moduleSection(moduleIndex, "Context docs"), /tests\/fixtures|tests\/__snapshots__/);
    assert.match(moduleIndex, /## Tests \/ Fixtures[\s\S]*`tests\/fixtures\/config\.test\.ts`/);
    assert.match(moduleIndex, /## Release workflow[\s\S]*- Related tests: `tests\/integration\/release\.ts`\./);
    assert.match(moduleIndex, /## Context docs[\s\S]*`AGENTS\.md`/);
    assert.match(moduleIndex, /## Context docs[\s\S]*`docs\/ai-context\/TASK_ROUTING\.md`/);
    assert.match(moduleIndex, /## Context docs[\s\S]*`.repo-context-center\/config\.json`/);
    assert.match(moduleIndex, /## Context docs[\s\S]*- Related tests: none detected\./);
    assert.doesNotMatch(moduleIndex, /## Context docs[\s\S]*\.project-brain\/metrics/);
  });
});

test("Guardian-like map prefers repository-specific modules and task routing", async () => {
  await withGuardianLikeRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write", "--json"]);
    const data = JSON.parse(result.stdout);
    const taskRouting = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8"));
    const moduleIndex = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "MODULE_INDEX.md"), "utf8"));

    assert.equal(result.status, 0);
    for (const label of [
      "CLI",
      "Configuration",
      "Analyzers / Risk Rules",
      "Renderers / Reports",
      "Core / Orchestration",
      "Repository scanning",
      "Templates",
      "Tests / Fixtures",
      "Context docs",
      "Release workflow"
    ]) {
      assert.ok(data.modules.some((module) => module.name === label), label);
      assert.match(moduleIndex, new RegExp(`## ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }

    for (const taskType of [
      "CLI flags/output",
      "Config behavior",
      "Analyzer/risk rule changes",
      "Report rendering",
      "Repository scanning/classification",
      "Template/context generation",
      "Test fixture/snapshot updates",
      "GitHub Actions / release workflow"
    ]) {
      assert.match(taskRouting, new RegExp(`\\| ${taskType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|`));
    }

    assert.match(tableRow(taskRouting, "Repository scanning/classification"), /`src\/repo\/index\.ts`/);
    assert.match(tableRow(taskRouting, "Template/context generation"), /`src\/project-brain\/index\.ts`|`templates\/deployment\/checklist\.md`/);

    const normalModules = data.modules.filter((module) => module.name !== "Tests / Fixtures");
    for (const module of normalModules) {
      assert.ok(!module.primaryFiles.some((file) => file.startsWith("tests/fixtures/")), module.name);
      assert.ok(!module.primaryFiles.some((file) => file.startsWith("tests/__snapshots__/")), module.name);
    }

    const normalRouting = headingSection(taskRouting, "Task Routing")
      .split(/\r?\n/)
      .filter((line) => !line.includes("Test fixture/snapshot updates"))
      .join("\n");
    assert.doesNotMatch(normalRouting, /tests\/fixtures|tests\/__snapshots__/);
  });
});

test("TASK_ROUTING.md includes deterministic First Files to Open groups without normal-group noise", async () => {
  await withGuardianLikeRepo(async (tempDir) => {
    const firstResult = runCli(tempDir, ["map", "--write"]);
    const firstTaskRouting = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8"));
    const secondResult = runCli(tempDir, ["map", "--write"]);
    const secondTaskRouting = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8"));
    const firstFiles = headingSection(firstTaskRouting, "First Files to Open");

    assert.equal(firstResult.status, 0);
    assert.equal(secondResult.status, 0);
    assert.equal(secondTaskRouting, firstTaskRouting);
    assert.match(firstFiles, /\| Task Area \| Open First \|/);

    const expectedRows = [
      ["CLI behavior", "`src/cli/index.ts`, `src/cli/commands/map.ts`, `src/core/guardian.ts`, `src/core/config.ts`"],
      ["Configuration", "`src/config/defaults.ts`, `src/core/config.ts`, `src/core/validator.ts`, `guardian.config.json`"],
      ["Analyzer / risk scoring", "`src/analyzers/index.ts`, `src/core/validator.ts`"],
      ["Report rendering", "`src/renderers/markdown.ts`, `src/cli/commands/map.ts`"],
      ["Repository scanning / classification", "`src/repo/index.ts`"],
      ["Template / context generation", "`templates/deployment/checklist.md`, `src/project-brain/index.ts`"],
      ["CI / release workflow", "`.github/workflows/ci.yml`, `.github/workflows/release.yml`, `src/release/deploymentAnalyzer.ts`, `package.json`"],
      ["Tests / fixtures", "`tests/cli.test.js`, `tests/core/config.test.ts`, `tests/__snapshots__/cli.test.js`, `tests/fixtures/config.test.ts`"]
    ];

    for (const [taskArea, files] of expectedRows) {
      assert.match(firstFiles, new RegExp(`\\| ${taskArea.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| ${files.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|`));
    }

    const normalGroups = firstFiles
      .split(/\r?\n/)
      .filter((line) => !line.startsWith("| Tests / fixtures |"))
      .join("\n");
    assert.doesNotMatch(normalGroups, /docs\/ai-context|docs\/ai-context\/archive|dist\/|coverage\/|node_modules|package-lock\.json/);
    assert.doesNotMatch(normalGroups, /\.project-brain\/metrics|\.repo-context-center\/config\.json/);
    assert.doesNotMatch(normalGroups, /tests\/fixtures|tests\/__snapshots__/);

    const fixturesRow = tableRow(firstFiles, "Tests / fixtures");
    assert.match(fixturesRow, /tests\/__snapshots__\/cli\.test\.js/);
    assert.match(fixturesRow, /tests\/fixtures\/config\.test\.ts/);
    assert.doesNotMatch(fixturesRow, /docs\/ai-context|\.project-brain\/metrics|\.repo-context-center\/config\.json|package-lock\.json/);
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
    assert.equal(
      data.projectMap.purpose,
      "ai-project-guardian is a TypeScript CLI for analyzing another repository and producing QA, release, security, workflow, coverage, and external-scanner risk reports that can be published from GitHub Actions."
    );
    assert.match(projectMap, /ai-project-guardian is a TypeScript CLI for analyzing another repository/);
    assert.doesNotMatch(projectMap, /Repository Context Center CLI/);
    assert.match(projectMap, /### Startup \/ Entrypoints[\s\S]*`dist\/cli\/index\.js`[\s\S]*`src\/cli\/index\.ts`/);
    assert.deepEqual(data.projectMap.keyDirectories, [
      "`src/cli` - CLI commands and command entrypoints",
      "`src/config` - configuration loading and validation",
      "`src/analyzers` - analysis and rule logic",
      "`src/renderers` - report rendering and output formatting",
      "`src/core` - orchestration and core business logic",
      "`src/repo` - repository scanning and git helpers",
      "`docs` - documentation",
      "`templates` - templates/prompts/examples",
      "`examples` - examples and usage samples",
      "`tests` - test coverage, fixtures, and regression cases",
      "`.github/workflows` - CI and release automation",
      "`docs/ai-context` - generated agent context",
      "`.repo-context-center` - tool config"
    ]);
    assert.match(projectMap, /### Key Directories[\s\S]*`src\/cli` - CLI commands and command entrypoints/);
    assert.match(projectMap, /### Key Directories[\s\S]*`src\/renderers` - report rendering and output formatting/);
    assert.match(projectMap, /### Key Directories[\s\S]*`templates` - templates\/prompts\/examples/);
    assert.match(projectMap, /### Key Directories[\s\S]*`\.github\/workflows` - CI and release automation/);
    assert.doesNotMatch(projectMap, /- src\/ source root/);
    assert.doesNotMatch(projectMap, /tests\/fixtures` -/);
    assert.deepEqual(data.projectMap.understandingQuality, {
      level: "High",
      entrypointsDetected: 2,
      keyDirectoriesDetected: 13,
      modulesDetected: 8,
      dependencyHintsMode: "Conservative",
      noiseFilteringStatus: "Active (2 ignored/noise areas separated)"
    });
    assert.match(projectMap, /### Repository Understanding Quality/);
    assert.match(projectMap, /\| Repo understanding level \| High \|/);
    assert.match(projectMap, /\| Entrypoints detected \| 2 \|/);
    assert.match(projectMap, /\| Key directories detected \| 13 \|/);
    assert.match(projectMap, /\| Modules detected \| 8 \|/);
    assert.match(projectMap, /\| Dependency hints mode \| Conservative \|/);
    assert.match(projectMap, /\| Generated\/noise filtering \| Active \(2 ignored\/noise areas separated\) \|/);
    assert.ok(data.projectMap.productionCriticalFlows.length > 0);
    assert.ok(data.projectMap.productionCriticalFlows.every((flow) => flow["First check"] === "npm run build"));
    assert.match(projectMap, /\| Flow \| Why critical \| First check \|/);
    assert.match(projectMap, /\| .* \| .* \| npm run build \|/);
  });
});

test("PROJECT_MAP.md reports medium repository understanding quality for partial signals", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-map-confidence-medium-"));

  try {
    assert.equal(runCli(tempDir, ["init"]).status, 0);
    await writeFixture(tempDir, "package.json", JSON.stringify({
      bin: {
        "partial-cli": "./src/cli/index.ts"
      },
      scripts: {
        test: "node --test tests/*.test.js"
      }
    }, null, 2));
    await writeFixture(tempDir, "src/cli/index.ts", "export function runCli() { return true; }\n");
    await writeFixture(tempDir, "src/core/config.ts", "export function loadConfig() { return {}; }\n");
    await writeFixture(tempDir, "tests/cli.test.js", "import '../src/cli/index';\n");

    const result = runCli(tempDir, ["map", "--write", "--json"]);
    const data = JSON.parse(result.stdout);
    const projectMap = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "PROJECT_MAP.md"), "utf8"));

    assert.equal(result.status, 0);
    assert.deepEqual(data.projectMap.understandingQuality, {
      level: "Medium",
      entrypointsDetected: 1,
      keyDirectoriesDetected: 5,
      modulesDetected: 2,
      dependencyHintsMode: "Conservative",
      noiseFilteringStatus: "Active (no ignored/noise areas detected)"
    });
    assert.match(projectMap, /\| Repo understanding level \| Medium \|/);
    assert.match(projectMap, /\| Entrypoints detected \| 1 \|/);
    assert.match(projectMap, /\| Key directories detected \| 5 \|/);
    assert.match(projectMap, /\| Modules detected \| 2 \|/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("PROJECT_MAP.md promotes LangChain-like monorepo directories without entrypoints", async () => {
  await withLangChainLikeRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write", "--json", "--max-files", "500"]);
    const data = JSON.parse(result.stdout);
    const projectMap = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "PROJECT_MAP.md"), "utf8"));

    assert.equal(result.status, 0);
    assert.deepEqual(data.projectMap.entrypoints, []);
    assert.deepEqual(data.projectMap.keyDirectories.slice(0, 10), [
      "`libs` - monorepo packages/libraries",
      "`libs/core` - core library/package area",
      "`libs/community` - library/package area",
      "`libs/langchain` - library/package area",
      "`docs` - documentation",
      "`templates` - templates/prompts/examples",
      "`examples` - examples and usage samples",
      "`examples/cookbook` - examples and usage samples",
      "`scripts` - automation and maintenance scripts",
      "`.github/workflows` - CI and release automation"
    ]);
    assert.deepEqual(data.projectMap.understandingQuality, {
      level: "Medium",
      entrypointsDetected: 0,
      keyDirectoriesDetected: 12,
      modulesDetected: 3,
      dependencyHintsMode: "Conservative",
      noiseFilteringStatus: "Active (no ignored/noise areas detected)"
    });
    assert.match(projectMap, /### Key Directories[\s\S]*`libs` - monorepo packages\/libraries/);
    assert.match(projectMap, /### Key Directories[\s\S]*`libs\/core` - core library\/package area/);
    assert.match(projectMap, /\| Repo understanding level \| Medium \|/);
  });
});

test("PROJECT_MAP.md reports low repository understanding quality without noise inflation", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-map-confidence-low-"));

  try {
    assert.equal(runCli(tempDir, ["init"]).status, 0);
    await writeFixture(tempDir, "package.json", JSON.stringify({
      main: "./dist/cli/index.js"
    }, null, 2));
    await writeFixture(tempDir, "dist/cli/index.js", "module.exports = {};\n");
    await writeFixture(tempDir, "coverage/lcov.info", "TN:\n");
    await writeFixture(tempDir, "tests/fixtures/generated.test.js", "fixture only\n");
    await writeFixture(tempDir, "tests/__snapshots__/cli.test.js", "snapshot only\n");

    const result = runCli(tempDir, ["map", "--write", "--json"]);
    const data = JSON.parse(result.stdout);
    const projectMap = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "PROJECT_MAP.md"), "utf8"));

    assert.equal(result.status, 0);
    assert.deepEqual(data.projectMap.understandingQuality, {
      level: "Low",
      entrypointsDetected: 1,
      keyDirectoriesDetected: 3,
      modulesDetected: 0,
      dependencyHintsMode: "Conservative",
      noiseFilteringStatus: "Active (2 ignored/noise areas separated)"
    });
    assert.deepEqual(data.projectMap.tests, []);
    assert.match(projectMap, /\| Repo understanding level \| Low \|/);
    assert.match(projectMap, /\| Entrypoints detected \| 1 \|/);
    assert.match(projectMap, /\| Key directories detected \| 3 \|/);
    assert.match(projectMap, /\| Modules detected \| 0 \|/);
    assert.match(projectMap, /\| Generated\/noise filtering \| Active \(2 ignored\/noise areas separated\) \|/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("HOTSPOTS.md prioritizes high-impact Guardian-like files over fixtures", async () => {
  await withGuardianLikeRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write", "--json"]);
    const data = JSON.parse(result.stdout);
    const hotspots = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "HOTSPOTS.md"), "utf8"));
    const hotspotFiles = data.hotspots.map((hotspot) => hotspot.file);

    assert.equal(result.status, 0);
    for (const expected of [
      "src/cli/index.ts",
      "src/core/guardian.ts",
      "src/config/defaults.ts",
      "src/core/config.ts",
      "src/analyzers/index.ts",
      "src/renderers/markdown.ts",
      "src/repo/index.ts",
      ".github/workflows/ci.yml"
    ]) {
      assert.ok(hotspotFiles.includes(expected), expected);
      assert.match(hotspots, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    assert.ok(hotspotFiles.indexOf("src/cli/index.ts") < hotspotFiles.indexOf("src/analyzers/index.ts"));
    assert.ok(!hotspotFiles.some((file) => file.startsWith("tests/fixtures/")));
    assert.ok(!hotspotFiles.some((file) => file.startsWith("tests/__snapshots__/")));
    assert.doesNotMatch(hotspots, /tests\/fixtures|tests\/__snapshots__/);
  });
});

test("map generalizes to FastAPI-like non-Node repositories without docs leakage", async () => {
  await withFastApiLikeRepo(async (repoDir) => {
    const result = runCli(repoDir, ["map", "--write", "--json", "--max-files", "150"]);
    const data = JSON.parse(result.stdout);
    const projectMap = generatedSection(await readFile(path.join(repoDir, "docs", "ai-context", "PROJECT_MAP.md"), "utf8"));
    const taskRouting = generatedSection(await readFile(path.join(repoDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8"));
    const hotspots = generatedSection(await readFile(path.join(repoDir, "docs", "ai-context", "HOTSPOTS.md"), "utf8"));
    const hotspotFiles = data.hotspots.map((hotspot) => hotspot.file);

    assert.equal(result.status, 0);
    assert.equal(
      data.projectMap.purpose,
      "FastAPI framework, high performance, easy to learn, fast to code, ready for production."
    );
    assert.doesNotMatch(projectMap, /<p|<img|shields\.io|logo-margin/);
    assert.deepEqual(data.projectMap.keyDirectories.slice(0, 5), [
      "`fastapi` - primary package/source code",
      "`docs` - documentation",
      "`tests` - test coverage, fixtures, and regression cases",
      "`scripts` - automation and maintenance scripts",
      "`.github/workflows` - CI and release automation"
    ]);
    assert.doesNotMatch(taskRouting, /Analyzer\/risk rule changes|Analyzer \/ risk scoring/);
    assert.doesNotMatch(taskRouting, /Staff\/POS\/public flows/);
    assert.ok(hotspotFiles.includes("fastapi/__init__.py"));
    assert.ok(hotspotFiles.includes("fastapi/applications.py"));
    assert.ok(hotspotFiles.includes("scripts/format-imports.py"));
    assert.ok(hotspotFiles.includes("tests/test_applications.py"));
    assert.ok(hotspotFiles.includes(".github/workflows/test.yml"));
    assert.ok(!hotspotFiles.some((file) => file.startsWith("docs/en/docs/advanced/security/")));
    assert.doesNotMatch(hotspots, /docs\/en\/docs\/advanced\/security/);
  });
});

test("DEPENDENCY_MAP.md uses deterministic high-level hints without fake dependencies", async () => {
  await withGuardianLikeRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write", "--json"]);
    const data = JSON.parse(result.stdout);
    const dependencyMap = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "DEPENDENCY_MAP.md"), "utf8"));

    assert.equal(result.status, 0);
    assert.deepEqual(data.dependencies, [
      {
        from: "src/cli/index.ts",
        dependsOn: "src/core/config.ts",
        why: "CLI loads repository configuration before command behavior",
        inferred: true
      },
      {
        from: "src/cli/index.ts",
        dependsOn: "src/core/guardian.ts",
        why: "CLI delegates repository work to core modules",
        inferred: true
      },
      {
        from: "src/cli/index.ts",
        dependsOn: "src/renderers/markdown.ts",
        why: "CLI output may be formatted by renderer modules",
        inferred: true
      },
      {
        from: "src/core/guardian.ts",
        dependsOn: "src/analyzers/index.ts",
        why: "core mapping coordinates analyzer and risk-rule results",
        inferred: true
      },
      {
        from: "src/core/guardian.ts",
        dependsOn: "src/repo/index.ts",
        why: "core mapping consumes repository scanning/classification",
        inferred: true
      },
      {
        from: "src/core/guardian.ts",
        dependsOn: "src/core/config.ts",
        why: "core behavior is driven by configuration",
        inferred: true
      },
      {
        from: "src/analyzers/index.ts",
        dependsOn: "src/config/defaults.ts",
        why: "analyzers read configuration rules when present",
        inferred: true
      },
      {
        from: "src/renderers/markdown.ts",
        dependsOn: "src/core/guardian.ts",
        why: "renderers format the core report model",
        inferred: true
      },
      {
        from: "tests/cli.test.js",
        dependsOn: "tests/__snapshots__",
        why: "tests use fixtures or snapshots only as test context",
        inferred: true
      }
    ]);
    assert.match(dependencyMap, /CLI loads repository configuration before command behavior/);
    assert.match(dependencyMap, /renderers format the core report model/);
    assert.match(dependencyMap, /tests use fixtures or snapshots only as test context/);
    assert.doesNotMatch(dependencyMap, /\.project-brain\/metrics|businessAreaAnalyzer|templates\/\*/);
    assert.doesNotMatch(dependencyMap, /path heuristic fallback|likely touches persistence|auth\/security path/i);
    assert.ok(!data.dependencies.some((dependency) => dependency.from.startsWith("tests/fixtures/")));
    assert.ok(!data.dependencies.some((dependency) => dependency.from.startsWith("tests/__snapshots__/")));
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
    const fixtures = moduleByName(data, "Tests / Fixtures");

    assert.equal(result.status, 0);
    assert.ok(auth.primaryFiles.includes("src/analyzers/securityAnalyzer.ts"));
    assert.ok(auth.primaryFiles.includes("templates/project-brain/security-rules.md"));
    assert.ok(!auth.primaryFiles.some((file) => file.startsWith("tests/fixtures/")));
    assert.ok(fixtures.primaryFiles.includes("tests/fixtures/project-brain/complete/.project-brain/security-rules.md"));

    assert.match(taskRouting, /Auth\/access \| `src\/analyzers\/securityAnalyzer\.ts`, `templates\/project-brain\/security-rules\.md`/);
    const normalRouting = headingSection(taskRouting, "Task Routing")
      .split(/\r?\n/)
      .filter((line) => !line.includes("Test fixture/snapshot updates"))
      .join("\n");
    assert.doesNotMatch(normalRouting, /tests\/fixtures\/project-brain\/complete\/\.project-brain\/security-rules\.md/);
    assert.doesNotMatch(moduleSection(moduleIndex, "Auth/access"), /tests\/fixtures\/project-brain\/complete\/\.project-brain\/security-rules\.md/);
    assert.match(moduleSection(moduleIndex, "Tests / Fixtures"), /tests\/fixtures\/project-brain\/complete\/\.project-brain\/security-rules\.md/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("map keeps test-fixture-only auth and database evidence out of domain routing", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-map-test-fixtures-"));

  try {
    assert.equal(runCli(tempDir, ["init"]).status, 0);
    await writeFixture(tempDir, "package.json", JSON.stringify({
      scripts: {
        build: "tsc",
        lint: "eslint .",
        test: "node --test tests/*.test.js"
      }
    }, null, 2));
    await writeFixture(tempDir, "src/cli/index.ts", "export function runCli() { return true; }\n");
    await writeFixture(tempDir, "tests/test-fixtures/auth/session.ts", "export const fixtureSession = {};\n");
    await writeFixture(tempDir, "tests/test-fixtures/migrations/001-create-users.sql", "create table users(id text);\n");
    await writeFixture(tempDir, "tests/__fixtures__/db/client.ts", "export const dbFixture = {};\n");

    const result = runCli(tempDir, ["map", "--write", "--json"]);
    const data = JSON.parse(result.stdout);
    const taskRouting = generatedSection(await readFile(path.join(tempDir, "docs", "ai-context", "TASK_ROUTING.md"), "utf8"));
    const fixtureRow = tableRow(taskRouting, "Test fixture/snapshot updates");

    assert.equal(result.status, 0);
    assert.doesNotMatch(taskRouting, /\| Auth\/access \|/);
    assert.doesNotMatch(taskRouting, /\| Database\/migrations \|/);
    assert.match(fixtureRow, /tests\/test-fixtures\/auth\/session\.ts/);
    assert.match(fixtureRow, /tests\/test-fixtures\/migrations\/001-create-users\.sql/);
    assert.ok(!data.risks.some((risk) => risk.area.includes("Auth/access")));
    assert.ok(!data.risks.some((risk) => risk.area.includes("Database/migrations")));
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
    assert.ok(data.dependencies.some((dependency) => dependency.from.startsWith("src/cli/")));
    assert.ok(!data.dependencies.some((dependency) => /path heuristic fallback|likely touches persistence/i.test(dependency.why)));
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
