import { handoffUsage } from "./handoffConstants";
import type { HandoffOptions } from "./handoffTypes";

export function parseHandoffOptions(args: string[]): HandoffOptions | undefined {
  let agent = false;
  let debug = false;
  let json = false;
  const taskParts: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--agent") {
      agent = true;
      continue;
    }

    if (arg === "--debug") {
      debug = true;
      continue;
    }

    if (arg.startsWith("--")) {
      return undefined;
    }

    taskParts.push(arg);
  }

  return {
    agent,
    debug,
    json,
    task: taskParts.join(" ").trim() || null
  };
}

export function formatHandoffOptionsUsage(): string {
  return `${handoffUsage}\n`;
}
