import { estimateNaiveScan, estimateSavingPercent } from "../../core/tokenEstimator";
import type { CliIO } from "../index";
import { buildCompactWorkBrief } from "./work";

interface MeasureOptions {
  json: boolean;
  task: string;
}

interface MeasureReport {
  task: string;
  naiveTokens: number;
  rccTokens: number;
  suggestedFiles: number;
  estimatedSavingTokens: number;
  estimatedSavingPercent: number;
}

const usage = 'Usage: repo-context-center measure "<task>" [--json]';
const naiveMaxFiles = Number.MAX_SAFE_INTEGER;

function parseMeasureOptions(args: string[]): MeasureOptions | undefined {
  let json = false;
  const taskParts: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("--")) {
      return undefined;
    }

    taskParts.push(arg);
  }

  const task = taskParts.join(" ").trim();
  if (!task) {
    return undefined;
  }

  return { json, task };
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function formatPercent(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function suggestedFileCount(brief: Awaited<ReturnType<typeof buildCompactWorkBrief>>): number {
  return new Set([
    ...brief.taskFiles.map((file) => file.path),
    ...brief.tests.map((file) => file.path)
  ]).size;
}

async function measureTask(cwd: string, task: string): Promise<MeasureReport> {
  const [naive, brief] = await Promise.all([
    estimateNaiveScan(cwd, naiveMaxFiles),
    buildCompactWorkBrief(cwd, task)
  ]);
  const rccTokens = brief.tokens.jsonEstimate;
  const estimatedSavingTokens = Math.max(0, naive.tokens - rccTokens);

  return {
    task,
    naiveTokens: naive.tokens,
    rccTokens,
    suggestedFiles: suggestedFileCount(brief),
    estimatedSavingTokens,
    estimatedSavingPercent: estimateSavingPercent(naive.tokens, rccTokens, estimatedSavingTokens)
  };
}

function formatMeasureReport(report: MeasureReport): string {
  return [
    "RCC measurement estimate",
    "",
    "Naive scan estimate:",
    `${formatNumber(report.naiveTokens)} tokens`,
    "",
    "RCC startup:",
    `${formatNumber(report.rccTokens)} tokens`,
    "",
    "Suggested files:",
    `${formatNumber(report.suggestedFiles)}`,
    "",
    "Estimated saving:",
    `${formatNumber(report.estimatedSavingTokens)} tokens (${formatPercent(report.estimatedSavingPercent)}%)`
  ].join("\n") + "\n";
}

export async function measureCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseMeasureOptions(args);
  if (!options) {
    io.stderr(`${usage}\n`);
    return 1;
  }

  const report = await measureTask(io.cwd, options.task);

  if (options.json) {
    io.stdout(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  }

  io.stdout(formatMeasureReport(report));
  return 0;
}
