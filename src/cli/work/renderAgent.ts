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

export function toAgentRoute(brief: WorkBrief, verbose: boolean): PublicAgentRoute {
  const withoutTokens: Omit<PublicAgentRoute, "briefTokens"> = {
    task: brief.task,
    primaryFiles: agentRouteItems(brief.primaryFiles, verbose),
    supportingFiles: agentRouteItems(brief.supportingFiles, verbose),
    tests: agentRouteItems(brief.tests, verbose),
    readFirst: agentReadFirstItems(brief, verbose),
    next: `Start with primaryFiles. Do not rerun work for this task. Use ${brief.nextCheapestCommand} only if needed.`
  };
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
