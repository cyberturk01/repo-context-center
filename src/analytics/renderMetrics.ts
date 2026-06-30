import type { RepositoryMetrics } from "./metricsTypes";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function formatPercent(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function renderMetricsText(metrics: RepositoryMetrics): string {
  return `${[
    "repo-context-center metrics",
    "",
    `Task: ${metrics.task}`,
    "",
    "Routing:",
    `- Task size: ${metrics.routing.taskSize}`,
    `- Task mode: ${metrics.routing.taskMode}`,
    `- Task size confidence: ${metrics.routing.taskSizeConfidence}`,
    `- Context budget: ${metrics.routing.contextBudget}`,
    `- Primary files: ${formatNumber(metrics.routing.primaryFiles)}`,
    `- Supporting files: ${formatNumber(metrics.routing.supportingFiles)}`,
    `- Optional supporting files: ${formatNumber(metrics.routing.optionalSupportingFiles)}`,
    `- Tests: ${formatNumber(metrics.routing.tests)}`,
    `- Read first: ${formatNumber(metrics.routing.readFirst)}`,
    "",
    "Token savings:",
    `- Naive tokens: ${formatNumber(metrics.tokens.naiveTokens)}`,
    `- RCC tokens: ${formatNumber(metrics.tokens.rccTokens)}`,
    `- Estimated saving: ${formatNumber(metrics.tokens.estimatedSavingTokens)} tokens (${formatPercent(metrics.tokens.estimatedSavingPercent)}%)`,
    "",
    "Freshness:",
    `- Status: ${metrics.freshness.status}`,
    `- Score: ${metrics.freshness.score}`,
    `- Reason: ${metrics.freshness.reason}`,
    `- Affected files: ${formatNumber(metrics.freshness.affectedFiles)}`,
    `- Affected context files: ${formatNumber(metrics.freshness.affectedContextFiles)}`,
    "",
    "Impact:",
    `- Mode: ${metrics.impact.mode}`,
    `- Basis: ${metrics.impact.basis}`,
    `- Confidence: ${metrics.impact.confidence}`,
    `- Changed files: ${formatNumber(metrics.impact.summary.changedFiles)}`,
    `- Context changes: ${formatNumber(metrics.impact.summary.contextChanges)}`,
    `- Affected files: ${formatNumber(metrics.impact.summary.affectedFiles)}`,
    `- Affected tests: ${formatNumber(metrics.impact.summary.affectedTests)}`,
    `- Suggested commands: ${formatNumber(metrics.impact.summary.suggestedCommands)}`,
    "",
    "Verification:",
    `- Mode: ${metrics.verification.mode}`,
    `- Confidence: ${metrics.verification.confidence}`,
    `- Targeted tests: ${formatNumber(metrics.verification.targetedTests)}`,
    `- Targeted test commands: ${formatNumber(metrics.verification.targetedTestCommands)}`,
    `- Build commands: ${formatNumber(metrics.verification.buildCommands)}`,
    `- Smoke checks: ${formatNumber(metrics.verification.smokeChecks)}`,
    `- Manual checks: ${formatNumber(metrics.verification.manualChecks)}`
  ].join("\n")}\n`;
}

export function renderMetricsJson(metrics: RepositoryMetrics): string {
  return `${JSON.stringify(metrics, null, 2)}\n`;
}
