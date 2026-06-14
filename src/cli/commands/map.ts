import path from "node:path";
import { checkRepositoryMap, mapRepository, type RepoMapCheckResult, type RepoMapResult } from "../../core/repoMapper";
import type { CliIO } from "../index";

interface MapOptions {
  write: boolean;
  check: boolean;
  json: boolean;
  dryRun: boolean;
  maxFiles: number;
  repo?: string;
}

function parseMapOptions(args: string[]): MapOptions | undefined {
  let write = false;
  let check = false;
  let json = false;
  let dryRun = false;
  let maxFiles = 500;
  let repo: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--write") {
      write = true;
    } else if (arg === "--check") {
      check = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--max-files") {
      const value = Number.parseInt(args[index + 1] ?? "", 10);
      if (!Number.isInteger(value) || value < 1) {
        return undefined;
      }
      maxFiles = value;
      index += 1;
    } else if (arg === "--repo") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }
      repo = value;
      index += 1;
    } else {
      return undefined;
    }
  }

  if ((check && write) || (check && dryRun)) {
    return undefined;
  }

  return { write, check, json, dryRun, maxFiles, repo };
}

function formatResult(result: RepoMapResult, willWrite: boolean): string {
  const lines = [
    "repo-context-center map",
    "",
    `Files scanned: ${result.data.filesScanned}`,
    `Mode: ${willWrite ? "write" : "proposal"}`,
    "",
    willWrite ? "Updated files:" : "Proposed updates:",
    ...result.changes.map((change) => `- ${change.path} (${change.action})`),
    "",
    "Detected:",
    `- Task routing rows: ${result.data.taskRouting.length}`,
    `- Modules: ${result.data.modules.length}`,
    `- Risks: ${result.data.risks.length}`,
    `- Dependencies: ${result.data.dependencies.length}`,
    `- Symbols: ${result.data.symbols.length}`,
    `- Hotspots: ${result.data.hotspots.length}`
  ];

  return `${lines.join("\n")}\n`;
}

function formatCheckResult(result: RepoMapCheckResult, maxFiles: number): string {
  const lines = [
    "repo-context-center map --check",
    "",
    `Files scanned: ${result.data.filesScanned}`,
    "Mode: check",
    ""
  ];

  if (result.staleChanges.length === 0) {
    lines.push("Generated context files are up to date.");
  } else {
    lines.push("Generated context files are stale or missing.");
    lines.push("");
    lines.push("Files that would change:");
    lines.push(...result.staleChanges.map((change) => `- ${change.path} (${change.action})`));
    lines.push("");
    lines.push(`Run: npx repo-context-center map --write --max-files ${maxFiles}`);
  }

  return `${lines.join("\n")}\n`;
}

export async function mapCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseMapOptions(args);
  if (!options) {
    io.stderr("Usage: repo-context-center map [--write] [--check] [--json] [--max-files <number>] [--dry-run] [--repo <path>]\n");
    return 1;
  }

  const cwd = options.repo ? path.resolve(io.cwd, options.repo) : io.cwd;

  if (options.check) {
    const result = await checkRepositoryMap({
      cwd,
      maxFiles: options.maxFiles
    });
    io.stdout(formatCheckResult(result, options.maxFiles));
    return result.staleChanges.length === 0 ? 0 : 1;
  }

  const result = await mapRepository({
    cwd,
    maxFiles: options.maxFiles,
    write: options.write,
    dryRun: options.dryRun
  });

  if (options.json) {
    io.stdout(`${JSON.stringify({
      ...result.data,
      changes: result.changes.map((change) => ({ path: change.path, action: change.action })),
      written: result.written
    }, null, 2)}\n`);
    return 0;
  }

  io.stdout(formatResult(result, options.write && !options.dryRun));
  return 0;
}
