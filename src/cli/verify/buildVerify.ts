import { buildTaskAnalysis, type CandidateFile, type CandidateTest } from "../../core/task-analysis";
import type { VerifyFile, VerifyReport, VerifyTest } from "./verifyTypes";

function verifyFile(file: CandidateFile): VerifyFile {
  return {
    path: file.path,
    reason: file.reason
  };
}

function verifyTest(test: CandidateTest): VerifyTest {
  return {
    path: test.path,
    reason: test.reason,
    score: test.score,
    confidence: test.confidence,
    signals: test.signals
  };
}

export async function buildVerifyReport(
  cwd: string,
  task: string,
  options: { maxFiles?: number; taskOnly?: boolean } = {}
): Promise<VerifyReport> {
  const analysis = await buildTaskAnalysis(cwd, task, {
    maxFiles: options.maxFiles ?? 50,
    taskOnly: options.taskOnly ?? false
  });

  return {
    schemaVersion: 1,
    command: "verify",
    task,
    mode: analysis.mode,
    primaryFiles: analysis.primaryFiles.map(verifyFile),
    affectedFiles: analysis.affectedFiles.map(verifyFile),
    testCandidates: analysis.testCandidates.map(verifyTest),
    confidence: analysis.confidence,
    verification: analysis.verification,
    notes: analysis.notes
  };
}
