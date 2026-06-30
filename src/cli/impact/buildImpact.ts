import { existsSync } from "node:fs";
import path from "node:path";
import { buildTaskAnalysis, type CandidateFile, type CandidateTest, type TaskAnalysisResult } from "../../core/task-analysis";
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

function reasonText(file: CandidateFile): string {
  return [file.reason, ...file.reasons].join(" ");
}

function moduleKey(filePath: string): string {
  const parts = normalizeRepoPath(filePath).split("/").filter(Boolean);
  const packageRoot = ["apps", "libs", "packages", "services"].includes(parts[0] ?? "") && parts.length >= 2
    ? parts.slice(0, 2)
    : [];
  const sourceIndex = parts.findIndex((part) => ["lib", "src"].includes(part));
  const modulePart = sourceIndex >= 0 ? parts[sourceIndex + 1] : parts[packageRoot.length];

  if (packageRoot.length > 0 && modulePart) {
    return [...packageRoot, modulePart].join("/");
  }

  if (parts[0] && modulePart && parts[0] !== modulePart) {
    return [parts[0], modulePart].join("/");
  }

  return parts[0] ?? "";
}

function packageKey(filePath: string): string {
  const parts = normalizeRepoPath(filePath).split("/").filter(Boolean);

  if (["apps", "libs", "packages", "services"].includes(parts[0] ?? "") && parts.length >= 2) {
    return parts.slice(0, 2).join("/");
  }

  return parts[0] ?? "";
}

function affectedFileRank(
  file: CandidateFile,
  index: number,
  analysis: TaskAnalysisResult
): { score: number; index: number } {
  const relatedEvidence = [
    file,
    ...analysis.routeFiles.filter((item) => item.path === file.path),
    ...analysis.primaryFiles.filter((item) => item.path === file.path),
    ...analysis.changedFiles.filter((item) => item.path === file.path)
  ];
  const reasons = relatedEvidence.map(reasonText).join(" ");
  const routePaths = new Set(analysis.routeFiles.map((item) => item.path));
  const primaryPaths = new Set(analysis.primaryFiles.map((item) => item.path));
  const changedPaths = new Set(analysis.changedFiles.map((item) => item.path));
  const anchors = analysis.changedFiles.length > 0 ? analysis.changedFiles : analysis.primaryFiles;
  const anchorModules = new Set(anchors.map((item) => moduleKey(item.path)).filter(Boolean));
  const anchorPackages = new Set(anchors.map((item) => packageKey(item.path)).filter(Boolean));
  const candidateModule = moduleKey(file.path);
  const candidatePackage = packageKey(file.path);
  const hasTaskRoutingEvidence = routePaths.has(file.path) || /\b(task route|task routing|route candidate|recommended:)\b/i.test(reasons);
  const hasExactFilenameMatch = /\bexact filename(?:\/path)? match(?:ed)?\b/i.test(reasons);
  const hasFilenameMatch = /\b(matched filename stem|filename similarity|filename\/path contains query)\b/i.test(reasons);
  const hasSameModule = candidateModule.length > 0 && anchorModules.has(candidateModule);
  const hasDirectSourceRelationship = primaryPaths.has(file.path)
    || changedPaths.has(file.path)
    || /\b(changed in working tree|imports affected source|repository learning|co-change history)\b/i.test(reasons);
  const isChangedSource = changedPaths.has(file.path);
  const isUnrelatedPackageFilenameMatch = hasFilenameMatch
    && candidatePackage.length > 0
    && anchorPackages.size > 0
    && !anchorPackages.has(candidatePackage)
    && !hasSameModule
    && !hasExactFilenameMatch;

  let score = 0;

  if (hasTaskRoutingEvidence) score += 1000;
  if (hasExactFilenameMatch) score += 800;
  if (hasDirectSourceRelationship) score += 600;
  if (isChangedSource) score += 200;
  if (hasSameModule) score += 350;
  if (hasFilenameMatch) score += 120;
  if (isUnrelatedPackageFilenameMatch) score -= 300;

  return { score, index };
}

function rankedAffectedFiles(analysis: TaskAnalysisResult): ImpactFile[] {
  return impactFiles(
    analysis.affectedFiles
      .map((file, index) => ({
        file,
        rank: affectedFileRank(file, index, analysis)
      }))
      .sort((left, right) => right.rank.score - left.rank.score || left.rank.index - right.rank.index)
      .map((item) => item.file)
  );
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

function attachTaskContext(impact: ImpactAnalysis, taskContext: TaskAnalysisResult): ImpactAnalysis {
  Object.defineProperties(impact, {
    taskContext: {
      value: taskContext,
      enumerable: false,
      configurable: true
    },
    domainMatches: {
      value: taskContext.domains,
      enumerable: false,
      configurable: true
    },
    taskMentionsContext: {
      value: taskContext.taskMentionsContext,
      enumerable: false,
      configurable: true
    }
  });

  return impact;
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
  const affectedFiles = rankedAffectedFiles(analysis);
  const affectedTests = impactTests(analysis.affectedTests);
  const suggestedCommands = analysis.suggestedCommands as ImpactCommand[];

  return attachTaskContext({
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
    confidence: analysis.routingConfidence.level,
    confidenceExplanation: analysis.routingConfidence,
    verificationHints: analysis.verification.hints,
    notes: analysis.notes
  }, analysis);
}
