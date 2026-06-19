import type { HandoffBrief } from "./handoffTypes";
import { placeholderHandoffNextCommand } from "./handoffConstants";
import { readHandoffSources } from "./handoffSources";

function formatSourceItems(label: string, items: string[]): string[] {
  return items.map((item) => `${label}: ${item}`);
}

export async function buildHandoffBrief(cwd: string, task: string | null, debug = false): Promise<HandoffBrief> {
  const sources = await readHandoffSources(cwd);
  const memory = [
    ...formatSourceItems("Work", sources.workLog),
    ...formatSourceItems("Decision", sources.decisions),
    ...formatSourceItems("Change", sources.changeLog),
    ...formatSourceItems("Lesson", sources.lessons)
  ];
  const currentState = sources.gitStatus.length > 0
    ? sources.gitStatus.map((file) => `Working tree changed: ${file}`)
    : ["Working tree has no detected changes."];

  const brief: HandoffBrief = {
    schemaVersion: 1,
    command: "handoff",
    task,
    generatedAt: new Date().toISOString(),
    currentState,
    memory,
    readFirst: sources.agents ? ["AGENTS.md"] : [],
    nextActions: [],
    avoid: [],
    nextCommand: placeholderHandoffNextCommand
  };

  if (debug) {
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
          workLogCount: sources.workLog.length
        }
      }
    };
  }

  return brief;
}
