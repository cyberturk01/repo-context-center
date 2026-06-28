import { existsSync } from "node:fs";
import path from "node:path";
import { buildTaskAnalysis, type CandidateFile, type CandidateTest } from "../../core/task-analysis";
import type { ImpactAffectedTest, ImpactAnalysis, ImpactCommand, ImpactFile } from "./impactTypes";

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

function isRelativeInsideRepo(relativePath: string): boolean {
  return relativePath.length > 0 && relativePath !== "." && !relativePath.startsWith("../") && relativePath !== "..";
}

export function normalizeImpactPath(filePath: string, repoRoot: string): string {
  const normalizedPath = normalizeRepoPath(filePath);
  const absoluteRepoRoot = path.resolve(repoRoot);

  if (path.isAbsolute(normalizedPath)) {
    const relativePath = normalizeRepoPath(path.relative(absoluteRepoRoot, normalizedPath));

    return isRelativeInsideRepo(relativePath) ? relativePath : normalizedPath;
  }

  const repoBasename = path.basename(absoluteRepoRoot);
  const repoBasenamePrefix = `${repoBasename}/`;

  if (repoBasename.length > 0 && normalizedPath.toLowerCase().startsWith(repoBasenamePrefix.toLowerCase())) {
    const exactCasePrefix = normalizedPath.startsWith(repoBasenamePrefix);
    const strippedPath = normalizedPath.slice(repoBasenamePrefix.length);
    const prefixedExists = existsSync(path.join(absoluteRepoRoot, normalizedPath));
    const strippedExists = existsSync(path.join(absoluteRepoRoot, strippedPath));

    if (!exactCasePrefix || !prefixedExists || strippedExists) {
      return strippedPath;
    }
  }

  return normalizedPath;
}

function impactFiles(files: CandidateFile[]): ImpactFile[] {
  return files.map((file) => ({
    path: file.path,
    reason: file.reason
  }));
}

function impactTests(tests: CandidateTest[]): ImpactAffectedTest[] {
  return tests.map((test) => ({
    path: test.path,
    reason: test.reason,
    score: test.score,
    confidence: test.confidence as ImpactAffectedTest["confidence"],
    signals: test.signals
  }));
}

export async function buildImpactAnalysis(
  cwd: string,
  task: string,
  options: { maxFiles?: number; taskOnly?: boolean } = {}
): Promise<ImpactAnalysis> {
  const maxFiles = options.maxFiles ?? 50;
  const analysis = await buildTaskAnalysis(cwd, task, {
    maxFiles,
    taskOnly: options.taskOnly ?? false
  });
  const changedFiles = impactFiles(analysis.changedFiles).slice(0, maxFiles);
  const contextChanges = impactFiles(analysis.contextChanges);
  const affectedFiles = impactFiles(analysis.affectedFiles);
  const affectedTests = impactTests(analysis.testCandidates);
  const suggestedCommands = analysis.verification.commands as ImpactCommand[];

  return {
    schemaVersion: 1,
    command: "impact",
    task,
    mode: analysis.mode,
    basis: analysis.basis,
    summary: {
      changedFiles: changedFiles.length,
      contextChanges: contextChanges.length,
      affectedFiles: affectedFiles.length,
      affectedTests: affectedTests.length,
      suggestedCommands: suggestedCommands.length
    },
    changedFiles,
    contextChanges,
    affectedFiles,
    affectedTests,
    suggestedCommands,
    confidence: analysis.confidence.level,
    confidenceExplanation: analysis.confidence,
    verificationHints: analysis.verification.hints,
    notes: analysis.notes
  };
}
