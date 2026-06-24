import { getConfigPath, hasConfig, writeDefaultConfig } from "../../core/config";
import { mapRepository } from "../../core/repoMapper";
import { installGenericTemplates } from "../../core/templateInstaller";
import type { CliIO } from "../index";

interface InitOptions {
  force: boolean;
  dryRun: boolean;
  githubAction: boolean;
  update: boolean;
}

function parseInitOptions(args: string[]): InitOptions {
  return {
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
    githubAction: args.includes("--github-action"),
    update: args.includes("--update")
  };
}

function formatInstallMessage(
  result: Awaited<ReturnType<typeof installGenericTemplates>>[number],
  dryRun: boolean
): string {
  if (dryRun) {
    if (result.action === "skip") {
      return `Would skip ${result.type}: ${result.path} already exists\n`;
    }

    const preview = result.preview ? `\n${result.preview}\n` : "";
    return `Would ${result.action} ${result.type}: ${result.path}\n${preview}`;
  }

  if (result.action === "skip") {
    return `Skipped ${result.type}: ${result.path} already exists\n`;
  }

  const verb = result.action === "overwrite"
    ? "Overwrote"
    : result.action === "update"
      ? "Updated"
      : "Created";
  return `${verb} ${result.type}: ${result.path}\n`;
}

export async function initCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseInitOptions(args);
  const knownFlags = new Set(["--force", "--dry-run", "--github-action", "--update"]);
  const unknownFlag = args.find((arg) => arg.startsWith("--") && !knownFlags.has(arg));

  if (unknownFlag) {
    io.stderr(`Unknown init option: ${unknownFlag}\n`);
    return 1;
  }

  const results = await installGenericTemplates({
    cwd: io.cwd,
    force: options.force,
    dryRun: options.dryRun,
    githubAction: options.githubAction
  });

  for (const result of results) {
    io.stdout(formatInstallMessage(result, options.dryRun));
  }

  if (options.update) {
    const agentsResult = results.find((result) => result.path === "AGENTS.md");
    if (agentsResult?.action === "update") {
      io.stdout("Updated RCC agent instructions in AGENTS.md while preserving manual content.\n");
    } else if (agentsResult?.action === "skip") {
      io.stdout("AGENTS.md already has current RCC agent instructions.\n");
    }
  }

  if (options.dryRun) {
    io.stdout("Dry run complete. No files were written.\n");
    return 0;
  }

  let configMessage: string;
  if (await hasConfig(io.cwd)) {
    configMessage = `Config already exists: ${getConfigPath(io.cwd)}\n`;
  } else {
    const configPath = await writeDefaultConfig(io.cwd);
    configMessage = `Initialized repo-context-center config: ${configPath}\n`;
  }

  io.stdout(configMessage);

  try {
    const mapResult = await mapRepository({
      cwd: io.cwd,
      maxFiles: 500,
      write: true
    });
    io.stdout(`Generated repository context: ${mapResult.written.length} files updated (${mapResult.data.filesScanned} files scanned).\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`Warning: failed to generate repository context during init: ${message}\n`);
    return 1;
  }

  return 0;
}
