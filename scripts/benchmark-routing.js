#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const {
  evaluateRoutingCase
} = require("../tests/helpers/routingEvaluation");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const fixturePath = path.join(repoRoot, "tests", "fixtures", "routing-cases.json");

const cases = JSON.parse(readFileSync(fixturePath, "utf8"));

function runWork(task) {
  const result = spawnSync(process.execPath, [
    cliPath,
    "work",
    task,
    "--agent"
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

function failuresFor(brief, benchmarkCase) {
  return evaluateRoutingCase(brief, benchmarkCase).failures;
}

function statusFor(brief, benchmarkCase) {
  return failuresFor(brief, benchmarkCase).length === 0 ? "pass" : "fail";
}

function rowFor(benchmarkCase) {
  const brief = runWork(benchmarkCase.task);
  const failures = failuresFor(brief, benchmarkCase);

  return {
    name: benchmarkCase.name,
    task: benchmarkCase.task,
    firstPrimaryFile: brief.primaryFiles?.[0] ?? "-",
    primaryCount: brief.primaryFiles?.length ?? 0,
    supportingCount: brief.supportingFiles?.length ?? 0,
    testsCount: brief.tests?.length ?? 0,
    readFirstCount: brief.readFirst?.length ?? 0,
    briefTokens: brief.briefTokens ?? "-",
    status: statusFor(brief, benchmarkCase),
    details: failures.length > 0 ? failures.join("; ") : "-"
  };
}

function pad(value, width) {
  return String(value).padEnd(width, " ");
}

function printTable(rows) {
  const headers = ["Case", "First primary file", "Primary", "Supporting", "Tests", "ReadFirst", "Brief tokens", "Status", "Details"];
  const fields = ["name", "firstPrimaryFile", "primaryCount", "supportingCount", "testsCount", "readFirstCount", "briefTokens", "status", "details"];
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

if (rows.some((row) => row.status === "fail")) {
  process.exitCode = 1;
}
