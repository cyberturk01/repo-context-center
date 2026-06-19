import { analyzeTaskIntent } from "../../core/taskIntent";
import {
  targetedLookupLimit
} from "../work/workConstants";
import { buildWorkBriefForTask } from "../work/buildWorkBrief";
import {
  uniquePaths
} from "../work/taskFileRecommendations";
import { formatWorkOptionsUsage, parseWorkOptions } from "../work/workOptions";
import type {
  CompactWorkBrief,
  ContextBudget,
  PublicAgentRoute,
  PublicAgentRouteItem,
  PublicCompactWorkFile,
  PublicReadFirstGuidanceItem,
  PublicTargetedLookupHint,
  PublicWorkBrief,
  PublicWorkFile,
  PublicWorkRisk,
  ReadFirstGuidance,
  ReadFirstGuidanceItem,
  TargetedLookupHint,
  WorkBrief,
  WorkMapFreshness,
  WorkRecommendation
} from "../work/workTypes";
import type { CliIO } from "../index";

export type {
  CompactWorkBrief,
  PublicAgentRoute,
  PublicAgentRouteItem,
  PublicCompactWorkFile
} from "../work/workTypes";

function formatList(values: string[], fallback: string): string[] {
  if (values.length === 0) {
    return [`- ${fallback}`];
  }

  return values.map((value) => `- ${value}`);
}

function compactReason(reasons: string[] | undefined): string {
  if (!reasons || reasons.length === 0) {
    return "";
  }

  return ` (${reasons.slice(0, 2).join("; ")})`;
}

function formatRecommendationSection(items: WorkRecommendation[], fallback: string, includeReasons = true): string[] {
  if (items.length === 0) {
    return [`- none. ${fallback}`];
  }

  return items.map((item) => `- ${item.path}${includeReasons ? compactReason(item.reasons) : ""}`);
}

function formatTargetedLookupHints(hints: TargetedLookupHint[], limit: number): string[] {
  if (hints.length === 0) {
    return ['- none. use rcc find "<keyword>" for targeted lookup.'];
  }

  return hints.slice(0, limit).map((hint, index) => (
    `${index + 1}. ${hint.path} — ${hint.reason}; ${hint.confidence}`
  ));
}

function mapFreshnessLines(mapFreshness: WorkMapFreshness): string[] {
  const lines = [
    `Status: ${mapFreshness.status}`,
    `Score: ${mapFreshness.score}/100`,
    `Reason: ${mapFreshness.reason}`
  ];

  if (mapFreshness.status !== "fresh") {
    lines.push(
      "",
      "Note: context may be stale; continue with task files below, then run `rcc map --write` after investigation if needed."
    );
  }

  return lines;
}

function compactMapFreshnessLine(mapFreshness: WorkMapFreshness): string {
  const reason = {
    fresh: "context is current",
    maybe_stale: "some repo files changed after context generation",
    stale: "important files changed after context generation",
    unknown: mapFreshness.reason
  }[mapFreshness.status];
  const recommendation = mapFreshness.status === "fresh"
    ? "continue with task files."
    : "continue with task files, then run `rcc map --write`.";

  return `${mapFreshness.status} ${mapFreshness.score}/100 — ${reason}; ${recommendation}`;
}

function compactRiskLines(risks: string[]): string[] {
  if (risks.includes("critical")) {
    return ["- critical — check docs/ai-context/RISK_REGISTER.md before editing."];
  }
  if (risks.includes("high")) {
    return ["- high — check docs/ai-context/RISK_REGISTER.md before editing."];
  }

  return [];
}

function formatReadFirstGroup(title: string, items: ReadFirstGuidanceItem[]): string[] {
  if (items.length === 0) {
    return [title, "- none"];
  }

  return [
    title,
    ...items.flatMap((item) => [
      `- ${item.path}`,
      `  reason: ${item.reason}`
    ])
  ];
}

function formatReadFirstGuidance(guidance: ReadFirstGuidance): string[] {
  if (
    guidance.required.length === 0
    && guidance.taskSpecific.length === 0
    && guidance.optional.length === 0
    && guidance.skipped.length === 0
  ) {
    return ["- no RCC context files found; run npx repo-context-center init to install them"];
  }

  return [
    ...formatReadFirstGroup("Agent rule file:", guidance.required),
    "",
    ...formatReadFirstGroup("Task-specific:", guidance.taskSpecific),
    "",
    ...formatReadFirstGroup("Optional if unclear:", guidance.optional)
  ];
}

function targetLookupHintForText(hint: Omit<TargetedLookupHint, "index">): TargetedLookupHint {
  return {
    ...hint,
    index: 0
  };
}

function renderNextLines(brief: WorkBrief, hasPrimaryFiles: boolean): string[] {
  const lookup = `Use ${brief.nextCheapestCommand} only if primary/supporting files are insufficient.`;
  const rerun = "Do not rerun rcc work for the same task unless the task meaning changes.";

  if (hasPrimaryFiles) {
    return [
      "Start with primary files.",
      rerun,
      lookup
    ];
  }

  return [
    "Start with primary files if listed.",
    "No strong primary files were found.",
    rerun,
    lookup
  ];
}

