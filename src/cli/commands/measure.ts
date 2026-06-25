import { estimateNaiveScan, estimateSavingPercent } from "../../core/tokenEstimator";
import type { CliIO } from "../index";
import { buildAgentWorkRoute } from "../work/buildWorkBrief";
import type { PublicAgentRoute } from "../work/workTypes";

interface MeasureOptions {
  json: boolean;
  task: string;
}

interface MeasureReport {
  schemaVersion: 1;
  command: "measure";
  task: string;
  naiveTokens: number;
  rccTokens: number;
  filesCounted: number;
  filesExcluded: number;
  excludedExamples: string[];
  primaryFiles: number;
  supportingFiles: number;
  tests: number;
  estimatedSavingTokens: number;
  estimatedSavingPercent: number;
  warnings: string[];
}

const usage = 'Usage: rcc measure "<task>" [--json]';
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

function routeItemCount(items: PublicAgentRoute["primaryFiles"]): number {
  return items.length;
}

async function measureTask(cwd: string, task: string): Promise<MeasureReport> {
  const [naive, route] = await Promise.all([
    estimateNaiveScan(cwd, naiveMaxFiles),
    buildAgentWorkRoute(cwd, task)
  ]);
  const rccTokens = route.briefTokens;
  const estimatedSavingTokens = Math.max(0, naive.tokens - rccTokens);
  const warnings = naive.tokens > 5_000_000
    ? ["Warning: naive estimate is very large. Check excluded folders and generated files."]
    : [];

  return {
    schemaVersion: 1,
    command: "measure",
    task,
    naiveTokens: naive.tokens,
    rccTokens,
    filesCounted: naive.fileCount,
    filesExcluded: naive.excludedFileCount,
    excludedExamples: naive.excludedExamples,
    primaryFiles: routeItemCount(route.primaryFiles),
    supportingFiles: routeItemCount(route.supportingFiles),
    tests: routeItemCount(route.tests),
    estimatedSavingTokens,
    estimatedSavingPercent: estimateSavingPercent(naive.tokens, rccTokens, estimatedSavingTokens),
    warnings
  };
}

function formatMeasureReport(report: MeasureReport): string {
  const lines = [
    "RCC measurement",
    "",
    "Task:",
    report.task,
    "",
    "Naive source scan:",
    `${formatNumber(report.naiveTokens)} tokens`,
    "",
    "RCC route:",
    `${formatNumber(report.rccTokens)} tokens`,
    "",
    "Estimated saving:",
    `${formatNumber(report.estimatedSavingTokens)} tokens (${formatPercent(report.estimatedSavingPercent)}%)`,
    "",
    "Files counted:",
    `${formatNumber(report.filesCounted)}`,
    "",
    "Files excluded:",
    `${formatNumber(report.filesExcluded)}`,
    "",
    "Excluded examples:",
    report.excludedExamples.length > 0 ? report.excludedExamples.join(", ") : "none",
    "",
    "Primary files:",
    `${formatNumber(report.primaryFiles)}`,
    "",
    "Supporting files:",
    `${formatNumber(report.supportingFiles)}`,
    "",
    "Tests:",
    `${formatNumber(report.tests)}`
  ];

  if (report.warnings.length > 0) {
    lines.push("", ...report.warnings);
  }

  return lines.join("\n") + "\n";
}

export async function measureCommand(io: CliIO, args: string[] = []): Promise<number> {
  if (args.includes("--compare-naive")) {
    io.stderr("--compare-naive is supported by estimate, not measure. Use: rcc estimate --compare-naive\n");
    return 1;
  }

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
