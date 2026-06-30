import type { WorkRecommendation } from "../work/workTypes";
import type { AffectedTestConfidence } from "../shared/affectedTests";
import type { TaskAnalysisResult } from "../../core/task-analysis";
import type { DomainMatch } from "../../core/domainEngine";

export interface ImpactOptions {
  json: boolean;
  maxFiles: number;
  task: string;
  taskOnly: boolean;
}

export interface ImpactFile {
  path: string;
  reason: string;
}

export interface ImpactAffectedTest extends ImpactFile {
  score: number;
  confidence: AffectedTestConfidence;
  signals: string[];
}

export interface ImpactCommand {
  command: string;
  type: "test" | "build" | "verification";
  scope: "focused" | "project";
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface ImpactConfidenceExplanation {
  level: "high" | "medium" | "low";
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

export interface ImpactSummary {
  changedFiles: number;
  contextChanges: number;
  affectedFiles: number;
  affectedTests: number;
  suggestedCommands: number;
}

export interface ImpactVerificationHint {
  type: string;
  reason: string;
  command?: string;
  paths?: string[];
}

export interface ImpactAnalysis {
  schemaVersion: 1;
  command: "impact";
  task: string;
  mode: "working-tree" | "task-only" | "planned-task";
  basis: "changed-files-and-task" | "changed-files" | "task";
  summary: ImpactSummary;
  changedFiles: ImpactFile[];
  contextChanges: ImpactFile[];
  affectedFiles: ImpactFile[];
  affectedTests: ImpactAffectedTest[];
  suggestedCommands: ImpactCommand[];
  confidence: "high" | "medium" | "low";
  confidenceExplanation: ImpactConfidenceExplanation;
  verificationHints: ImpactVerificationHint[];
  notes: string[];
  taskContext?: TaskAnalysisResult;
  domainMatches?: DomainMatch[];
  taskMentionsContext?: boolean;
}

export function recommendationReason(item: WorkRecommendation, fallback: string): string {
  return item.reasons[0] ?? fallback;
}
