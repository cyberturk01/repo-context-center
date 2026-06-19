import path from "node:path";
import { pathExists } from "../../core/fileSystem";
import type { StartupContext } from "../../core/suggester";
import type { TaskIntentAnalysis } from "../../core/taskIntent";
import type {
  ContextBudget,
  ReadFirstGuidance,
  ReadFirstGuidanceItem,
  ReadFirstPriority,
  TargetedLookupHint
} from "./workTypes";

function includesTaskToken(tokens: string[], values: string[]): boolean {
  return values.some((value) => tokens.includes(value));
}

function hasStrongLookupHints(lookupHints: TargetedLookupHint[]): boolean {
  return lookupHints.filter((hint) => hint.confidence === "high" || hint.confidence === "medium").length >= 2;
}

function isBroadOrAmbiguousTask(task: string, taskIntent: TaskIntentAnalysis): boolean {
  return taskIntent.lookupTerms.length === 0 || /\b(clean\s*up|stuff|things)\b/i.test(task);
}

function hasWeakRouting(startup: StartupContext, lookupHints: TargetedLookupHint[]): boolean {
  return startup.likelySourceFiles.length === 0
    || startup.emptyRecommendationReasons.source !== undefined
    || !hasStrongLookupHints(lookupHints);
}

function guidanceItem(path: string, reason: string, priority: ReadFirstPriority): ReadFirstGuidanceItem {
  return { path, reason, priority };
}

function emptyReadFirstGuidance(): ReadFirstGuidance {
  return {
    required: [],
    taskSpecific: [],
    optional: [],
    skipped: []
  };
}

function addGuidanceItem(guidance: ReadFirstGuidance, item: ReadFirstGuidanceItem): void {
  if (item.priority === "task_specific") {
    guidance.taskSpecific.push(item);
  } else {
    guidance[item.priority].push(item);
  }
}

export async function existingReadFirstContextFiles(cwd: string): Promise<string[]> {
  const candidates = [
    "AGENTS.md",
    "docs/ai-context/TASK_ROUTING.md",
    "docs/ai-context/MODULE_INDEX.md",
    "docs/ai-context/DEPENDENCY_MAP.md",
    "docs/ai-context/RISK_REGISTER.md"
  ];
  const existing = await Promise.all(candidates.map(async (file) => (
    await pathExists(path.join(cwd, file)) ? file : undefined
  )));

  return existing.filter((file): file is string => file !== undefined);
}

function priorityForBudget(priority: ReadFirstPriority, contextBudget: ContextBudget): ReadFirstPriority {
  if (contextBudget === "minimal") {
    if (priority === "required") {
      return "required";
    }
    return priority === "task_specific" ? "optional" : "skipped";
  }

  return priority;
}

export function buildReadFirstGuidance(
  startup: StartupContext,
  lookupHints: TargetedLookupHint[],
  contextBudget: ContextBudget,
  existingFiles: string[],
  taskIntent: TaskIntentAnalysis
): ReadFirstGuidance {
  const guidance = emptyReadFirstGuidance();
  const existing = new Set(existingFiles);
  const tokens = taskIntent.lookupTerms;
  const readFirstDocs = new Set(startup.readFirstDocs);
  const routingWeak = hasWeakRouting(startup, lookupHints);
  const broadTask = isBroadOrAmbiguousTask(startup.task, taskIntent);
  const focusedCodeInvestigation = taskIntent.isCodeInvestigation && hasStrongLookupHints(lookupHints);
  const architectureSignal = includesTaskToken(tokens, [
    "architecture",
    "architectural",
    "module",
    "modules",
    "refactor",
    "component",
    "components",
    "service",
    "services"
  ]);
  const dependencySignal = includesTaskToken(tokens, [
    "dependency",
    "dependencies",
    "import",
    "imports",
    "build",
    "package",
    "packages",
    "integration",
    "integrations"
  ]);
  const riskSignal = !focusedCodeInvestigation && includesTaskToken(tokens, [
    "security",
    "risk",
    "risky",
    "release",
    "workflow",
    "workflows",
    "scanning",
    "scan",
    "freshness",
    "reporting",
    "report",
    "command",
    "commands",
    "behavior",
    "cli",
    "stdout",
    "stderr",
    "flag",
    "flags",
    "output"
  ]);

  if (existing.has("AGENTS.md")) {
    addGuidanceItem(guidance, guidanceItem("AGENTS.md", "repository agent workflow", "required"));
  }

  const docs: Array<{ path: string; signal: boolean; taskReason: string; optionalReason: string; skippedReason: string }> = [
    {
      path: "docs/ai-context/TASK_ROUTING.md",
      signal: (routingWeak || broadTask) && !focusedCodeInvestigation,
      taskReason: routingWeak
        ? "routing confidence is low or targeted lookup hints are weak"
        : "task is broad or ambiguous",
      optionalReason: "routing appears strong, but use if targeted hints are insufficient",
      skippedReason: "routing appears strong and targeted lookup hints are available"
    },
    {
      path: "docs/ai-context/MODULE_INDEX.md",
      signal: architectureSignal,
      taskReason: "task has architecture/module/refactor signal",
      optionalReason: "use if the change crosses module boundaries",
      skippedReason: "task is not architecture/module related"
    },
    {
      path: "docs/ai-context/DEPENDENCY_MAP.md",
      signal: dependencySignal,
      taskReason: "task has dependency/import/build/package/integration signal",
      optionalReason: "use if imports, packages, or integration boundaries become unclear",
      skippedReason: "task is not dependency/build/package related"
    },
    {
      path: "docs/ai-context/RISK_REGISTER.md",
      signal: riskSignal,
      taskReason: "task has security/risk/release/workflow/scanning/freshness/reporting/command-behavior signal",
      optionalReason: "use if the change touches high-risk behavior",
      skippedReason: "task has no explicit risk/security/release signal"
    }
  ];

  for (const doc of docs) {
    if (!existing.has(doc.path)) {
      continue;
    }

    let priority: ReadFirstPriority = doc.signal ? "task_specific" : "skipped";
    let reason = doc.signal ? doc.taskReason : doc.skippedReason;

    if (contextBudget === "deep") {
      priority = doc.signal || readFirstDocs.has(doc.path) ? "task_specific" : "optional";
      reason = doc.signal
        ? doc.taskReason
        : readFirstDocs.has(doc.path)
          ? "recommended by existing startup routing"
          : doc.optionalReason;
    } else if (!doc.signal && doc.path === "docs/ai-context/TASK_ROUTING.md") {
      priority = "optional";
      reason = doc.optionalReason;
    }

    addGuidanceItem(guidance, guidanceItem(doc.path, reason, priorityForBudget(priority, contextBudget)));
  }

  return guidance;
}

export function readFirstCompatibilityPaths(guidance: ReadFirstGuidance): string[] {
  return [...guidance.required, ...guidance.taskSpecific].map((item) => item.path);
}
