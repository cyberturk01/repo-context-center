import type { HandoffBrief } from "./handoffTypes";
import { buildWorkBriefForTask } from "../work/buildWorkBrief";
import {
  handoffMemoryLimit,
  handoffRouteLimit,
  placeholderHandoffNextCommand,
  placeholderHandoffNextLookup
} from "./handoffConstants";
import { readHandoffSources } from "./handoffSources";
import type { WorkBrief, WorkRecommendation } from "../work/workTypes";

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

function compactHandoffMemory(
  entry: {
    summary: string;
    timestamp: string;
    verification: string[];
  } | null,
  workIndex: string[],
  changeLog: string[]
): string[] {
  const memory: string[] = [];

  if (entry) {
    memory.push(
      `Last completed: ${entry.summary}`,
      `Completed at: ${entry.timestamp}`
    );

    const [verification] = entry.verification;
    if (verification) {
      memory.push(`Verification: ${verification}`);
    }
  }

  const [workIndexItem] = workIndex;
  if (workIndexItem) {
    memory.push(workIndexItem);
  }

  const [changeLogItem] = changeLog;
  if (changeLogItem) {
    memory.push(`Change: ${changeLogItem}`);
  }

  return memory.slice(0, handoffMemoryLimit);
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

function taskLearningTerms(task: string): string[] {
  return (task.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? [])
    .flatMap((term) => term.split(/[._-]+/))
    .filter((term) => term.length > 1 && !["continue", "finish", "fix", "add", "update", "work", "task"].includes(term));
}

function taskLearningScope(task: string, learnedFiles: string[]): string {
  const terms = taskLearningTerms(task);
  const [matchedPathTerm] = terms.filter((term) => (
    learnedFiles.some((file) => file.toLowerCase().split(/[\/._-]+/).includes(term))
  ));
  const [fallbackTerm] = terms;

  return matchedPathTerm ?? fallbackTerm ?? "similar";
}

function repositoryLearningHints(task: string | null, workBrief: WorkBrief | null): string[] {
  if (!task || !workBrief) {
    return [];
  }

  const learnedFiles = [...workBrief.learnedTests, ...workBrief.learnedRelatedFiles];
  const scope = taskLearningScope(task, learnedFiles);
  const hints = [
    ...learnedFiles.slice(0, 1).map((file) => `${scope} changes often touch ${file}`),
    ...workBrief.learnedVerification.slice(0, 1).map((command) => `${scope} work often verifies with ${command}`),
    ...learnedFiles.slice(1, 2).map((file) => `${scope} changes often touch ${file}`),
    ...workBrief.learnedHabits.slice(0, 1)
  ];

  return uniqueValues(hints).slice(0, 4);
}

export async function buildHandoffBrief(cwd: string, options: { task: string | null; debug?: boolean }): Promise<HandoffBrief> {
  const sources = await readHandoffSources(cwd);
  const workBrief = options.task
    ? await buildWorkBriefForTask(cwd, options.task, {
      contextBudget: "minimal",
      maxFiles: handoffRouteLimit
    })
    : null;
  const memory = compactHandoffMemory(
    sources.latestDoneEntry,
    sources.workIndex,
    sources.changeLog
  );
  const currentState = buildCurrentState(sources.gitStatus, sources.recentTouchedFiles);
  const repositoryLearning = repositoryLearningHints(options.task, workBrief);

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
    ...(repositoryLearning.length > 0 ? { repositoryLearning } : {}),
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
