import { analyzeTaskIntent } from "../../core/taskIntent";
import { targetedLookupLimit } from "./workConstants";
import type {
  ReadFirstGuidance,
  ReadFirstGuidanceItem,
  TargetedLookupHint,
  WorkBrief,
  WorkMapFreshness,
  WorkRecommendation
} from "./workTypes";

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

function repositoryLearningLines(brief: WorkBrief): string[] {
  const lines = [
    ...brief.learnedRelatedFiles.slice(0, 1).map((file) => `- learned related file: ${file}`),
    ...brief.learnedVerification.slice(0, 1).map((command) => `- learned verification: ${command}`)
  ];

  return lines.length > 0 ? ["Repository learning:", ...lines, ""] : [];
}

export function renderWorkBriefLines(brief: WorkBrief): string[] {
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
    ...repositoryLearningLines(brief),
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

export function formatWorkBrief(brief: WorkBrief): string {
  return `${renderWorkBriefLines(brief).join("\n")}\n`;
}

export function renderText(brief: WorkBrief): string {
  return formatWorkBrief(brief);
}
