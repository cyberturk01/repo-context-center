import type { MeasureReport } from "./measureTypes";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function formatPercent(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function renderMeasureJson(report: MeasureReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderMeasureText(report: MeasureReport): string {
  const ignoredLabel = report.ignoredExamples.length > 0 ? report.ignoredExamples.join(", ") : "none";
  const unsupportedLabel = report.unsupportedExamples.length > 0 ? report.unsupportedExamples.join(", ") : "none";
  const capLabel = report.scanCapExamples.length > 0 ? report.scanCapExamples.join(", ") : "none";
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
    "Ignored by RCC rules:",
    `${formatNumber(report.ignoredFiles)}`,
    "Representative ignored paths:",
    "Examples only; these are not necessarily full excluded directories.",
    ignoredLabel,
    "",
    "Unsupported or non-source files:",
    `${formatNumber(report.unsupportedFiles)}`,
    "Representative unsupported paths:",
    "Examples only; these are not necessarily full excluded directories.",
    unsupportedLabel,
    "",
    "Skipped because scan cap was reached:",
    `${formatNumber(report.skippedByScanCap)}`,
    "Representative scan-cap paths:",
    "Examples only; these are not necessarily full excluded directories.",
    capLabel,
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
