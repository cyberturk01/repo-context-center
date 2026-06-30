import { buildRepositoryMetrics } from "../../analytics/metricsCollector";
import { renderMetricsJson, renderMetricsText } from "../../analytics/renderMetrics";
import type { CliIO } from "../index";

interface MetricsOptions {
  json: boolean;
  task: string;
}

const usage = 'Usage: rcc metrics "<task>" [--json]';

function parseMetricsOptions(args: string[]): MetricsOptions | undefined {
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

export async function metricsCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseMetricsOptions(args);
  if (!options) {
    io.stderr(`${usage}\n`);
    return 1;
  }

  const metrics = await buildRepositoryMetrics(io.cwd, options.task);

  io.stdout(options.json ? renderMetricsJson(metrics) : renderMetricsText(metrics));
  return 0;
}
