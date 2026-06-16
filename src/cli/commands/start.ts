import { spawnSync } from "node:child_process";
import { formatStartupPrompt } from "../../core/startPrompt";
import { buildStartupContext, focusStartupContextForStart } from "../../core/suggester";
import type { CliIO } from "../index";

interface StartOptions {
  copy: boolean;
  explicitMaxFiles: boolean;
  maxFiles: number;
  task: string;
}

interface ClipboardCommand {
  args: string[];
  command: string;
}

interface ClipboardRunResult {
  error?: unknown;
  status: number | null;
}

type ClipboardRunner = (command: string, args: string[], input: string) => ClipboardRunResult;

interface StartCommandDependencies {
  copyToClipboard?: (content: string) => boolean;
}

function parseStartOptions(args: string[]): StartOptions | undefined {
  let copy = false;
  let explicitMaxFiles = false;
  let maxFiles = 50;
  const taskParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--copy") {
      copy = true;
      continue;
    }

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

  return { copy, explicitMaxFiles, maxFiles, task };
}

function clipboardCommands(platform = process.platform): ClipboardCommand[] {
  if (platform === "darwin") {
    return [{ command: "pbcopy", args: [] }];
  }

  if (platform === "win32") {
    return [{ command: "clip", args: [] }];
  }

  return [
    { command: "wl-copy", args: [] },
    { command: "xclip", args: ["-selection", "clipboard"] },
    { command: "xsel", args: ["--clipboard", "--input"] }
  ];
}

function defaultClipboardRunner(command: string, args: string[], input: string): ClipboardRunResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input
  });

  return {
    error: result.error,
    status: result.status
  };
}

export function copyStartupContextToClipboard(
  content: string,
  runner: ClipboardRunner = defaultClipboardRunner,
  platform = process.platform
): boolean {
  for (const { command, args } of clipboardCommands(platform)) {
    try {
      const result = runner(command, args, content);
      if (!result.error && result.status === 0) {
        return true;
      }
    } catch {
      // Try the next platform clipboard command.
    }
  }

  return false;
}

export async function startCommand(
  io: CliIO,
  args: string[] = [],
  dependencies: StartCommandDependencies = {}
): Promise<number> {
  const options = parseStartOptions(args);
  if (!options) {
    io.stderr('Usage: repo-context-center start "<task>" [--max-files <number>] [--copy]\n');
    return 1;
  }

  const startupContext = await buildStartupContext(io.cwd, options.task, {
    maxFiles: options.maxFiles,
    genericFallbackMaxTests: options.explicitMaxFiles ? options.maxFiles : 5
  });
  const focusedStartupContext = focusStartupContextForStart(startupContext, {
    maxSourceFiles: Math.min(options.maxFiles, 10),
    maxTestFiles: Math.min(options.explicitMaxFiles ? options.maxFiles : 8, 8)
  });
  const output = formatStartupPrompt(focusedStartupContext);
  io.stdout(output);

  if (options.copy) {
    const copyToClipboard = dependencies.copyToClipboard ?? copyStartupContextToClipboard;
    if (copyToClipboard(output)) {
      io.stderr("Copied startup context to clipboard.\n");
    } else {
      io.stderr("Could not copy to clipboard; startup context was printed above.\n");
    }
  }

  return 0;
}
