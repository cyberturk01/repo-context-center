import { estimateNaiveScan, estimateSavingPercent } from "../../core/tokenEstimator";
import { buildAgentWorkRoute } from "../work/buildWorkBrief";
import type { PublicAgentRoute } from "../work/workTypes";
import type { MeasureReport } from "./measureTypes";

const naiveMaxFiles = Number.MAX_SAFE_INTEGER;

function routeItemCount(items: PublicAgentRoute["primaryFiles"]): number {
  return items.length;
}

export async function buildMeasureReport(cwd: string, task: string): Promise<MeasureReport> {
  const [naive, route] = await Promise.all([
    estimateNaiveScan(cwd, naiveMaxFiles),
    buildAgentWorkRoute(cwd, task)
  ]);

  return measureReportFromRoute(task, route, naive);
}

export async function buildMeasureReportFromRoute(
  cwd: string,
  task: string,
  route: PublicAgentRoute
): Promise<MeasureReport> {
  const naive = await estimateNaiveScan(cwd, naiveMaxFiles);

  return measureReportFromRoute(task, route, naive);
}

function measureReportFromRoute(
  task: string,
  route: PublicAgentRoute,
  naive: Awaited<ReturnType<typeof estimateNaiveScan>>
): MeasureReport {
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
    ignoredFiles: naive.ignoredFileCount,
    ignoredExamples: naive.ignoredExamples,
    unsupportedFiles: naive.unsupportedFileCount,
    unsupportedExamples: naive.unsupportedExamples,
    skippedByScanCap: naive.skippedByScanCap,
    scanCapExamples: naive.scanCapExamples,
    primaryFiles: routeItemCount(route.primaryFiles),
    supportingFiles: routeItemCount(route.supportingFiles),
    tests: routeItemCount(route.tests),
    estimatedSavingTokens,
    estimatedSavingPercent: estimateSavingPercent(naive.tokens, rccTokens, estimatedSavingTokens),
    warnings
  };
}
