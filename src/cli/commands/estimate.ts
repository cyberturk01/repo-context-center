import { estimateTokenCost, type EstimateMode, type TokenEstimateReport } from "../../core/tokenEstimator";
import type { CliIO } from "../index";

interface EstimateOptions {
  json: boolean;
  mode: EstimateMode;
  task?: string;
  compareNaive: boolean;
  maxFiles: number;
}

function parseEstimateOptions(args: string[]): EstimateOptions | undefined {
  let json = false;
  let mode: EstimateMode = "compact";
  let task: string | undefined;
  let compareNaive = false;
  let maxFiles = 500;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
    } else if (arg === "--compare-naive") {
      compareNaive = true;
    } else if (arg === "--mode") {
      const value = args[index + 1] as EstimateMode | undefined;
      if (value !== "compact" && value !== "investigation" && value !== "detailed") {
        return undefined;
      }
      mode = value;
      index += 1;
    } else if (arg === "--task") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }
      task = value;
      index += 1;
    } else if (arg === "--max-files") {
      const value = Number.parseInt(args[index + 1] ?? "", 10);
      if (!Number.isInteger(value) || value < 1) {
        return undefined;
      }
      maxFiles = value;
      index += 1;
    } else {
      return undefined;
    }
  }

  return { json, mode, task, compareNaive, maxFiles };
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? "not run" : value.toLocaleString("en-US");
}

function formatReport(report: TokenEstimateReport): string {
  const lines = [
    "repo-context-center token estimate",
    "",
    "Method:",
    `- Approximation: ${report.method}`,
    "",
    "Mode:",
    `- ${report.mode}`,
    "",
    "Context cost:",
    `- Startup context: ${formatNumber(report.startupTokens)} tokens`,
    `- On-demand context available: ${formatNumber(report.onDemandTokens)} tokens`,
    `- History/archive excluded: ${formatNumber(report.historyTokens)} tokens`,
    `- Included for mode: ${formatNumber(report.includedContextTokens)} tokens`
  ];

  if (report.naiveScanTokens !== undefined) {
    lines.push(
      "",
      "Naive comparison:",
      `- Estimated naive scan: ${formatNumber(report.naiveScanTokens)} tokens`,
      `- Estimated compact startup: ${formatNumber(report.startupTokens)} tokens`,
      `- Estimated saving: ${formatNumber(report.estimatedSavedTokens)} tokens`,
      `- Estimated saving: ${formatNumber(report.estimatedSavingPercent)}%`
    );

    if (report.naiveScanCapped) {
      lines.push(`- Naive scan capped at ${report.maxFiles} files`);
    }
  }

  if (report.taskEstimate) {
    lines.push(
      "",
      "Task recommendation:",
      `- Task: ${report.taskEstimate.task}`,
      `- Recommended context: ${formatNumber(report.taskEstimate.recommendedContextTokens)} tokens`,
      `- Likely source: ${formatNumber(report.taskEstimate.likelySourceTokens)} tokens`,
      `- Likely tests: ${formatNumber(report.taskEstimate.likelyTestTokens)} tokens`
    );
  }

  lines.push("", "Warnings:", ...report.warnings.map((warning) => `- ${warning}`));

  return `${lines.join("\n")}\n`;
}

export async function estimateCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseEstimateOptions(args);
  if (!options) {
    io.stderr(
      'Usage: repo-context-center estimate [--json] [--mode compact|investigation|detailed] [--task "<task>"] [--compare-naive] [--max-files <number>]\n'
    );
    return 1;
  }

  const report = await estimateTokenCost({
    cwd: io.cwd,
    mode: options.mode,
    task: options.task,
    compareNaive: options.compareNaive,
    maxFiles: options.maxFiles
  });

  if (options.json) {
    io.stdout(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  }

  io.stdout(formatReport(report));
  return 0;
}
