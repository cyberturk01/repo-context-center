#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

const cases = [
  {
    task: "fix workflow risk detection",
    expectedTaskFiles: [
      ".github/workflows/ai-project-guardian.yml",
      ".github/workflows/ci.yml",
      "package.json"
    ],
    expectedTests: ["tests/decision.test.js"]
  },
  {
    task: "improve rcc work output assembly",
    expectedTaskFiles: ["src/cli/commands/work.ts"],
    expectedTests: ["tests/work.test.js"]
  },
  {
    task: "fix Turkish task routing for workflow tasks",
    expectedTaskFiles: [
      ".github/workflows/ai-project-guardian.yml",
      "src/core/taskIntent.ts"
    ],
    expectedTests: ["tests/taskIntent.test.js"]
  },
  {
    task: "add token measurement mode",
    expectedTaskFiles: [
      "src/core/tokenEstimator.ts",
      "src/cli/commands/estimate.ts"
    ],
    expectedTests: ["tests/estimate.test.js"]
  },
  {
    task: "improve local vs global rcc warning",
    expectedTaskFiles: ["src/core/config.ts"],
    expectedTests: ["tests/cli.test.js"]
  }
];

function runWork(task) {
  const result = spawnSync(process.execPath, [
    cliPath,
    "work",
    task,
    "--json"
  ], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error([
      `rcc work failed for "${task}" with status ${result.status}`,
      result.stderr.trim(),
      result.stdout.trim()
    ].filter(Boolean).join("\n"));
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error([
      `rcc work returned invalid JSON for "${task}"`,
      error.message,
      result.stdout.trim()
    ].filter(Boolean).join("\n"));
  }
}

function pathsFrom(items) {
  return new Set((items ?? []).map((item) => item.path).filter(Boolean));
}

function statusFor(brief, benchmarkCase) {
  const taskFiles = pathsFrom(brief.taskFiles);
  const tests = pathsFrom(brief.tests);
  const hasExpectedSources = benchmarkCase.expectedTaskFiles.every((file) => taskFiles.has(file));
  const hasExpectedTests = benchmarkCase.expectedTests.every((file) => tests.has(file));

  if (!hasExpectedSources) {
    return "fail";
  }

  return hasExpectedTests ? "pass" : "warn";
}

function rowFor(benchmarkCase) {
  const brief = runWork(benchmarkCase.task);

  return {
    task: benchmarkCase.task,
    firstTaskFile: brief.taskFiles?.[0]?.path ?? "-",
    taskFilesCount: brief.taskFiles?.length ?? 0,
    testsCount: brief.tests?.length ?? 0,
    briefTokens: brief.tokens?.jsonEstimate ?? "-",
    status: statusFor(brief, benchmarkCase)
  };
}

function pad(value, width) {
  return String(value).padEnd(width, " ");
}

function printTable(rows) {
  const headers = ["Task", "First task file", "Task files count", "Tests count", "Brief tokens", "Status"];
  const fields = ["task", "firstTaskFile", "taskFilesCount", "testsCount", "briefTokens", "status"];
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => String(row[fields[index]]).length)
  ));

  console.log(headers.map((header, index) => pad(header, widths[index])).join(" | "));
  console.log(widths.map((width) => "-".repeat(width)).join("-|-"));

  for (const row of rows) {
    console.log(fields.map((field, index) => pad(row[field], widths[index])).join(" | "));
  }
}

const rows = cases.map(rowFor);
printTable(rows);
