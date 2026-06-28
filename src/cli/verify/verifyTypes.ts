import type { ConfidenceInfo, VerificationCommand } from "../../core/task-analysis";

export interface VerifyOptions {
  json: boolean;
  maxFiles: number;
  task: string;
  taskOnly: boolean;
}

export interface VerifyFile {
  path: string;
  reason: string;
}

export interface VerifyTest extends VerifyFile {
  score: number;
  confidence: string;
  signals: string[];
}

export interface VerifyReport {
  schemaVersion: 1;
  command: "verify";
  task: string;
  mode: "working-tree" | "task-only";
  primaryFiles: VerifyFile[];
  affectedFiles: VerifyFile[];
  testCandidates: VerifyTest[];
  confidence: ConfidenceInfo;
  verification: {
    commands: VerificationCommand[];
    hints: Array<{
      type: string;
      reason: string;
      command?: string;
      paths?: string[];
    }>;
  };
  notes: string[];
}
