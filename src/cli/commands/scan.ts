import { scanRepository, type ScanReport } from "../../core/scanner";
import type { CliIO } from "../index";

interface ScanOptions {
  json: boolean;
}

function parseScanOptions(args: string[]): ScanOptions | undefined {
  const unknownFlag = args.find((arg) => arg !== "--json");
  if (unknownFlag) {
    return undefined;
  }

  return {
    json: args.includes("--json")
  };
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function formatScanReport(report: ScanReport): string {
  const lines = [
    "repo-context-center scan report",
    "",
    `Source folders: ${formatList(report.detected.sourceFolders)}`,
    `Test folders: ${formatList(report.detected.testFolders)}`,
    `Generated folders: ${formatList(report.detected.generatedFolders)}`,
    ""
  ];

  if (report.detected.modules.length > 0) {
    lines.push("Detected modules:");
    for (const module of report.detected.modules) {
      lines.push(`  - ${module.path}`);
    }
  } else {
    lines.push("Detected modules: none");
  }

  lines.push("");

  for (const [file, suggestions] of Object.entries(report.suggestions)) {
    lines.push(file);
    lines.push(...suggestions.map((line) => (line ? `  ${line}` : "")));
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function scanCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseScanOptions(args);
  if (!options) {
    io.stderr("Unknown scan option. Supported options: --json\n");
    return 1;
  }

  const report = await scanRepository(io.cwd);
  if (options.json) {
    io.stdout(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  }

  io.stdout(formatScanReport(report));
  return 0;
}
