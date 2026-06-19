#!/usr/bin/env node
import { archiveCommand } from "./commands/archive";
import { decisionCommand } from "./commands/decision";
import { doctorCommand } from "./commands/doctor";
import { doneCommand } from "./commands/done";
import { estimateCommand } from "./commands/estimate";
import { findCommand } from "./commands/find";
import { initCommand } from "./commands/init";
import { logCommand } from "./commands/log";
import { mapCommand } from "./commands/map";
import { measureCommand } from "./commands/measure";
import { scanCommand } from "./commands/scan";
import { startCommand } from "./commands/start";
import { suggestCommand } from "./commands/suggest";
import { validateCommand } from "./commands/validate";
import { workCommand } from "./commands/work";

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
  decision: decisionCommand,
  doctor: doctorCommand,
  done: doneCommand,
  estimate: estimateCommand,
  find: findCommand,
  log: logCommand,
  map: mapCommand,
  measure: measureCommand,
  scan: scanCommand,
  start: startCommand,
  suggest: suggestCommand,
  work: workCommand
};

const helpText = `repo-context-center

Usage:
  repo-context-center <command>

Agent workflow:
  work      Print a concise work brief for an AI coding agent
            Usage: work "<task>" [--json] [--context-budget minimal|balanced|deep] [--max-files <number>]
  done      Save lightweight memory after completed agent work
            Usage: done --summary "<summary>" [--files auto|none|"<path,path>"] [--verify "<command/result>"] [--dry-run]

Commands:
  init      Install generic context templates and config
            Options: --dry-run, --force, --github-action
  validate  Validate required context files and warnings
            Options: --strict
  archive   Archive older CHANGE_LOG and LESSONS_LEARNED entries
            Options: --keep <number>, --dry-run
  decision  Add a durable project decision to docs/ai-context/DECISIONS.md
            Usage: decision add "<decision>" --reason "<reason>" [--status <status>] [--files <path,path>]
                   decision list
                   decision search "<query>"
  doctor    Check local development CLI/version alignment
  estimate  Estimate context token costs and rough savings
            Options: --json, --mode <mode>, --task <text>, --compare-naive, --max-files <number>
  find      Find focused file candidates for a concept or query
            Usage: find "<query>" [--limit <number>]
  log       Add a durable entry to docs/ai-context/CHANGE_LOG.md
            Usage: log "<summary>" [--files <path,path>] [--dry-run]
  map       Generate repo-specific context maps
            Options: --write, --check, --json, --dry-run, --max-files <number>, --repo <path>
  measure   Estimate naive scan tokens vs RCC startup tokens for a task
            Usage: measure "<task>" [--json]
  scan      Suggest lightweight context entries from repo layout
            Options: --json
  start     Print a startup prompt for an AI coding agent
            Usage: start "<task>" [--max-files <number>] [--copy]
  suggest   Recommend context files for a task
            Usage: suggest "<task>" [--json] [--symbols] [--max-files <number>]

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
