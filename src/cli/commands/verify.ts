import type { CliIO } from "../index";
import { buildVerificationPlan } from "../verify/buildVerify";
import { parseVerifyOptions, verifyUsage } from "../verify/verifyOptions";
import { renderVerifyJson, renderVerifyText } from "../verify/renderVerify";

export async function verifyCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseVerifyOptions(args);
  if (!options) {
    io.stderr(`${verifyUsage}\n`);
    return 1;
  }

  const plan = await buildVerificationPlan(io.cwd, options.task, {
    taskOnly: options.taskOnly
  });

  io.stdout(options.json ? renderVerifyJson(plan) : renderVerifyText(plan));
  return 0;
}
