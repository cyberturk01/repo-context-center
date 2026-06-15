import { formatStartupPrompt } from "../../core/startPrompt";
import { buildStartupContext } from "../../core/suggester";
import type { CliIO } from "../index";

interface StartOptions {
  maxFiles: number;
  task: string;
}

function parseStartOptions(args: string[]): StartOptions | undefined {
  let maxFiles = 50;
  const taskParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

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

  return { maxFiles, task };
}

export async function startCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseStartOptions(args);
  if (!options) {
    io.stderr('Usage: repo-context-center start "<task>" [--max-files <number>]\n');
    return 1;
  }

  const startupContext = await buildStartupContext(io.cwd, options.task, { maxFiles: options.maxFiles });
  io.stdout(formatStartupPrompt(startupContext));
  return 0;
}
