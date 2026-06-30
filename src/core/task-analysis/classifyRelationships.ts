import path from "node:path";
import { classifyRepoFile } from "../repoFileClassifier";
import { buildTaskFileRecommendations, buildWorkFileCategorization, uniquePaths } from "../../cli/work/taskFileRecommendations";
import type { LearnedRoutingSignals } from "../repositoryLearningRouting";
import type { StartupContext } from "../suggester";
import type { TaskIntentAnalysis } from "../taskIntent";
import type { ReadFirstGuidance, TargetedLookupHint, WorkRecommendation } from "../../cli/work/workTypes";
import type { CandidateFile, ContextChange } from "./types";

function candidateFile(pathValue: string, reason: string, reasons: string[] = [reason]): CandidateFile {
  return { path: pathValue, reason, reasons };
}

function recommendationReason(item: WorkRecommendation, fallback: string): string {
  return item.reasons[0] ?? fallback;
}

function candidatesFromRecommendations(items: WorkRecommendation[], fallback: string): CandidateFile[] {
  return items.map((item) => candidateFile(item.path, recommendationReason(item, fallback), item.reasons));
}

function mergeCandidates(groups: CandidateFile[][], maxFiles: number): CandidateFile[] {
  const seen = new Set<string>();
  const merged: CandidateFile[] = [];

  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.path)) {
        continue;
      }
      seen.add(item.path);
      merged.push(item);
      if (merged.length >= maxFiles) {
        return merged;
      }
    }
  }

  return merged;
}

function changedCandidateFiles(changedFiles: string[]): CandidateFile[] {
  return changedFiles
    .filter((file) => !classifyRepoFile(file).isNoise)
    .map((file) => candidateFile(file, "changed in working tree"));
}

export function isContextScaffoldingPath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
  const lowerPath = normalizedPath.toLowerCase();

  return lowerPath === "agents.md"
    || lowerPath === "claude.md"
    || lowerPath === "gemini.md"
    || lowerPath === ".github/copilot-instructions.md"
    || lowerPath === "docs/ai-context"
    || lowerPath === ".repo-context-center"
    || lowerPath === ".cursor"
    || lowerPath.startsWith("docs/ai-context/")
    || lowerPath.startsWith(".repo-context-center/")
    || lowerPath.startsWith(".cursor/");
}

export function isDocsOnlyPath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
  const basename = path.posix.basename(normalizedPath).toLowerCase();

  return basename === "readme.md"
    || normalizedPath.startsWith("docs/")
    || basename.endsWith(".md");
}

function isWeakSemanticCandidate(file: CandidateFile): boolean {
  return /\bweak semantic match\b/i.test(file.reason);
}

function isHighConfidenceRoutedFile(file: CandidateFile): boolean {
  if (isContextScaffoldingPath(file.path)) {
    return false;
  }

  return !isWeakSemanticCandidate(file);
}

function contextChangeFiles(changedFiles: CandidateFile[], routeFiles: CandidateFile[], maxFiles: number): ContextChange[] {
  return mergeCandidates([
    changedFiles.filter((file) => isContextScaffoldingPath(file.path)),
    routeFiles
      .filter((file) => isContextScaffoldingPath(file.path))
      .map((file) => candidateFile(file.path, file.reason === "changed in working tree" ? file.reason : `context candidate: ${file.reason}`, file.reasons))
  ], maxFiles);
}

function hasChangedNonDocsImpact(changedFiles: string[]): boolean {
  return changedFiles.some((file) => {
    const role = classifyRepoFile(file).role;
    return ["source", "config", "workflow", "package"].includes(role);
  });
}

function isExplicitReadmeDocsTask(task: string): boolean {
  return /\breadme(?:\.md)?\b/i.test(task)
    && !/\bpackage\.json\b/i.test(task)
    && !/\brelease\s+analy[sz]er\b/i.test(task)
    && !/\breleaseAnalyzer\b/.test(task)
    && !/\bpublish(?:ing)?\b/i.test(task)
    && !/\bnpm\s+package\b/i.test(task)
    && !/\bworkflow\b/i.test(task);
}

function preferReadmeDocsImpact(task: string, affectedFiles: CandidateFile[], changedFiles: string[]): CandidateFile[] {
  if (!isExplicitReadmeDocsTask(task) || hasChangedNonDocsImpact(changedFiles)) {
    return affectedFiles;
  }

  const docsFiles = affectedFiles.filter((file) => isDocsOnlyPath(file.path));
  const readmeFiles = docsFiles
    .filter((file) => path.posix.basename(file.path).toLowerCase() === "readme.md")
    .sort((left, right) => {
      if (left.path === "README.md") {
        return -1;
      }
      if (right.path === "README.md") {
        return 1;
      }
      return 0;
    });

  return readmeFiles.length > 0 ? readmeFiles : docsFiles;
}

export function classifyRelationships(input: {
  task: string;
  startup: StartupContext;
  lookupHints: TargetedLookupHint[];
  readFirstGuidance: ReadFirstGuidance;
  taskIntent: TaskIntentAnalysis;
  learnedSignals: LearnedRoutingSignals;
  changedFiles: string[];
  maxFiles: number;
}) {
  const categorized = buildTaskFileRecommendations(
    input.startup,
    input.lookupHints,
    input.readFirstGuidance,
    input.taskIntent
  );
  const preliminaryCategories = buildWorkFileCategorization(
    categorized,
    input.startup,
    input.lookupHints,
    input.taskIntent,
    input.learnedSignals,
    []
  );
  const sourcePaths = uniquePaths([
    ...preliminaryCategories.primaryFiles,
    ...preliminaryCategories.supportingFiles,
    ...categorized.taskFiles,
    ...input.learnedSignals.learnedRelatedFiles.map((file) => ({ path: file, reasons: [] }))
  ]
    .map((file) => file.path)
    .filter((file) => classifyRepoFile(file).role !== "test"));
  const changedFilesWithReasons = changedCandidateFiles(input.changedFiles);
  const routeFiles = candidatesFromRecommendations([
    ...preliminaryCategories.primaryFiles,
    ...preliminaryCategories.supportingFiles,
    ...categorized.taskFiles
  ], "task route candidate");
  const routeTests = candidatesFromRecommendations([
    ...preliminaryCategories.tests,
    ...categorized.supportingTests,
    ...categorized.relevantTests
  ], "task route test candidate");
  const highConfidenceRouteFiles = routeFiles.filter(isHighConfidenceRoutedFile);
  const contextChanges = contextChangeFiles(changedFilesWithReasons, routeFiles, input.maxFiles);
  const affectedFiles = mergeCandidates([
    changedFilesWithReasons.filter((file) => classifyRepoFile(file.path).role !== "test" && !isContextScaffoldingPath(file.path)),
    highConfidenceRouteFiles
  ], input.maxFiles);
  const readmeDocsImpact = preferReadmeDocsImpact(input.task, affectedFiles, input.changedFiles);
  const docsOnlyReadmeTask = readmeDocsImpact !== affectedFiles
    && readmeDocsImpact.length > 0
    && readmeDocsImpact.every((file) => isDocsOnlyPath(file.path));

  return {
    categorized,
    preliminaryCategories,
    sourcePaths,
    changedFilesWithReasons,
    routeFiles,
    routeTests,
    affectedFiles: readmeDocsImpact,
    contextChanges,
    docsOnlyReadmeTask,
    filteredWeakCount: routeFiles.filter((file) => isWeakSemanticCandidate(file) && !readmeDocsImpact.some((affected) => affected.path === file.path)).length
  };
}
