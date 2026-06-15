import { formatStartupPrompt } from "../../core/startPrompt";
import { buildStartupContext } from "../../core/suggester";
import type { CliIO } from "../index";

interface StartOptions {
  explicitMaxFiles: boolean;
  maxFiles: number;
  task: string;
}

function parseStartOptions(args: string[]): StartOptions | undefined {
  let explicitMaxFiles = false;
  let maxFiles = 50;
  const taskParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--max-files") {
      const value = Number.parseInt(args[index + 1] ?? "", 10);
      if (!Number.isInteger(value) || value < 1) {
        return undefined;
      }
      explicitMaxFiles = true;
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

  return { explicitMaxFiles, maxFiles, task };
}

export async function startCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseStartOptions(args);
  if (!options) {
    io.stderr('Usage: repo-context-center start "<task>" [--max-files <number>]\n');
    return 1;
  }

  const startupContext = await buildStartupContext(io.cwd, options.task, {
    maxFiles: options.maxFiles,
    genericFallbackMaxTests: options.explicitMaxFiles ? options.maxFiles : 5
  });
  io.stdout(formatStartupPrompt(startupContext));
  return 0;
}
