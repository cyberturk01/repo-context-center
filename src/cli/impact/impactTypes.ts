import type { WorkRecommendation } from "../work/workTypes";

export interface ImpactOptions {
  json: boolean;
  maxFiles: number;
  task: string;
}

export interface ImpactFile {
  path: string;
  reason: string;
}

export interface ImpactCommand {
  command: string;
  type: "test" | "build" | "verification";
  scope: "focused" | "project";
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface ImpactAnalysis {
  schemaVersion: 1;
  command: "impact";
  task: string;
  basis: "changed-files-and-task" | "changed-files" | "task";
  changedFiles: ImpactFile[];
  contextChanges: ImpactFile[];
  affectedFiles: ImpactFile[];
  affectedTests: ImpactFile[];
  suggestedCommands: ImpactCommand[];
  confidence: "high" | "medium" | "low";
  notes: string[];
}

export function recommendationReason(item: WorkRecommendation, fallback: string): string {
  return item.reasons[0] ?? fallback;
}
