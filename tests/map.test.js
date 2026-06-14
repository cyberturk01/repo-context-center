const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const generatedStart = "<!-- repo-context-center:generated:start -->";

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

test("CHANGE_LOG.md records map generation", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "CHANGE_LOG.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /`repo-context-center map --write`/);
    assert.match(content, /generated repo-specific context map/);
  });
});

test("LESSONS_LEARNED.md does not invent history", async () => {
  await withMappedRepo(async (tempDir) => {
    const result = runCli(tempDir, ["map", "--write"]);
    const content = await readFile(path.join(tempDir, "docs", "ai-context", "LESSONS_LEARNED.md"), "utf8");

    assert.equal(result.status, 0);
    assert.match(content, /No generated lessons yet\. Add stable lessons manually after repeated issues\./);
    assert.doesNotMatch(content, /2026-/);
  });
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
