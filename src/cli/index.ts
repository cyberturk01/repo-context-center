#!/usr/bin/env node
import { archiveCommand } from "./commands/archive";
import { initCommand } from "./commands/init";
import { scanCommand } from "./commands/scan";
import { suggestCommand } from "./commands/suggest";
import { validateCommand } from "./commands/validate";

export interface CliIO {
  cwd: string;
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

type CommandHandler = (io: CliIO, args: string[]) => Promise<number>;

const commands: Record<string, CommandHandler> = {
  init: initCommand,
  validate: validateCommand,
  archive: archiveCommand,
  scan: scanCommand,
  suggest: suggestCommand
};

const helpText = `repo-context-center

Usage:
  repo-context-center <command>

Commands:
  init      Install generic context templates and config
            Options: --dry-run, --force, --github-action
  validate  Validate required context files and warnings
            Options: --strict
  archive   Archive older CHANGE_LOG and LESSONS_LEARNED entries
            Options: --keep <number>, --dry-run
  scan      Suggest lightweight context entries from repo layout
            Options: --json
  suggest   Recommend context files for a task
            Usage: suggest "<task>" [--json]

Options:
  -h, --help  Show this help
`;

function defaultIO(): CliIO {
  return {
    cwd: process.cwd(),
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message)
  };
}

export function getHelpText(): string {
  return helpText;
}

export async function run(argv = process.argv.slice(2), io = defaultIO()): Promise<number> {
  const [command, ...args] = argv;

  if (!command || command === "--help" || command === "-h") {
    io.stdout(helpText);
    return 0;
  }

  const handler = commands[command];
  if (!handler) {
    io.stderr(`Unknown command: ${command}\n\n${helpText}`);
    return 1;
  }

  return handler(io, args);
}

if (require.main === module) {
  run().then((exitCode) => {
    process.exitCode = exitCode;
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
