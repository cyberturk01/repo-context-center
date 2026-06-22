#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");

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

function valuesFrom(items) {
  return Array.isArray(items) ? items : [];
}

function pathMatches(actualPath, expectedPath) {
  return actualPath === expectedPath || actualPath.startsWith(expectedPath);
}

function missingExpected(actualPaths, expectedPaths = []) {
  return expectedPaths.filter((expectedPath) => !actualPaths.some((actualPath) => pathMatches(actualPath, expectedPath)));
}

function unexpectedPresent(actualPaths, expectedPaths = []) {
  return expectedPaths.filter((expectedPath) => actualPaths.some((actualPath) => pathMatches(actualPath, expectedPath)));
}

function failuresFor(brief, benchmarkCase) {
  const expect = benchmarkCase.expect ?? {};
  const primary = valuesFrom(brief.primaryFiles);
  const supporting = valuesFrom(brief.supportingFiles);
  const tests = valuesFrom(brief.tests);
  const failures = [
    ...missingExpected(primary, expect.primaryContains).map((file) => `missing primary ${file}`),
    ...unexpectedPresent(primary, expect.primaryNotContains).map((file) => `unexpected primary ${file}`),
    ...missingExpected(supporting, expect.supportingContains).map((file) => `missing supporting ${file}`),
    ...unexpectedPresent(supporting, expect.supportingNotContains).map((file) => `unexpected supporting ${file}`),
    ...missingExpected(tests, expect.testsContains).map((file) => `missing test ${file}`),
    ...unexpectedPresent(tests, expect.testsNotContains).map((file) => `unexpected test ${file}`)
  ];

  if (typeof expect.maxBriefTokens === "number" && brief.briefTokens > expect.maxBriefTokens) {
    failures.push(`brief tokens ${brief.briefTokens} > ${expect.maxBriefTokens}`);
  }

  return failures;
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
    briefTokens: brief.briefTokens ?? "-",
    status: statusFor(brief, benchmarkCase),
    details: failures.length > 0 ? failures.join("; ") : "-"
  };
}

function pad(value, width) {
  return String(value).padEnd(width, " ");
}

function printTable(rows) {
  const headers = ["Case", "First primary file", "Primary", "Supporting", "Tests", "Brief tokens", "Status", "Details"];
  const fields = ["name", "firstPrimaryFile", "primaryCount", "supportingCount", "testsCount", "briefTokens", "status", "details"];
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
