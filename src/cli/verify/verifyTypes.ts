import type {
  ImpactAffectedTest,
  ImpactAnalysis,
  ImpactCommand,
  ImpactConfidenceExplanation,
  ImpactSummary,
  ImpactVerificationHint
} from "../impact/impactTypes";

export type VerificationPriority = "critical" | "high" | "medium" | "low";

export type VerificationTargetedTest = Omit<ImpactAffectedTest, "score" | "signals"> & {
  priority: VerificationPriority;
};

export type VerificationCommand = ImpactCommand & {
  priority: VerificationPriority;
};

export type VerificationCheck = ImpactVerificationHint & {
  priority: VerificationPriority;
};

export interface VerificationPlan {
  schemaVersion: 1;
  command: "verify";
  task: string;
  mode: ImpactAnalysis["mode"];
  summary: ImpactSummary;
  targetedTests: VerificationTargetedTest[];
  targetedTestCommands: VerificationCommand[];
  buildCommands: VerificationCommand[];
  smokeChecks: VerificationCheck[];
  manualChecks: VerificationCheck[];
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

export type VerificationLevel = "minimal" | "balanced" | "deep";

export interface VerifyOptions {
  json: boolean;
  level: VerificationLevel;
  planned: boolean;
  task: string;
  taskOnly: boolean;
}
