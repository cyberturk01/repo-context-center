import type {
  PublicAgentRoute,
  PublicAgentRouteItem,
  PublicCompactWorkFile,
  WorkBrief,
  WorkRecommendation
} from "./workTypes";

function compactRecommendationSignal(recommendation: WorkRecommendation): PublicCompactWorkFile {
  const reason = recommendation.reasons[0];

  return reason ? { path: recommendation.path, reason } : { path: recommendation.path };
}

function agentRouteItems(items: WorkRecommendation[], verbose: boolean): PublicAgentRouteItem[] {
  if (!verbose) {
    return items.map((item) => item.path);
  }

  return items.map(compactRecommendationSignal);
}

function agentReadFirstItems(brief: WorkBrief, verbose: boolean): PublicAgentRouteItem[] {
  const readFirstFiles = brief.readFirstGuidance.required.length > 0
    ? brief.readFirstGuidance.required.map((item) => item.path)
    : brief.readFirst;

  if (!verbose) {
    return readFirstFiles;
  }

  const guidanceItems = brief.readFirstGuidance.required;

  return readFirstFiles.map((filePath) => {
    const guidance = guidanceItems.find((item) => item.path === filePath);
    return guidance ? { path: filePath, reason: guidance.reason } : { path: filePath };
  });
}

function agentNext(brief: WorkBrief): string {
  if (brief.tests.length === 0) {
    if (brief.taskSize === "tiny") {
      return "Tiny task: open only the primary file and apply the fix. No strongly related tests found; do not add generic tests. Do not rerun rcc work for this task.";
    }

    if (brief.taskSize === "small") {
      return "Small task: open only the primary file and apply the fix. No strongly related tests found; do not add generic tests. Do not rerun rcc work for this task.";
    }

    return "Start with primaryFiles. No strongly related tests found; do not add generic tests. Do not rerun rcc work for this task.";
  }

  if (brief.taskSize === "tiny") {
    return "Tiny task: open only the primary file, apply the fix, run the narrowest relevant test, and skip broad exploration unless the primary file is wrong. Do not rerun rcc work for this task.";
  }

  if (brief.taskSize === "small") {
    return "Small task: open only the primary file, apply the fix, run the narrowest relevant test, and skip broad exploration. Do not rerun rcc work for this task.";
  }

  return `Start with primaryFiles. Do not rerun rcc work for this task. Use ${brief.nextCheapestCommand} only if needed.`;
}

export function toAgentRoute(brief: WorkBrief, verbose: boolean): PublicAgentRoute {
  const withoutTokens: Omit<PublicAgentRoute, "briefTokens"> = {
    task: brief.task,
    taskSize: brief.taskSize,
    mode: brief.taskMode,
    primaryFiles: agentRouteItems(brief.primaryFiles, verbose),
    supportingFiles: agentRouteItems(brief.supportingFiles, verbose),
    tests: agentRouteItems(brief.tests, verbose),
    readFirst: agentReadFirstItems(brief, verbose),
    next: agentNext(brief)
  };
  if (verbose && brief.optionalSupportingFiles.length > 0) {
    withoutTokens.optionalSupportingFiles = agentRouteItems(brief.optionalSupportingFiles, verbose);
  }
  const preliminary = { ...withoutTokens, briefTokens: 0 };
  const briefTokens = Math.ceil(JSON.stringify(preliminary).length / 4);

  return {
    ...withoutTokens,
    briefTokens
  };
}

export function renderWorkBriefAgentJson(brief: WorkBrief, verbose: boolean): string {
  return `${JSON.stringify(toAgentRoute(brief, verbose))}\n`;
}

export function renderAgent(brief: WorkBrief, verbose: boolean): string {
  return renderWorkBriefAgentJson(brief, verbose);
}
