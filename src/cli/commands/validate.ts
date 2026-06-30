import { validateContextSetup, type ValidationReport } from "../../core/validator";
import type { CliIO } from "../index";

interface ValidateOptions {
  strict: boolean;
}

function parseValidateOptions(args: string[]): ValidateOptions | undefined {
  const unknownFlag = args.find((arg) => arg.startsWith("--") && arg !== "--strict");
  if (unknownFlag) {
    return undefined;
  }

  return {
    strict: args.includes("--strict")
  };
}

function formatReport(report: ValidationReport, strict: boolean): string {
  const lines = ["repo-context-center validation report", ""];

  if (report.missing.length === 0) {
    lines.push("Required files: ok");
  } else {
    lines.push(`Missing required files: ${report.missing.length}`);
    for (const issue of report.missing) {
      lines.push(`  - ${issue.path}: ${issue.message}`);
    }
  }

  if (report.warnings.length === 0) {
    lines.push("Warnings: 0");
  } else {
    lines.push(`Warnings: ${report.warnings.length}`);
    for (const issue of report.warnings) {
      lines.push(`  - ${issue.path}: ${issue.message}`);
    }
  }

  if (report.missing.length > 0) {
    lines.push("", "Result: failed");
  } else if (strict && report.warnings.length > 0) {
    lines.push("", "Result: failed in strict mode");
  } else {
    lines.push("", "Result: passed");
  }

  return `${lines.join("\n")}\n`;
}

export async function validateCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseValidateOptions(args);
  if (!options) {
    io.stderr("Unknown validate option. Supported options: --strict\n");
    return 1;
  }

  const report = await validateContextSetup(io.cwd);
  const hasFailures = report.missing.length > 0 || (options.strict && report.warnings.length > 0);
  const output = formatReport(report, options.strict);

  if (hasFailures) {
    io.stderr(output);
    return 1;
  }

  io.stdout(output);
  return 0;
}
