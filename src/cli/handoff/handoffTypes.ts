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
  status: "placeholder";
  summary: string;
  sections: {
    completed: string[];
    currentState: string[];
    nextSteps: string[];
    verification: string[];
  };
  debug?: {
    cwd: string;
    generatedAt: string;
  };
}
