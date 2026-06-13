import { getConfigPath, hasConfig, writeDefaultConfig } from "../../core/config";
import { installGenericTemplates } from "../../core/templateInstaller";
import type { CliIO } from "../index";

interface InitOptions {
  force: boolean;
  dryRun: boolean;
}

function parseInitOptions(args: string[]): InitOptions {
  return {
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run")
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

    return `Would ${result.action} ${result.type}: ${result.path}\n`;
  }

  if (result.action === "skip") {
    return `Skipped ${result.type}: ${result.path} already exists\n`;
  }

  const verb = result.action === "overwrite" ? "Overwrote" : "Created";
  return `${verb} ${result.type}: ${result.path}\n`;
}

export async function initCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseInitOptions(args);
  const unknownFlag = args.find((arg) => arg.startsWith("--") && arg !== "--force" && arg !== "--dry-run");

  if (unknownFlag) {
    io.stderr(`Unknown init option: ${unknownFlag}\n`);
    return 1;
  }

  const results = await installGenericTemplates({
    cwd: io.cwd,
    force: options.force,
    dryRun: options.dryRun
  });

  for (const result of results) {
    io.stdout(formatInstallMessage(result, options.dryRun));
  }

  if (options.dryRun) {
    io.stdout("Dry run complete. No files were written.\n");
    return 0;
  }

  if (await hasConfig(io.cwd)) {
    io.stdout(`Config already exists: ${getConfigPath(io.cwd)}\n`);
    return 0;
  }

  const configPath = await writeDefaultConfig(io.cwd);
  io.stdout(`Initialized repo-context-center config: ${configPath}\n`);
  return 0;
}
