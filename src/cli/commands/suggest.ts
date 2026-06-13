import { suggestContext, type ContextSuggestion } from "../../core/suggester";
import type { CliIO } from "../index";

interface SuggestOptions {
  json: boolean;
  task: string;
}

function parseSuggestOptions(args: string[]): SuggestOptions | undefined {
  const json = args.includes("--json");
  const taskParts = args.filter((arg) => arg !== "--json");

  if (taskParts.some((arg) => arg.startsWith("--"))) {
    return undefined;
  }

  const task = taskParts.join(" ").trim();
  if (!task) {
    return undefined;
  }

  return { json, task };
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `  - ${value}`).join("\n") : "  - none";
}

function formatSuggestion(suggestion: ContextSuggestion): string {
  return `${[
    "repo-context-center suggestion",
    "",
    `Task: ${suggestion.task}`,
    `Mode: ${suggestion.mode}`,
    `Risk: ${suggestion.riskLevel}`,
    "",
    "Context files:",
    formatList(suggestion.contextFiles),
    "",
    "Likely source files:",
    formatList(suggestion.likelySourceFiles),
    "",
    "Likely tests:",
    formatList(suggestion.likelyTests),
    "",
    "Reasons:",
    formatList(suggestion.reasons)
  ].join("\n")}\n`;
}

export async function suggestCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseSuggestOptions(args);
  if (!options) {
    io.stderr('Usage: repo-context-center suggest "<task>" [--json]\n');
    return 1;
  }

  const suggestion = await suggestContext(io.cwd, options.task);
  if (options.json) {
    io.stdout(`${JSON.stringify(suggestion, null, 2)}\n`);
    return 0;
  }

  io.stdout(formatSuggestion(suggestion));
  return 0;
}
