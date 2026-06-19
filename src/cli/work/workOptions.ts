import { usage } from "./workConstants";
import type { ContextBudget, WorkOptions } from "./workTypes";

export function parseWorkOptions(args: string[]): WorkOptions | undefined {
  let agent = false;
  let contextBudget: ContextBudget = "balanced";
  let debug = false;
  let json = false;
  let maxFiles = 50;
  let verbose = false;
  const taskParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--agent") {
      agent = true;
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
      continue;
    }

    if (arg === "--debug") {
      debug = true;
      continue;
    }

    if (arg === "--context-budget") {
      const value = args[index + 1];
      if (value !== "minimal" && value !== "balanced" && value !== "deep") {
        return undefined;
      }
      contextBudget = value;
      index += 1;
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

  return {
    agent,
    contextBudget,
    debug,
    json,
    maxFiles,
    task,
    verbose
  };
}

export function formatWorkOptionsUsage(): string {
  return `${usage}\n`;
}
