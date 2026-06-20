export interface LearnOptions {
  debug: boolean;
  json: boolean;
  write: boolean;
}

export const learnUsage = "Usage: learn [--json] [--write] [--debug]";

export function parseLearnOptions(args: string[]): LearnOptions | undefined {
  let debug = false;
  let json = false;
  let write = false;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--write") {
      write = true;
      continue;
    }

    if (arg === "--debug") {
      debug = true;
      continue;
    }

    return undefined;
  }

  return { debug, json, write };
}

export function formatLearnOptionsUsage(): string {
  return `${learnUsage}\n`;
}
