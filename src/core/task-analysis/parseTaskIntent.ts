import { analyzeTaskIntent, type TaskIntentAnalysis } from "../taskIntent";

export function parseTaskIntent(task: string): TaskIntentAnalysis {
  return analyzeTaskIntent(task);
}
