import type { HandoffBrief } from "./handoffTypes";
import { buildWorkBriefForTask } from "../work/buildWorkBrief";
import {
  handoffRouteLimit,
  placeholderHandoffNextCommand,
  placeholderHandoffNextLookup
} from "./handoffConstants";
import { readHandoffSources } from "./handoffSources";
import type { WorkRecommendation } from "../work/workTypes";

function formatSourceItems(label: string, items: string[]): string[] {
  return items.map((item) => `${label}: ${item}`);
}

function buildCurrentState(gitStatus: string[], recentTouchedFiles: string[]): string[] {
  const state: string[] = [];

  if (gitStatus.length > 0) {
    state.push(...gitStatus.map((file) => `Working tree changed: ${file}`));
  } else {
    state.push("Working tree has no detected changes.");
  }

  state.push(...recentTouchedFiles.map((file) => `Recently touched: ${file}`));

  return state;
}

function latestDoneMemory(
  entry: {
    followUps: string[];
    risks: string[];
    summary: string;
    timestamp: string;
    verification: string[];
  } | null
): string[] {
  if (!entry) {
    return [];
  }

  return [
    `Last completed: ${entry.summary}`,
    `Completed at: ${entry.timestamp}`,
    ...entry.verification.map((verification) => `Verification: ${verification}`),
    ...entry.followUps.map((followUp) => `Follow-up: ${followUp}`),
    ...entry.risks.map((risk) => `Risk: ${risk}`)
  ];
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function routeItems(items: WorkRecommendation[]) {
  return items.slice(0, handoffRouteLimit).map((item) => {
    const reason = item.reasons[0];

    return reason ? { path: item.path, reason } : { path: item.path };
  });
}

function taskNextActions(task: string | null, hasRoute: boolean): string[] {
  if (!task || !hasRoute) {
    return [
      "Read the handoff brief fields before opening additional files.",
      "Open readFirst files first when present.",
      "Use currentState and memory to choose the smallest next inspection."
    ];
  }

  return [
    "Open readFirst files first when present.",
    "Inspect nextRecommendedFiles before searching.",
    "Run or inspect relevantTests before broad validation.",
    "Use nextLookup only if the routed files are insufficient."
  ];
}

export async function buildHandoffBrief(cwd: string, options: { task: string | null; debug?: boolean }): Promise<HandoffBrief> {
  const sources = await readHandoffSources(cwd);
  const workBrief = options.task
    ? await buildWorkBriefForTask(cwd, options.task, {
      contextBudget: "minimal",
      maxFiles: handoffRouteLimit
    })
    : null;
  const memory = [
    ...latestDoneMemory(sources.latestDoneEntry),
    ...sources.workIndex,
    ...formatSourceItems("Decision", sources.decisions),
    ...formatSourceItems("Change", sources.changeLog),
    ...formatSourceItems("Lesson", sources.lessons)
  ];
  const currentState = buildCurrentState(sources.gitStatus, sources.recentTouchedFiles);

  const brief: HandoffBrief = {
    schemaVersion: 1,
    command: "handoff",
    task: options.task,
    generatedAt: new Date().toISOString(),
    currentState,
    memory,
    readFirst: uniqueValues([
      ...(sources.agents ? ["AGENTS.md"] : []),
      ...(workBrief?.readFirst ?? [])
    ]).slice(0, handoffRouteLimit),
    nextRecommendedFiles: workBrief ? routeItems(workBrief.primaryFiles) : [],
    relevantTests: workBrief ? routeItems(workBrief.relevantTests) : [],
    relevantDecisions: workBrief ? workBrief.relevantDecisions.slice(0, handoffRouteLimit) : [],
    ...(sources.latestDoneEntry ? {
      lastSummary: sources.latestDoneEntry.summary,
      filesTouched: sources.latestDoneEntry.files,
      verification: sources.latestDoneEntry.verification,
      followUps: sources.latestDoneEntry.followUps,
      risks: sources.latestDoneEntry.risks
    } : {}),
    nextActions: taskNextActions(options.task, Boolean(workBrief)),
    avoid: [
      "Do not rerun broad discovery before reading handoff files.",
      "Do not rerun rcc work unless task meaning changed.",
      "Do not edit generated/assets/fixtures unless relevant."
    ],
    nextLookup: workBrief?.nextCheapestCommand ?? placeholderHandoffNextLookup,
    nextCommand: workBrief?.nextCommand ?? placeholderHandoffNextCommand
  };

  if (options.debug) {
    return {
      ...brief,
      debug: {
        cwd,
        sources: {
          agentsPresent: Boolean(sources.agents),
          changeLogCount: sources.changeLog.length,
          decisionsCount: sources.decisions.length,
          gitStatusCount: sources.gitStatus.length,
          lessonsCount: sources.lessons.length,
          latestDoneEntryPresent: Boolean(sources.latestDoneEntry),
          recentTouchedFilesCount: sources.recentTouchedFiles.length,
          workIndexCount: sources.workIndex.length,
          workLogCount: sources.workLog.length
        }
      }
    };
  }

  return brief;
}