function renderWorkBriefLines(brief: WorkBrief): string[] {
  const taskFileFallback = analyzeTaskIntent(brief.task).isCodeInvestigation
    ? "No focused task files were identified. Use Next before broad search."
    : "Start with workflow/context docs before broad search.";
  const deep = brief.contextBudget === "deep";
  const lookupHintLimit = deep ? targetedLookupLimit : 3;
  const highRisk = brief.risks.some((risk) => risk === "high" || risk === "critical");
  const hasPrimaryFiles = brief.primaryFiles.length > 0;
  const compactLines = [
    "repo-context-center work brief",
    "",
    "Task:",
    brief.task,
    "",
    "Freshness:",
    compactMapFreshnessLine(brief.mapFreshness),
    "",
    "Primary files:",
    ...formatRecommendationSection(brief.primaryFiles, taskFileFallback, false).slice(0, 8),
    "",
    "Tests:",
    ...formatRecommendationSection(brief.tests, "Find nearby tests after inspecting source.", false).slice(0, 6),
    "",
    "Supporting files:",
    ...formatRecommendationSection(brief.supportingFiles, "Use only if primary files are insufficient.", false).slice(0, 8),
    "",
    "Agent rules:",
    ...formatRecommendationSection(brief.agentRules, "No agent rule files were detected.", false).slice(0, 6),
    "",
    "Context if unclear:",
    ...formatRecommendationSection(brief.contextIfUnclear, "Use only if primary/supporting files are insufficient.", false).slice(0, 6),
    "",
    "Next:",
    ...renderNextLines(brief, hasPrimaryFiles)
  ];

  if (!deep) {
    if (highRisk) {
      compactLines.splice(
        compactLines.indexOf("Next:"),
        0,
        "Known risks:",
        ...compactRiskLines(brief.risks),
        ""
      );
    }
    if (!hasPrimaryFiles) {
      compactLines.splice(
        compactLines.indexOf("Next:"),
        0,
        "Lookup hints:",
        ...formatTargetedLookupHints(brief.targetedLookupHints.map(targetLookupHintForText), lookupHintLimit),
        ""
      );
    }
    return compactLines;
  }

  if (!hasPrimaryFiles) {
    compactLines.splice(
      compactLines.indexOf("Next:"),
      0,
      "Lookup hints:",
      ...formatTargetedLookupHints(brief.targetedLookupHints.map(targetLookupHintForText), lookupHintLimit),
      ""
    );
  }

  return [
    ...compactLines,
    "",
    "Map freshness:",
    ...mapFreshnessLines(brief.mapFreshness),
    "",
    "Relevant decisions:",
    ...formatList(brief.relevantDecisions, "none. no matching decision was found."),
    "",
    "Recent logs:",
    ...formatList(brief.recentLogs, "none. no recent log was found."),
    "",
    "Token estimate:",
    `- ${brief.tokenEstimate.text}`,
    "",
    "Known risks:",
    ...brief.risks.map((risk) => `- ${risk}`),
    "",
    "Avoid:",
    ...brief.avoid.map((item) => `- ${item}`),
    "",
    "Read-first guidance:",
    ...formatReadFirstGuidance(brief.readFirstGuidance),
    "",
    "Avoid:",
    ...brief.avoid.map((item) => `- ${item}`)
  ];
}

function formatWorkBrief(brief: WorkBrief): string {
  return `${renderWorkBriefLines(brief).join("\n")}\n`;
}

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

function toAgentRoute(brief: WorkBrief, verbose: boolean): PublicAgentRoute {
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

function renderWorkBriefAgentJson(brief: WorkBrief, verbose: boolean): string {
  return `${JSON.stringify(toAgentRoute(brief, verbose))}\n`;
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

function renderWorkBriefDebugJson(brief: WorkBrief): string {
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

function toCompactWorkBrief(brief: WorkBrief): CompactWorkBrief {
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

function renderWorkBriefCompactJson(brief: WorkBrief): string {
  const compactBrief = toCompactWorkBrief(brief);

  return `${JSON.stringify(compactBrief, null, 2)}\n`;
}

function estimateRenderedWorkBriefTokens(brief: WorkBrief): number {
  return Math.ceil(renderWorkBriefLines(brief).join("\n").length / 4);
}

export async function buildCompactWorkBrief(
  cwd: string,
  task: string,
  options: { contextBudget?: ContextBudget; maxFiles?: number } = {}
): Promise<CompactWorkBrief> {
  return toCompactWorkBrief(await buildWorkBriefForTask(cwd, task, {
    ...options,
    estimateTokens: estimateRenderedWorkBriefTokens
  }));
}

export async function buildAgentWorkRoute(
  cwd: string,
  task: string,
  options: { contextBudget?: ContextBudget; maxFiles?: number; verbose?: boolean } = {}
): Promise<PublicAgentRoute> {
  return toAgentRoute(
    await buildWorkBriefForTask(cwd, task, {
      ...options,
      estimateTokens: estimateRenderedWorkBriefTokens
    }),
    options.verbose ?? false
  );
}

export async function workCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseWorkOptions(args);
  if (!options) {
    io.stderr(formatWorkOptionsUsage());
    return 1;
  }

  const brief = await buildWorkBriefForTask(io.cwd, options.task, {
    contextBudget: options.contextBudget,
    maxFiles: options.maxFiles,
    estimateTokens: estimateRenderedWorkBriefTokens
  });

  if (options.agent) {
    io.stdout(renderWorkBriefAgentJson(brief, options.verbose));
    return 0;
  }

  if (options.json) {
    io.stdout(options.debug ? renderWorkBriefDebugJson(brief) : renderWorkBriefCompactJson(brief));
    return 0;
  }

  io.stdout(formatWorkBrief(brief));
  return 0;
}
