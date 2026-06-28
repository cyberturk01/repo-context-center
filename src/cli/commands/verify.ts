import type { CliIO } from "../index";
import { buildVerifyReport } from "../verify/buildVerify";
import { parseVerifyOptions, verifyUsage } from "../verify/verifyOptions";
import { renderVerifyJson, renderVerifyText } from "../verify/renderVerify";

export async function verifyCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseVerifyOptions(args);
  if (!options) {
    io.stderr(`${verifyUsage}\n`);
    return 1;
  }

  const report = await buildVerifyReport(io.cwd, options.task, {
    maxFiles: options.maxFiles,
    taskOnly: options.taskOnly
  });

  io.stdout(options.json ? renderVerifyJson(report) : renderVerifyText(report));
  return 0;
}
