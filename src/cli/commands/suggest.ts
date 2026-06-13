import { suggestContext, type ContextSuggestion } from "../../core/suggester";
import type { CliIO } from "../index";

interface SuggestOptions {
  json: boolean;
  symbols: boolean;
  task: string;
}

function parseSuggestOptions(args: string[]): SuggestOptions | undefined {
  const json = args.includes("--json");
  const symbols = args.includes("--symbols");
  const taskParts = args.filter((arg) => arg !== "--json" && arg !== "--symbols");

  if (taskParts.some((arg) => arg.startsWith("--"))) {
    return undefined;
  }

  const task = taskParts.join(" ").trim();
  if (!task) {
    return undefined;
  }

  return { json, symbols, task };
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `  - ${value}`).join("\n") : "  - none";
}

function formatSymbols(suggestion: ContextSuggestion): string {
  if (suggestion.relevantSymbols.length === 0) {
    return "  - none";
  }

  return suggestion.relevantSymbols
    .map((entry) => [
      `  - ${entry.file}`,
      ...entry.symbols.map((symbol) => `    - ${symbol}`)
    ].join("\n"))
    .join("\n");
}

function formatSuggestion(suggestion: ContextSuggestion, includeSymbols: boolean): string {
  const lines = [
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
  ];

  if (includeSymbols) {
    lines.push("", "Relevant symbols:", formatSymbols(suggestion));
  }

  lines.push(
    "",
    "Likely tests:",
    formatList(suggestion.likelyTests),
    "",
    "Reasons:",
    formatList(suggestion.reasons)
  );

  return `${lines.join("\n")}\n`;
}

export async function suggestCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseSuggestOptions(args);
  if (!options) {
    io.stderr('Usage: repo-context-center suggest "<task>" [--json] [--symbols]\n');
    return 1;
  }

  const suggestion = await suggestContext(io.cwd, options.task);
  if (options.json) {
    io.stdout(`${JSON.stringify(suggestion, null, 2)}\n`);
    return 0;
  }

  io.stdout(formatSuggestion(suggestion, options.symbols));
  return 0;
}
