import type { VerifyOptions } from "./verifyTypes";

export const verifyUsage = 'Usage: rcc verify "<task>" [--json] [--task-only] [--planned]';

export function parseVerifyOptions(args: string[]): VerifyOptions | undefined {
  let json = false;
  let planned = false;
  let taskOnly = false;
  const taskParts: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--task-only") {
      taskOnly = true;
      continue;
    }

    if (arg === "--planned") {
      planned = true;
      continue;
    }

    if (arg.startsWith("--")) {
      return undefined;
    }

    taskParts.push(arg);
  }

  const task = taskParts.join(" ").trim();
  if (!task) {
    return undefined;
  }

  return { json, planned, task, taskOnly };
}
