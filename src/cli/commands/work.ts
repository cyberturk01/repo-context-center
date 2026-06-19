import { buildWorkBriefForTask } from "../work/buildWorkBrief";
import { renderAgent } from "../work/renderAgent";
import { renderJson } from "../work/renderJson";
import { renderText } from "../work/renderText";
import { usage } from "../work/workConstants";
import { parseWorkOptions } from "../work/workOptions";

export async function workCommand(
  io: {
    cwd: string;
    stdout: (message: string) => void;
    stderr: (message: string) => void;
  },
  args: string[] = []
): Promise<number> {
  const options = parseWorkOptions(args);
  if (!options) {
    io.stderr(`${usage}\n`);
    return 1;
  }

  const brief = await buildWorkBriefForTask(io.cwd, options.task, {
    contextBudget: options.contextBudget,
    maxFiles: options.maxFiles
  });

  if (options.agent) {
    io.stdout(renderAgent(brief, options.verbose));
    return 0;
  }

  if (options.json) {
    io.stdout(renderJson(brief, options.debug));
    return 0;
  }

  io.stdout(renderText(brief));
  return 0;
}
