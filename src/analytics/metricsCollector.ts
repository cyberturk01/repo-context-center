import { buildImpactAnalysisFromTaskContext } from "../cli/impact/buildImpact";
import { buildMeasureReportFromRoute } from "../cli/measure/buildMeasure";
import { buildVerificationPlanFromImpact } from "../cli/verify/buildVerify";
import { buildWorkBriefFromTaskContext } from "../cli/work/buildWorkBrief";
import { toAgentRoute } from "../cli/work/renderAgent";
import { buildTaskAnalysis } from "../core/task-analysis";
import type { RepositoryMetrics, RepositoryMetricsSources } from "./metricsTypes";

export function repositoryMetricsFromSources(sources: RepositoryMetricsSources): RepositoryMetrics {
  const { work, measure, impact, verify } = sources;

  return {
    schemaVersion: 1,
    command: "metrics",
    task: work.task,
    routing: {
      taskSize: work.taskSize,
      taskMode: work.taskMode,
      taskSizeConfidence: work.taskSizeConfidence,
      contextBudget: work.contextBudget,
      primaryFiles: work.primaryFiles.length,
      supportingFiles: work.supportingFiles.length,
      optionalSupportingFiles: work.optionalSupportingFiles.length,
      tests: work.tests.length,
      readFirst: work.readFirst.length
    },
    tokens: {
      naiveTokens: measure.naiveTokens,
      rccTokens: measure.rccTokens,
      estimatedSavingTokens: measure.estimatedSavingTokens,
      estimatedSavingPercent: measure.estimatedSavingPercent
    },
    freshness: {
      status: work.mapFreshness.status,
      score: work.mapFreshness.score,
      reason: work.mapFreshness.reason,
      affectedFiles: work.mapFreshness.affectedFiles.length,
      affectedContextFiles: work.mapFreshness.affectedContextFiles.length
    },
    impact: {
      mode: impact.mode,
      basis: impact.basis,
      summary: impact.summary,
      confidence: impact.confidence
    },
    verification: {
      mode: verify.mode,
      targetedTests: verify.targetedTests.length,
      targetedTestCommands: verify.targetedTestCommands.length,
      buildCommands: verify.buildCommands.length,
      smokeChecks: verify.smokeChecks.length,
      manualChecks: verify.manualChecks.length,
      confidence: verify.confidence
    }
  };
}

export async function buildRepositoryMetrics(cwd: string, task: string): Promise<RepositoryMetrics> {
  const maxFiles = 50;
  const contextBudget = "balanced";
  const taskContext = await buildTaskAnalysis(cwd, task, {
    contextBudget,
    maxFiles,
    taskOnly: true
  });
  const work = buildWorkBriefFromTaskContext(taskContext, contextBudget);
  const route = toAgentRoute(work, false);
  const measure = await buildMeasureReportFromRoute(cwd, task, route);
  const impactContext = await buildTaskAnalysis(cwd, task, {
    maxFiles,
    taskOnly: false
  });
  const impact = buildImpactAnalysisFromTaskContext(impactContext, { maxFiles });
  const verify = buildVerificationPlanFromImpact(impact);

  return repositoryMetricsFromSources({
    work,
    measure,
    impact,
    verify
  });
}
