import type { HandoffBrief } from "./handoffTypes";

export function renderHandoffJson(brief: HandoffBrief): string {
  return `${JSON.stringify(brief, null, 2)}\n`;
}
