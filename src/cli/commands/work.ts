import { buildWorkBriefForTask } from "../work/buildWorkBrief";
import { renderWorkBriefAgentJson, toAgentRoute } from "../work/renderAgent";
import {
  renderWorkBriefCompactJson,
  renderWorkBriefDebugJson,
  toCompactWorkBrief
} from "../work/renderJson";
import { formatWorkBrief, renderWorkBriefLines } from "../work/renderText";
import { formatWorkOptionsUsage, parseWorkOptions } from "../work/workOptions";
import type {
  CompactWorkBrief,
  ContextBudget,
  PublicAgentRoute,
  PublicAgentRouteItem,
  PublicCompactWorkFile,
  WorkBrief
} from "../work/workTypes";
import type { CliIO } from "../index";

export type {
  CompactWorkBrief,
  PublicAgentRoute,
  PublicAgentRouteItem,
  PublicCompactWorkFile
} from "../work/workTypes";

function estimateRenderedWorkBriefTokens(brief: WorkBrief): number {
  return Math.ceil(renderWorkBriefLines(brief).join("\n").length / 4);
}

export async function buildCompactWorkBrief(
  cwd: string,
  task: string,
  options: { contextBudget?: ContextBudget; maxFiles?: number } = {}
): Promise<CompactWorkBrief> {
  return toCompactWorkBrief(await buildWorkBriefForTask(cwd, task, {
    ...options,
    estimateTokens: estimateRenderedWorkBriefTokens
  }));
}

export async function buildAgentWorkRoute(
  cwd: string,
  task: string,
  options: { contextBudget?: ContextBudget; maxFiles?: number; verbose?: boolean } = {}
): Promise<PublicAgentRoute> {
  return toAgentRoute(
    await buildWorkBriefForTask(cwd, task, {
      ...options,
      estimateTokens: estimateRenderedWorkBriefTokens
    }),
    options.verbose ?? false
  );
}

export async function workCommand(io: CliIO, args: string[] = []): Promise<number> {
  const options = parseWorkOptions(args);
  if (!options) {
    io.stderr(formatWorkOptionsUsage());
    return 1;
  }

  const brief = await buildWorkBriefForTask(io.cwd, options.task, {
    contextBudget: options.contextBudget,
    maxFiles: options.maxFiles,
    estimateTokens: estimateRenderedWorkBriefTokens
  });

  if (options.agent) {
    io.stdout(renderWorkBriefAgentJson(brief, options.verbose));
    return 0;
  }

  if (options.json) {
    io.stdout(options.debug ? renderWorkBriefDebugJson(brief) : renderWorkBriefCompactJson(brief));
    return 0;
  }

  io.stdout(formatWorkBrief(brief));
  return 0;
}
