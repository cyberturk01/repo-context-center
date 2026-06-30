import path from "node:path";
import { parseTaskIntent } from "./parseTaskIntent";
import { discoverCandidates } from "./discoverCandidates";
import { classifyRelationships } from "./classifyRelationships";
import { scoreRelationships } from "./scoreRelationships";
import { detectDomains, taskMentionsDomain } from "../domainEngine";
import { buildWorkFileCategorization } from "../../cli/work/taskFileRecommendations";
import { classifyTaskSize } from "../../cli/work/taskSize";
import type { CandidateFile, TaskAnalysisOptions, TaskAnalysisResult } from "./types";

function candidateFromRecommendation(item: { path: string; reasons: string[] }, fallback: string): CandidateFile {
  const reason = item.reasons[0] ?? fallback;

  return {
    path: item.path,
    reason,
    reasons: item.reasons.length > 0 ? item.reasons : [reason]
  };
}

function basis(changedFiles: string[], routeFiles: CandidateFile[]): TaskAnalysisResult["basis"] {
  if (changedFiles.length > 0 && routeFiles.length > 0) {
    return "changed-files-and-task";
  }
  if (changedFiles.length > 0) {
    return "changed-files";
  }
  return "task";
}

export async function buildTaskAnalysis(
  cwd: string,
  task: string,
  options: TaskAnalysisOptions = {}
): Promise<TaskAnalysisResult> {
  const repoRoot = path.resolve(cwd);
  const taskIntent = parseTaskIntent(task);
  const discovered = await discoverCandidates(repoRoot, task, taskIntent, options);
  const relationships = classifyRelationships({
    task,
    startup: discovered.focusedStartupContext,
    lookupHints: discovered.lookupHints,
    readFirstGuidance: discovered.readFirstGuidance,
    taskIntent,
    learnedSignals: discovered.learnedSignals,
    changedFiles: discovered.changedFiles,
    maxFiles: discovered.maxFiles
  });
  const primaryFiles = relationships.preliminaryCategories.primaryFiles
    .map((item) => candidateFromRecommendation(item, "task route candidate"));
  const scored = await scoreRelationships({
    cwd: discovered.repoRoot,
    task,
    changedFiles: discovered.changedFiles,
    primaryFiles,
    affectedFiles: relationships.affectedFiles,
    contextChanges: relationships.contextChanges,
    routeFiles: relationships.routeFiles,
    routeTests: relationships.routeTests,
    workSourcePaths: relationships.sourcePaths,
    learnedSignals: discovered.learnedSignals,
    docsOnlyReadmeTask: relationships.docsOnlyReadmeTask,
    maxFiles: discovered.maxFiles
  });
  const finalFileCategories = buildWorkFileCategorization(
    relationships.categorized,
    discovered.focusedStartupContext,
    discovered.lookupHints,
    taskIntent,
    scored.filteredLearnedSignals,
    scored.workAffectedTests.map((file) => file.path)
  );
  const taskSize = classifyTaskSize(task);
  const domains = detectDomains({
    task,
    affectedFilePaths: relationships.affectedFiles.map((file) => file.path),
    affectedTestPaths: scored.testCandidates.map((test) => test.path),
    contextPaths: relationships.contextChanges.map((file) => file.path),
    includeContext: true
  });
  const notes = [
    "Heuristic MVP: combines git working-tree changes, RCC task routing, learned test signals, and scored affected test candidates.",
    ...(discovered.taskOnly ? ["Task-only mode: ignored git working-tree changes."] : []),
    "This is not a full static dependency analysis.",
    ...(scored.docsOnlyImpact ? ["Docs-only impact detected; no focused test command suggested."] : []),
    ...(relationships.filteredWeakCount > 0 ? ["Filtered weak semantic source candidates from affectedFiles."] : []),
    ...(relationships.affectedFiles.length === 0 && scored.testCandidates.length > 0 ? ["No high-confidence affected source files found."] : [])
  ];

  return {
    task,
    taskIntent,
    normalizedTaskKeywords: taskIntent.lookupTerms,
    domains,
    taskMentionsContext: taskMentionsDomain(task, "context"),
    routingConfidence: scored.confidence,
    taskSize: taskSize.size,
    taskMode: taskSize.mode,
    taskSizeConfidence: taskSize.confidence,
    taskSizeReasons: taskSize.reasons,
    primaryFiles,
    supportingFiles: finalFileCategories.supportingFiles,
    affectedFiles: relationships.affectedFiles,
    affectedTests: scored.testCandidates,
    suggestedCommands: scored.verification.commands,
    testCandidates: scored.testCandidates,
    testEvidence: scored.testEvidence,
    testClassifications: scored.testClassifications,
    contextChanges: relationships.contextChanges,
    confidence: scored.confidence,
    verification: scored.verification,
    changedFiles: relationships.changedFilesWithReasons,
    basis: basis(discovered.changedFiles, relationships.routeFiles),
    mode: discovered.taskOnly ? "task-only" : "working-tree",
    routeFiles: relationships.routeFiles,
    routeTests: relationships.routeTests,
    notes,
    filteredWeakCount: relationships.filteredWeakCount,
    docsOnlyImpact: scored.docsOnlyImpact,
    work: {
      startupContext: discovered.startupContext,
      focusedStartupContext: discovered.focusedStartupContext,
      mapFreshness: discovered.mapFreshness,
      decisions: discovered.decisions,
      logs: discovered.logs,
      lookupHints: discovered.lookupHints,
      readFirstGuidance: discovered.readFirstGuidance,
      taskIntent,
      learnedSignals: discovered.learnedSignals,
      filteredLearnedSignals: scored.filteredLearnedSignals,
      categorized: relationships.categorized,
      fileCategories: finalFileCategories,
      affectedTests: scored.workAffectedTests
    }
  };
}
