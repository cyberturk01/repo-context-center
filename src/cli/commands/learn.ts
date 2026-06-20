import type { CliIO } from "../index";
import { buildLearnResult } from "../learn/buildLearnResult";
import { formatLearnOptionsUsage, parseLearnOptions } from "../learn/learnOptions";
import { renderLearnDebug, renderLearnJson, renderLearnText } from "../learn/renderLearn";
import { writeRepositoryLearning } from "../learn/writeLearn";

export async function learnCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseLearnOptions(args);
  if (!options) {
    io.stderr(formatLearnOptionsUsage());
    return 1;
  }

  const result = await buildLearnResult(io.cwd);
  const writtenPath = options.write ? await writeRepositoryLearning(io.cwd, result.model) : null;

  if (options.json) {
    io.stdout(renderLearnJson(result.model));
    return 0;
  }

  if (options.write && !options.debug) {
    io.stdout(`Wrote ${writtenPath}\n`);
    return 0;
  }

  io.stdout(`${renderLearnText(result.model)}${options.debug ? `${renderLearnDebug(result.debug)}\n` : ""}`);
  return 0;
}
