export interface HandoffOptions {
  agent: boolean;
  debug: boolean;
  json: boolean;
  task: string | null;
}

export interface HandoffBrief {
  schemaVersion: 1;
  command: "handoff";
  task: string | null;
  generatedAt: string;
  currentState: string[];
  memory: string[];
  readFirst: string[];
  nextActions: string[];
  avoid: string[];
  nextCommand: string;
  debug?: {
    cwd: string;
    sources: {
      agentsPresent: boolean;
      changeLogCount: number;
      decisionsCount: number;
      gitStatusCount: number;
      lessonsCount: number;
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
  nextActions: string[];
  avoid: string[];
  nextCommand: string;
}

export interface CompactAgentHandoff {
  schemaVersion: 1;
  command: "handoff";
  task: string | null;
  generatedAt: string;
  currentState: string[];
  memory: string[];
  readFirst: string[];
  nextActions: string[];
  avoid: string[];
  nextCommand: string;
}
