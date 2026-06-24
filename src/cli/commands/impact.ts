import type { CliIO } from "../index";
import { buildImpactAnalysis } from "../impact/buildImpact";
import { impactUsage, parseImpactOptions } from "../impact/impactOptions";
import { renderImpactJson, renderImpactText } from "../impact/renderImpact";

export async function impactCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseImpactOptions(args);
  if (!options) {
    io.stderr(`${impactUsage}\n`);
    return 1;
  }

  const analysis = await buildImpactAnalysis(io.cwd, options.task, {
    maxFiles: options.maxFiles
  });

  io.stdout(options.json ? renderImpactJson(analysis) : renderImpactText(analysis));
  return 0;
}
