import type { StartupContext } from "../../core/suggester";

export interface WorkOptions {
  agent: boolean;
  contextBudget: ContextBudget;
  debug: boolean;
  json: boolean;
  maxFiles: number;
  task: string;
  verbose: boolean;
}

export interface TargetedLookupHint {
  path: string;
  term: string;
  reason: string;
  signal: TargetedLookupSignal;
  confidence: "high" | "medium" | "low";
  score: number;
  index: number;
}

export type TargetedLookupSignal =
  | "exact-filename-match"
  | "command-name-match"
  | "filename-match"
  | "paired-test"
  | "task-routing"
  | "decision-memory"
  | "work-log"
  | "path-match"
  | "semantic-match";

export interface WorkRecommendation {
  path: string;
  reasons: string[];
}

export type ContextBudget = "minimal" | "balanced" | "deep";
export type ReadFirstPriority = "required" | "task_specific" | "optional" | "skipped";

export interface ReadFirstGuidanceItem {
  path: string;
  reason: string;
  priority: ReadFirstPriority;
}

export interface ReadFirstGuidance {
  required: ReadFirstGuidanceItem[];
  taskSpecific: ReadFirstGuidanceItem[];
  optional: ReadFirstGuidanceItem[];
  skipped: ReadFirstGuidanceItem[];
}

export interface WorkMapFreshness {
  status: "fresh" | "maybe_stale" | "stale" | "unknown";
  score: number;
  reason: string;
  latestContextUpdate: string | null;
  latestRelevantSourceChange: string | null;
  affectedFiles: string[];
  affectedContextFiles: string[];
  message: string;
}

export interface WorkBrief {
  command: "work";
  task: string;
  contextBudget: ContextBudget;
  mapFreshness: WorkMapFreshness;
  routingGuidance: string[];
  startupContext: StartupContext;
  primaryFiles: WorkRecommendation[];
  supportingFiles: WorkRecommendation[];
  tests: WorkRecommendation[];
  agentRules: WorkRecommendation[];
  contextIfUnclear: WorkRecommendation[];
  taskFiles: WorkRecommendation[];
  supportingTests: WorkRecommendation[];
  workflowDocs: WorkRecommendation[];
  contextDocs: WorkRecommendation[];
  recommendedFiles: WorkRecommendation[];
  relevantTests: WorkRecommendation[];
  targetedLookupHints: Array<Omit<TargetedLookupHint, "index">>;
  promotedFromTargetedLookup: Array<Omit<TargetedLookupHint, "index">>;
  relevantDecisions: string[];
  recentLogs: string[];
  tokenEstimate: {
    roughTokens: number | null;
    text: string;
  };
  risks: string[];
  cheapestPath: string[];
  avoid: string[];
  readFirst: string[];
  readFirstGuidance: ReadFirstGuidance;
  nextCheapestCommand: string;
  nextCommand: string;
}

export interface PublicWorkBrief {
  schemaVersion: 1;
  command: "work";
  task: string;
  contextBudget: ContextBudget;
  mapFreshness: {
    status: WorkMapFreshness["status"];
    score: number;
    reason: string;
    latestContextUpdate: string | null;
    latestRelevantSourceChange: string | null;
    affectedFiles: string[];
    affectedContextFiles: string[];
  };
  recommendedFiles: PublicWorkFile[];
  relevantTests: PublicWorkFile[];
  primaryFiles: PublicWorkFile[];
  supportingFiles: PublicWorkFile[];
  tests: PublicWorkFile[];
  agentRules: PublicWorkFile[];
  contextIfUnclear: PublicWorkFile[];
  taskFiles: PublicWorkFile[];
  supportingTests: PublicWorkFile[];
  workflowDocs: PublicWorkFile[];
  contextDocs: PublicWorkFile[];
  cheapestPath: string[];
  avoid: string[];
  nextCheapestCommand: string;
  promotedFromTargetedLookup: PublicTargetedLookupHint[];
  relevantDecisions: string[];
  recentLogs: string[];
  risks: PublicWorkRisk[];
  readFirstGuidance: {
    required: PublicReadFirstGuidanceItem[];
    taskSpecific: PublicReadFirstGuidanceItem[];
    optionalIfUnclear: PublicReadFirstGuidanceItem[];
    skippedForNow: PublicReadFirstGuidanceItem[];
  };
  readFirst: string[];
  targetedLookupHints: PublicTargetedLookupHint[];
  tokenEstimate: {
    humanBriefTokens: number | null;
  };
  fastLookup: {
    command: string;
    guidance: string;
  };
  nextCommand: {
    command: string;
    when: string;
  };
}

export interface CompactWorkBrief {
  schemaVersion: 1;
  command: "work";
  task: string;
  contextBudget: ContextBudget;
  freshness: {
    status: WorkMapFreshness["status"];
    score: number;
    reason: string;
  };
  taskFiles: PublicCompactWorkFile[];
  primaryFiles: PublicCompactWorkFile[];
  supportingFiles: PublicCompactWorkFile[];
  tests: PublicCompactWorkFile[];
  agentRules: PublicCompactWorkFile[];
  readFirst: string[];
  contextIfUnclear: string[];
  nextLookup: string;
  nextCommand: string;
  reusePolicy: "Call once per task. Do not rerun work unless task meaning changes. Use rcc find if route is insufficient.";
  tokens: {
    jsonEstimate: number;
  };
}

export interface PublicWorkFile {
  path: string;
  reason: string | null;
  confidence: TargetedLookupHint["confidence"] | null;
  score: number | null;
}

export interface PublicCompactWorkFile {
  path: string;
  reason?: string;
}

export interface PublicReadFirstGuidanceItem {
  path: string;
  reason: string;
}

export interface PublicTargetedLookupHint extends PublicWorkFile {
  signal: TargetedLookupSignal;
}

export interface PublicWorkRisk {
  level: string;
  reason: string | null;
}

export type PublicAgentRouteItem = string | PublicCompactWorkFile;

export interface PublicAgentRoute {
  task: string;
  primaryFiles: PublicAgentRouteItem[];
  supportingFiles: PublicAgentRouteItem[];
  tests: PublicAgentRouteItem[];
  readFirst: PublicAgentRouteItem[];
  next: string;
  briefTokens: number;
}

export interface WorkFileCategorization {
  primaryFiles: WorkRecommendation[];
  supportingFiles: WorkRecommendation[];
  tests: WorkRecommendation[];
  agentRules: WorkRecommendation[];
  contextIfUnclear: WorkRecommendation[];
}
