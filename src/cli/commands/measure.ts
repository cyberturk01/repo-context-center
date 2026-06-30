import type { CliIO } from "../index";
import { buildMeasureReport } from "../measure/buildMeasure";
import { renderMeasureJson, renderMeasureText } from "../measure/renderMeasure";

interface MeasureOptions {
  json: boolean;
  task: string;
}

const usage = 'Usage: rcc measure "<task>" [--json]';

function parseMeasureOptions(args: string[]): MeasureOptions | undefined {
  let json = false;
  const taskParts: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg.startsWith("--")) {
      return undefined;
    }

    taskParts.push(arg);
  }

  const task = taskParts.join(" ").trim();
  if (!task) {
    return undefined;
  }

  return { json, task };
}

export async function measureCommand(io: CliIO, args: string[] = []): Promise<number> {
  if (args.includes("--compare-naive")) {
    io.stderr("--compare-naive is supported by estimate, not measure. Use: rcc estimate --compare-naive\n");
    return 1;
  }

  const options = parseMeasureOptions(args);
  if (!options) {
    io.stderr(`${usage}\n`);
    return 1;
  }

  const report = await buildMeasureReport(io.cwd, options.task);

  io.stdout(options.json ? renderMeasureJson(report) : renderMeasureText(report));
  return 0;
}
