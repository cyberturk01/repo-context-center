#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");
const task = "fix workflow risk detection";
const runCount = 5;

function runWork() {
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
      `rcc work failed with status ${result.status}`,
      result.stderr.trim(),
      result.stdout.trim()
    ].filter(Boolean).join("\n"));
  }

  return {
    raw: result.stdout,
    parsed: JSON.parse(result.stdout)
  };
}

const runs = Array.from({ length: runCount }, runWork);
const firstRaw = runs[0].raw;
const firstEquivalent = JSON.stringify(runs[0].parsed);
const outputsIdentical = runs.every((run) => run.raw === firstRaw);
const outputsEquivalent = runs.every((run) => JSON.stringify(run.parsed) === firstEquivalent);
const estimates = runs.map((run) => {
  const estimate = run.parsed.tokens?.jsonEstimate;
  return Number.isFinite(estimate) ? estimate : Math.ceil(run.raw.length / 4);
});
const totalJsonTokenEstimate = estimates.reduce((total, value) => total + value, 0);
const averageJsonTokenEstimate = totalJsonTokenEstimate / runCount;
const potentialWastedTokensAfterFirstRun = totalJsonTokenEstimate - estimates[0];

console.log(JSON.stringify({
  task,
  runCount,
  outputsIdentical,
  outputsEquivalent,
  averageJsonTokenEstimate,
  totalRepeatedTokenEstimate: totalJsonTokenEstimate,
  potentialWastedTokensAfterFirstRun
}, null, 2));
