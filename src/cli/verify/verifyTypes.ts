import type {
  ImpactAffectedTest,
  ImpactAnalysis,
  ImpactCommand,
  ImpactConfidenceExplanation,
  ImpactSummary,
  ImpactVerificationHint
} from "../impact/impactTypes";

export interface VerificationPlan {
  schemaVersion: 1;
  command: "verify";
  task: string;
  mode: ImpactAnalysis["mode"];
  summary: ImpactSummary;
  targetedTests: ImpactAffectedTest[];
  targetedTestCommands: ImpactCommand[];
  buildCommands: ImpactCommand[];
  smokeChecks: ImpactVerificationHint[];
  manualChecks: ImpactVerificationHint[];
  validationChecklist: string[];
  confidence: ImpactAnalysis["confidence"];
  confidenceExplanation: ImpactConfidenceExplanation;
  notes: string[];
}

export interface VerificationPlanInput {
  task: string;
  mode: VerificationPlan["mode"];
  summary: ImpactSummary;
  targetedTests?: ImpactAffectedTest[];
  targetedTestCommands?: ImpactCommand[];
  buildCommands?: ImpactCommand[];
  smokeChecks?: ImpactVerificationHint[];
  manualChecks?: ImpactVerificationHint[];
  validationChecklist?: string[];
  confidence: VerificationPlan["confidence"];
  confidenceExplanation: ImpactConfidenceExplanation;
  notes?: string[];
}

export interface VerifyOptions {
  json: boolean;
  task: string;
  taskOnly: boolean;
}
