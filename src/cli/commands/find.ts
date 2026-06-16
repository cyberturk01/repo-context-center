import { findFocusedFiles, type FindFocusedFile } from "../../core/suggester";
import type { CliIO } from "../index";

interface FindOptions {
  limit: number;
  query: string;
}

function parseFindOptions(args: string[]): FindOptions | undefined {
  let limit = 10;
  const queryParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--limit") {
      const value = Number.parseInt(args[index + 1] ?? "", 10);
      if (!Number.isInteger(value) || value < 1) {
        return undefined;
      }
      limit = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return undefined;
    }

    queryParts.push(arg);
  }

  const query = queryParts.join(" ").trim();
  if (!query) {
    return undefined;
  }

  return { limit, query };
}

function formatFindResults(query: string, results: FindFocusedFile[]): string {
  if (results.length === 0) {
    return "No focused matches found. Try a more specific query.\n";
  }

  const lines = [
    "repo-context-center find",
    "",
    `Query: ${query}`,
    "",
    "Focused file candidates:"
  ];

  for (const result of results) {
    lines.push(`- ${result.path}`);
    lines.push(`  Reasons: ${result.reasons.join("; ")}`);
  }

  return `${lines.join("\n")}\n`;
}

export async function findCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseFindOptions(args);
  if (!options) {
    io.stderr('Usage: repo-context-center find "<query>" [--limit <number>]\n');
    return 1;
  }

  const results = await findFocusedFiles(io.cwd, options.query, { limit: options.limit });
  io.stdout(formatFindResults(options.query, results));
  return 0;
}
