import { uniquePaths } from "./taskFileRecommendations";
import type {
  CompactWorkBrief,
  PublicCompactWorkFile,
  PublicReadFirstGuidanceItem,
  PublicTargetedLookupHint,
  PublicWorkBrief,
  PublicWorkFile,
  PublicWorkRisk,
  ReadFirstGuidanceItem,
  TargetedLookupHint,
  WorkBrief,
  WorkRecommendation
} from "./workTypes";

function publicGuidanceItems(items: ReadFirstGuidanceItem[]): PublicReadFirstGuidanceItem[] {
  return items.map((item) => ({
    path: item.path,
    reason: item.reason
  }));
}

function publicLookupHints(hints: Array<Omit<TargetedLookupHint, "index">>): PublicTargetedLookupHint[] {
  return hints.map((hint) => ({
    path: hint.path,
    reason: hint.reason || null,
    confidence: hint.confidence,
    score: hint.score,
    signal: hint.signal
  }));
}

function recommendationSignal(
  recommendation: WorkRecommendation,
  lookupHints: PublicTargetedLookupHint[]
): PublicWorkFile {
  const matchingHint = lookupHints.find((hint) => hint.path === recommendation.path);
  if (matchingHint) {
    return {
      path: recommendation.path,
      reason: matchingHint.reason,
      confidence: matchingHint.confidence,
      score: matchingHint.score
    };
  }

  return {
    path: recommendation.path,
    reason: recommendation.reasons.length > 0 ? recommendation.reasons.join("; ") : null,
    confidence: recommendation.reasons.length > 0 ? "medium" : null,
    score: recommendation.reasons.length > 0 ? 50 : null
  };
}

function compactRecommendationSignal(recommendation: WorkRecommendation): PublicCompactWorkFile {
  const reason = recommendation.reasons[0];

  return reason ? { path: recommendation.path, reason } : { path: recommendation.path };
}

function publicRisks(risks: string[]): PublicWorkRisk[] {
  if (risks.length === 0) {
    return [];
  }

  const [level, ...reasons] = risks;
  return [
    {
      level,
      reason: reasons.length > 0 ? reasons.join("; ") : null
    }
  ];
}

export function renderWorkBriefDebugJson(brief: WorkBrief): string {
  const lookupHints = publicLookupHints(brief.targetedLookupHints);
  const publicBrief: PublicWorkBrief = {
    schemaVersion: 1,
    command: brief.command,
    task: brief.task,
    contextBudget: brief.contextBudget,
    mapFreshness: {
      status: brief.mapFreshness.status,
      score: brief.mapFreshness.score,
      reason: brief.mapFreshness.reason,
      latestContextUpdate: brief.mapFreshness.latestContextUpdate,
      latestRelevantSourceChange: brief.mapFreshness.latestRelevantSourceChange,
      affectedFiles: brief.mapFreshness.affectedFiles,
      affectedContextFiles: brief.mapFreshness.affectedContextFiles
    },
    recommendedFiles: brief.recommendedFiles.map((file) => recommendationSignal(file, lookupHints)),
    relevantTests: brief.relevantTests.map((file) => recommendationSignal(file, lookupHints)),
    primaryFiles: brief.primaryFiles.map((file) => recommendationSignal(file, lookupHints)),
    supportingFiles: brief.supportingFiles.map((file) => recommendationSignal(file, lookupHints)),
    tests: brief.tests.map((file) => recommendationSignal(file, lookupHints)),
    agentRules: brief.agentRules.map((file) => recommendationSignal(file, lookupHints)),
    contextIfUnclear: brief.contextIfUnclear.map((file) => recommendationSignal(file, lookupHints)),
    taskFiles: brief.taskFiles.map((file) => recommendationSignal(file, lookupHints)),
    supportingTests: brief.supportingTests.map((file) => recommendationSignal(file, lookupHints)),
    workflowDocs: brief.workflowDocs.map((file) => recommendationSignal(file, lookupHints)),
    contextDocs: brief.contextDocs.map((file) => recommendationSignal(file, lookupHints)),
    cheapestPath: brief.cheapestPath,
    avoid: brief.avoid,
    nextCheapestCommand: brief.nextCheapestCommand,
    promotedFromTargetedLookup: publicLookupHints(brief.promotedFromTargetedLookup),
    relevantDecisions: brief.relevantDecisions,
    recentLogs: brief.recentLogs,
    risks: publicRisks(brief.risks),
    readFirstGuidance: {
      required: publicGuidanceItems(brief.readFirstGuidance.required),
      taskSpecific: publicGuidanceItems(brief.readFirstGuidance.taskSpecific),
      optionalIfUnclear: publicGuidanceItems(brief.readFirstGuidance.optional),
      skippedForNow: publicGuidanceItems(brief.readFirstGuidance.skipped)
    },
    readFirst: brief.readFirst,
    targetedLookupHints: lookupHints,
    tokenEstimate: {
      humanBriefTokens: brief.tokenEstimate.roughTokens
    },
    fastLookup: {
      command: 'rcc find "<keyword>"',
      guidance: "Prefer this before broad repo search when the target is unclear."
    },
    nextCommand: {
      command: brief.nextCommand,
      when: "after meaningful work"
    }
  };

  return `${JSON.stringify(publicBrief, null, 2)}\n`;
}

function compactContextIfUnclear(brief: WorkBrief): string[] {
  return uniquePaths([
    ...brief.contextDocs.map((file) => file.path),
    ...brief.readFirstGuidance.optional.map((item) => item.path)
  ]);
}

export function toCompactWorkBrief(brief: WorkBrief): CompactWorkBrief {
  const withoutTokens: Omit<CompactWorkBrief, "tokens"> = {
    schemaVersion: 1,
    command: brief.command,
    task: brief.task,
    contextBudget: brief.contextBudget,
    freshness: {
      status: brief.mapFreshness.status,
      score: brief.mapFreshness.score,
      reason: brief.mapFreshness.reason
    },
    taskFiles: brief.taskFiles.map(compactRecommendationSignal),
    primaryFiles: brief.primaryFiles.map(compactRecommendationSignal),
    supportingFiles: brief.supportingFiles.map(compactRecommendationSignal),
    tests: brief.tests.map(compactRecommendationSignal),
    agentRules: brief.agentRules.map(compactRecommendationSignal),
    readFirst: brief.readFirst,
    contextIfUnclear: compactContextIfUnclear(brief),
    nextLookup: brief.nextCheapestCommand,
    nextCommand: brief.nextCommand,
    reusePolicy: "Call once per task. Do not rerun work unless task meaning changes. Use rcc find if route is insufficient."
  };
  const preliminary = { ...withoutTokens, tokens: { jsonEstimate: 0 } };
  const jsonEstimate = Math.ceil(JSON.stringify(preliminary, null, 2).length / 4);
  const compactBrief: CompactWorkBrief = {
    ...withoutTokens,
    tokens: {
      jsonEstimate
    }
  };

  return compactBrief;
}

export function renderWorkBriefCompactJson(brief: WorkBrief): string {
  const compactBrief = toCompactWorkBrief(brief);

  return `${JSON.stringify(compactBrief, null, 2)}\n`;
}
