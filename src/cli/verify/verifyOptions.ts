import type { VerifyOptions } from "./verifyTypes";

export const verifyUsage = 'Usage: rcc verify "<task>" [--json] [--task-only] [--max-files <number>]';

export function parseVerifyOptions(args: string[]): VerifyOptions | undefined {
  let json = false;
  let maxFiles = 50;
  let taskOnly = false;
  const taskParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--task-only") {
      taskOnly = true;
      continue;
    }

    if (arg === "--max-files") {
      const value = Number.parseInt(args[index + 1] ?? "", 10);
      if (!Number.isInteger(value) || value < 1) {
        return undefined;
      }
      maxFiles = value;
      index += 1;
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

  return { json, maxFiles, task, taskOnly };
}
