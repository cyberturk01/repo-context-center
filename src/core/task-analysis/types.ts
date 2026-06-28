import type { LearnedRoutingSignals } from "../repositoryLearningRouting";
import type { StartupContext } from "../suggester";
import type { TaskIntentAnalysis } from "../taskIntent";
import type { AffectedTestConfidence, ScoredAffectedTest } from "../../cli/shared/affectedTests";
import type { WorkFileCategorization, WorkMapFreshness, ReadFirstGuidance, TargetedLookupHint, WorkRecommendation } from "../../cli/work/workTypes";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface CandidateFile {
  path: string;
  reason: string;
  reasons: string[];
  confidence?: "high" | "medium" | "low" | AffectedTestConfidence | null;
  score?: number | null;
}

export interface CandidateTest extends CandidateFile {
  confidence: AffectedTestConfidence | "high" | "medium" | "low";
  score: number;
  signals: string[];
}

export interface ContextChange extends CandidateFile {}

export interface ConfidenceInfo {
  level: ConfidenceLevel;
  reasons: string[];
  evidence: {
    changedFiles: number;
    nonContextChangedFiles: number;
    contextChanges: number;
    affectedFiles: number;
    affectedTests: number;
    taskRoutingMatched: boolean;
    filenameStemMatched: boolean;
    contextOnlyChanges: boolean;
    testRelationship: "strong" | "weak" | "none";
  };
}

export interface VerificationCommand {
  command: string;
  type: "test" | "build" | "verification";
  scope: "focused" | "project";
  confidence: ConfidenceLevel;
  reason: string;
}

export interface VerificationPlan {
  commands: VerificationCommand[];
  hints: Array<{
    type: string;
    reason: string;
    command?: string;
    paths?: string[];
  }>;
}

export interface TaskAnalysisResult {
  task: string;
  primaryFiles: CandidateFile[];
  affectedFiles: CandidateFile[];
  testCandidates: CandidateTest[];
  contextChanges: ContextChange[];
  confidence: ConfidenceInfo;
  verification: VerificationPlan;
  changedFiles: CandidateFile[];
  basis: "changed-files-and-task" | "changed-files" | "task";
  mode: "working-tree" | "task-only";
  routeFiles: CandidateFile[];
  routeTests: CandidateFile[];
  notes: string[];
  filteredWeakCount: number;
  docsOnlyImpact: boolean;
  work: {
    startupContext: StartupContext;
    focusedStartupContext: StartupContext;
    mapFreshness: WorkMapFreshness;
    decisions: string[];
    logs: string[];
    lookupHints: TargetedLookupHint[];
    readFirstGuidance: ReadFirstGuidance;
    taskIntent: TaskIntentAnalysis;
    learnedSignals: LearnedRoutingSignals;
    filteredLearnedSignals: LearnedRoutingSignals;
    categorized: {
      taskFiles: WorkRecommendation[];
      supportingTests: WorkRecommendation[];
      workflowDocs: WorkRecommendation[];
      contextDocs: WorkRecommendation[];
      recommendedFiles: WorkRecommendation[];
      relevantTests: WorkRecommendation[];
      promoted: TargetedLookupHint[];
    };
    fileCategories: WorkFileCategorization;
    affectedTests: ScoredAffectedTest[];
  };
}

export interface TaskAnalysisOptions {
  contextBudget?: "minimal" | "balanced" | "deep";
  maxFiles?: number;
  taskOnly?: boolean;
}
