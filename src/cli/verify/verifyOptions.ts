import type { VerificationLevel, VerifyOptions } from "./verifyTypes";

export const verifyUsage = 'Usage: rcc verify "<task>" [--json] [--task-only] [--planned] [--level minimal|balanced|deep]';

const verificationLevels = new Set<VerificationLevel>(["minimal", "balanced", "deep"]);

function parseLevel(value: string): VerificationLevel | undefined {
  return verificationLevels.has(value as VerificationLevel) ? value as VerificationLevel : undefined;
}

export function parseVerifyOptions(args: string[]): VerifyOptions | undefined {
  let json = false;
  let level: VerificationLevel = "balanced";
  let planned = false;
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

    if (arg === "--planned") {
      planned = true;
      continue;
    }

    if (arg === "--level") {
      const parsedLevel = parseLevel(args[index + 1] ?? "");
      if (!parsedLevel) {
        return undefined;
      }

      level = parsedLevel;
      index += 1;
      continue;
    }

    if (arg.startsWith("--level=")) {
      const parsedLevel = parseLevel(arg.slice("--level=".length));
      if (!parsedLevel) {
        return undefined;
      }

      level = parsedLevel;
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

  return { json, level, planned, task, taskOnly };
}
