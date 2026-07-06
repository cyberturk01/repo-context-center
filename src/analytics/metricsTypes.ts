import type { ImpactAnalysis } from "../cli/impact/impactTypes";
import type { MeasureReport } from "../cli/measure/measureTypes";
import type { VerificationPlan } from "../cli/verify/verifyTypes";
import type { WorkBrief } from "../cli/work/workTypes";
import type { EcosystemConfidence } from "../core/ecosystemDetector";

export interface RepositoryMetricsSources {
  work: WorkBrief;
  measure: MeasureReport;
  impact: ImpactAnalysis;
  verify: VerificationPlan;
}

export interface RepositoryRoutingMetrics {
  taskSize: WorkBrief["taskSize"];
  taskMode: WorkBrief["taskMode"];
  taskSizeConfidence: WorkBrief["taskSizeConfidence"];
  contextBudget: WorkBrief["contextBudget"];
  primaryFiles: number;
  supportingFiles: number;
  optionalSupportingFiles: number;
  tests: number;
  readFirst: number;
}

export interface RepositoryTokenMetrics {
  naiveTokens: MeasureReport["naiveTokens"];
  rccTokens: MeasureReport["rccTokens"];
  estimatedSavingTokens: MeasureReport["estimatedSavingTokens"];
  estimatedSavingPercent: MeasureReport["estimatedSavingPercent"];
}

export interface RepositoryFreshnessMetrics {
  status: WorkBrief["mapFreshness"]["status"];
  score: WorkBrief["mapFreshness"]["score"];
  reason: WorkBrief["mapFreshness"]["reason"];
  affectedFiles: number;
  affectedContextFiles: number;
}

export interface RepositoryImpactMetrics {
  mode: ImpactAnalysis["mode"];
  basis: ImpactAnalysis["basis"];
  summary: ImpactAnalysis["summary"];
  confidence: ImpactAnalysis["confidence"];
}

export interface RepositoryVerificationMetrics {
  mode: VerificationPlan["mode"];
  targetedTests: number;
  targetedTestCommands: number;
  buildCommands: number;
  smokeChecks: number;
  manualChecks: number;
  confidence: VerificationPlan["confidence"];
}

export interface RepositoryEcosystemMetrics {
  primary: string;
  confidence: EcosystemConfidence | "none";
  detected: number;
  signals: number;
  roots: number;
  monorepo: boolean;
  workspaceDetected: boolean;
  workspaceType: string;
  packageScope: string | null;
  workspacePackages: number;
  packageRoot: string | null;
  ids: string;
}

export interface RepositoryMetrics {
  schemaVersion: 1;
  command: "metrics";
  task: string;
  ecosystem: RepositoryEcosystemMetrics;
  routing: RepositoryRoutingMetrics;
  tokens: RepositoryTokenMetrics;
  freshness: RepositoryFreshnessMetrics;
  impact: RepositoryImpactMetrics;
  verification: RepositoryVerificationMetrics;
}
