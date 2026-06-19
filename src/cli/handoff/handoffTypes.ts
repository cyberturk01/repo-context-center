export interface HandoffOptions {
  agent: boolean;
  debug: boolean;
  json: boolean;
  task: string | null;
  write: boolean;
}

export interface HandoffFile {
  path: string;
  reason?: string;
}

export interface HandoffBrief {
  schemaVersion: 1;
  command: "handoff";
  task: string | null;
  generatedAt: string;
  currentState: string[];
  memory: string[];
  readFirst: string[];
  nextRecommendedFiles: HandoffFile[];
  relevantTests: HandoffFile[];
  relevantDecisions: string[];
  nextActions: string[];
  avoid: string[];
  nextLookup: string;
  nextCommand: string;
  writtenPath?: string;
  debug?: {
    cwd: string;
    sources: {
      agentsPresent: boolean;
      changeLogCount: number;
      decisionsCount: number;
      gitStatusCount: number;
      lessonsCount: number;
      latestDoneEntryPresent: boolean;
      recentTouchedFilesCount: number;
      workLogCount: number;
    };
  };
}

export interface PublicHandoffBrief {
  schemaVersion: 1;
  command: "handoff";
  task: string | null;
  generatedAt: string;
  currentState: string[];
  memory: string[];
  readFirst: string[];
  nextRecommendedFiles: HandoffFile[];
  relevantTests: HandoffFile[];
  relevantDecisions: string[];
  nextActions: string[];
  avoid: string[];
  nextLookup: string;
  nextCommand: string;
  writtenPath?: string;
}

export interface CompactAgentHandoff {
  schemaVersion: 1;
  command: "handoff";
  task: string | null;
  generatedAt: string;
  currentState: string[];
  memory: string[];
  readFirst: string[];
  nextRecommendedFiles: HandoffFile[];
  relevantTests: HandoffFile[];
  relevantDecisions: string[];
  nextActions: string[];
  avoid: string[];
  nextLookup: string;
  nextCommand: string;
  writtenPath?: string;
}
