import { archiveContextFiles, type ArchiveResult } from "../../core/archiver";
import type { CliIO } from "../index";

interface ArchiveCliOptions {
  keep: number;
  dryRun: boolean;
}

function parseArchiveOptions(args: string[]): ArchiveCliOptions | undefined {
  const options: ArchiveCliOptions = {
    keep: 50,
    dryRun: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--keep") {
      const value = args[index + 1];
      if (!value) {
        return undefined;
      }

      options.keep = Number(value);
      index += 1;
      continue;
    }

    return undefined;
  }

  if (!Number.isInteger(options.keep) || options.keep < 1) {
    return undefined;
  }

  return options;
}

function formatResult(result: ArchiveResult, dryRun: boolean): string {
  const lines = [dryRun ? "Archive dry run" : "Archive complete", ""];

  for (const file of result.files) {
    if (file.missing) {
      lines.push(`Skipped missing optional file: ${file.sourcePath}`);
      continue;
    }

    if (file.archived === 0) {
      lines.push(`No archive needed: ${file.sourcePath} (${file.kept} entries)`);
      continue;
    }

    const action = dryRun ? "Would archive" : "Archived";
    lines.push(`${action} ${file.archived} entries from ${file.sourcePath} to ${file.archivePath}`);
    lines.push(`Kept ${file.kept} entries in ${file.sourcePath}`);
  }

  if (dryRun) {
    lines.push("", "No files were written.");
  } else {
    for (const updatedPath of result.updatedPaths) {
      if (updatedPath === "docs/ai-context/WORK_LOG.md") {
        lines.push(`RCC memory updated: ${updatedPath}`);
      } else if (updatedPath === "docs/ai-context/WORK_INDEX.md") {
        lines.push(`RCC work index updated: ${updatedPath}`);
      } else if (updatedPath === "docs/ai-context/REPOSITORY_LEARNING.md") {
        lines.push(`RCC learning updated: ${updatedPath}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

export async function archiveCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseArchiveOptions(args);
  if (!options) {
    io.stderr("Unknown archive option. Supported options: --keep <number>, --dry-run\n");
    return 1;
  }

  const result = await archiveContextFiles({
    cwd: io.cwd,
    keep: options.keep,
    dryRun: options.dryRun
  });

  io.stdout(formatResult(result, options.dryRun));
  return 0;
}
