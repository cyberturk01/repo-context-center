import { buildHandoffBrief } from "../handoff/buildHandoffBrief";
import { renderHandoffAgent } from "../handoff/renderAgent";
import { renderHandoffJson } from "../handoff/renderJson";
import { renderHandoffText } from "../handoff/renderText";
import { formatHandoffOptionsUsage, parseHandoffOptions } from "../handoff/handoffOptions";
import type { CliIO } from "../index";

export async function handoffCommand(
  io: CliIO,
  args: string[] = []
): Promise<number> {
  const options = parseHandoffOptions(args);
  if (!options) {
    io.stderr(formatHandoffOptionsUsage());
    return 1;
  }

  const brief = await buildHandoffBrief(io.cwd, options);

  if (options.agent) {
    io.stdout(renderHandoffAgent(brief));
    return 0;
  }

  if (options.json) {
    io.stdout(renderHandoffJson(brief, options.debug));
    return 0;
  }

  io.stdout(renderHandoffText(brief));
  return 0;
}
