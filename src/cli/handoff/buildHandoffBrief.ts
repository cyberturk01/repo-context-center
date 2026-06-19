import type { HandoffBrief } from "./handoffTypes";
import { placeholderHandoffNextCommand } from "./handoffConstants";
import { readHandoffSources } from "./handoffSources";

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

export async function buildHandoffBrief(cwd: string, options: { task: string | null; debug?: boolean }): Promise<HandoffBrief> {
  const sources = await readHandoffSources(cwd);
  const lastSummary = sources.workLog[0] ? [`Last summary: ${sources.workLog[0]}`] : [];
  const memory = [
    ...lastSummary,
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
    readFirst: sources.agents ? ["AGENTS.md"] : [],
    nextActions: [
      "Read the handoff brief fields before opening additional files.",
      "Open readFirst files first when present.",
      "Use currentState and memory to choose the smallest next inspection."
    ],
    avoid: [
      "Do not rerun broad discovery before reading handoff files.",
      "Do not rerun rcc work unless task meaning changed.",
      "Do not edit generated/assets/fixtures unless relevant."
    ],
    nextCommand: placeholderHandoffNextCommand
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
          recentTouchedFilesCount: sources.recentTouchedFiles.length,
          workLogCount: sources.workLog.length
        }
      }
    };
  }

  return brief;
}
