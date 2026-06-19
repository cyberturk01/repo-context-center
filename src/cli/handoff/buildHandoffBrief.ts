import type { HandoffBrief } from "./handoffTypes";

export function buildHandoffBrief(cwd: string, task: string | null, debug = false): HandoffBrief {
  const brief: HandoffBrief = {
    schemaVersion: 1,
    command: "handoff",
    task,
    status: "placeholder",
    summary: "Handoff brief placeholder. Final handoff assembly will be implemented here.",
    sections: {
      completed: [],
      currentState: [],
      nextSteps: [],
      verification: []
    }
  };

  if (debug) {
    return {
      ...brief,
      debug: {
        cwd,
        generatedAt: new Date().toISOString()
      }
    };
  }

  return brief;
}
