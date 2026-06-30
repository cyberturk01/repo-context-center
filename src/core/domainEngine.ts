export type Domain =
  | "auth"
  | "login"
  | "cache"
  | "redis"
  | "database"
  | "postgres"
  | "workflow"
  | "github-integration"
  | "frontend"
  | "backend"
  | "api"
  | "config"
  | "context";

export type DomainEvidenceSource =
  | "task text"
  | "affected file path"
  | "affected test path"
  | "context path";

export interface DomainSignal {
  source: DomainEvidenceSource;
  value: string;
  path?: string;
}

export interface DomainMatch {
  domain: Domain;
  confidence: number;
  signals: DomainSignal[];
  matchedPaths: string[];
}

export interface DomainEngineInput {
  task?: string;
  affectedFilePaths?: string[];
  affectedTestPaths?: string[];
  contextPaths?: string[];
  includeContext?: boolean;
}

interface DomainDefinition {
  domain: Domain;
  pattern: RegExp;
}

export const domainDefinitions: DomainDefinition[] = [
  { domain: "auth", pattern: /\b(auth|authentication|authorization|authorize|oauth|jwt|session|sessions)\b/i },
  { domain: "login", pattern: /\b(log-?in|log-?out|signin|sign-in|signout|sign-out|credentials?)\b/i },
  { domain: "cache", pattern: /\b(cache|caches|cached|caching|cacheable)\b/i },
  { domain: "redis", pattern: /\b(redis|ioredis|redis-cli)\b/i },
  { domain: "database", pattern: /\b(database|db|schema|schemas|migration|migrations|sql|query|queries|orm)\b/i },
  { domain: "postgres", pattern: /\b(postgres|postgresql|pg|psql)\b/i },
  { domain: "workflow", pattern: /\b(github workflow|github workflows|github action|github actions|ci|workflow|workflows|pipeline|pipelines)\b/i },
  { domain: "github-integration", pattern: /\b(github api|github integration|github app|github webhook|github controller|github route|octokit)\b/i },
  { domain: "frontend", pattern: /\b(frontend|front-end|ui|browser|component|components|page|pages|react|vue|svelte|css|tsx|jsx)\b/i },
  { domain: "backend", pattern: /\b(backend|back-end|api|server|service|services|controller|controllers|route|routes|endpoint|endpoints|worker|workers)\b/i },
  { domain: "api", pattern: /\b(api|apis|endpoint|endpoints|rest|graphql|rpc)\b/i },
  { domain: "config", pattern: /\b(config|configuration|settings|env|environment|feature flag|feature flags|package\.json|tsconfig|vite|webpack|eslint)\b/i },
  { domain: "context", pattern: /\b(context|repo context|rcc|agents\.md|docs\/ai-context)\b/i }
];

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function normalizedPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function isContextPath(filePath: string): boolean {
  return (
    /^agents\.md$/i.test(filePath)
    || /^docs\/ai-context\//i.test(filePath)
    || /^\.agents\//i.test(filePath)
    || /^\.codex\//i.test(filePath)
  );
}

export function isWorkflowPath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);

  return (
    /^\.github\/workflows\/.+\.ya?ml$/i.test(normalized)
    || /^\.github\/actions\//i.test(normalized)
    || /(^|\/)(ci|workflow|workflows|pipeline|pipelines)[^/]*\.ya?ml$/i.test(normalized)
  );
}

function hasStrongWorkflowTaskWording(task: string): boolean {
  return /\b(github actions?|ci workflow|ci workflows|workflow ya?ml|pipeline|pipelines|ci pipeline|release pipeline)\b/i.test(task);
}

export function isGithubIntegrationPath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);

  if (/^\.github\/(workflows|actions)\//i.test(normalized)) {
    return false;
  }

  return (
    /github/i.test(normalized)
    && /(api|app|apps|client|clients|controller|controllers|integration|integrations|route|routes|service|services|webhook|webhooks)/i.test(normalized)
  ) || /(^|\/)(api|controllers?|integrations?|routes?|services?|webhooks?)\/github[^/]*\.[cm]?[jt]sx?$/i.test(normalized);
}

export function isFrontendPath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);

  return (
    /(^|\/)(app|builder|browser|components?|frontend|pages?|ui|views?)\//i.test(normalized)
    || /\.(css|scss|sass|less|tsx|jsx)$/i.test(normalized)
  );
}

export function isFrontendVisiblePath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);
  const basename = normalized.split("/").pop() ?? "";

  if (/\b(icon|icons?|helper|helpers?|util|utils?|adapter|adapters?|client|clients?|store|stores?|state|constants?|types?)\b/i.test(basename)) {
    return false;
  }

  return (
    /(^|\/)(components?|pages?|views?)\//i.test(normalized)
    || /(^|\/)(app|ui|frontend|browser)\//i.test(normalized)
      && /(card|panel|page|screen|view|modal|dialog|form|button|menu|nav|layout|widget|component)/i.test(basename)
    || /\.(css|scss|sass|less)$/i.test(normalized)
      && /(^|\/)(components?|pages?|views?|app|ui|frontend|browser)\//i.test(normalized)
  );
}

export function isBackendBehaviorPath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);
  const basename = normalized.split("/").pop() ?? "";

  if (isFrontendPath(normalized) || isWorkflowPath(normalized) || isContextPath(normalized)) {
    return false;
  }

  return (
    /(^|\/)(api|controllers?|routes?|endpoints?|workers?|integrations?|middleware|services?|webhooks?)\//i.test(normalized)
    || /(api|controller|route|endpoint|worker|integration|middleware|service|webhook)/i.test(basename)
  );
}

export function isBackendDatabasePath(filePath: string): boolean {
  const normalized = normalizedPath(filePath);

  if (isFrontendPath(normalized)) {
    return false;
  }

  return (
    /(^|\/)(db|database|migrations?|schema|schemas|sql)\//i.test(normalized)
    || /(^|\/)(postgres|postgresql|pg|database|schema|migration|query|queries)[^/]*\.(sql|[cm]?[jt]sx?)$/i.test(normalized)
  );
}

function taskSignals(task: string, pattern: RegExp): DomainSignal[] {
  const match = task.match(pattern);

  return match ? [{ source: "task text", value: match[0] }] : [];
}

export function taskMentionsDomain(task: string, domain: Domain): boolean {
  return domainDefinitions.some((definition) => (
    definition.domain === domain && definition.pattern.test(task)
  ));
}

function pathSignals(source: DomainEvidenceSource, paths: string[]): DomainSignal[] {
  return paths.map((filePath) => ({ source, value: filePath, path: filePath }));
}

function confidenceFor(signals: DomainSignal[], matchedPaths: string[]): number {
  const sources = new Set(signals.map((signal) => signal.source));

  if (matchedPaths.length > 0 && sources.has("task text")) {
    return 0.95;
  }

  if (matchedPaths.length > 0) {
    return 0.85;
  }

  if (sources.has("task text")) {
    return 0.65;
  }

  return 0.5;
}

function addDomainMatch(
  matches: DomainMatch[],
  domain: Domain,
  paths: string[],
  signals: DomainSignal[]
): void {
  const uniqueSignals = signals.filter((signal, index) => (
    signals.findIndex((candidate) => (
      candidate.source === signal.source
      && candidate.value === signal.value
      && candidate.path === signal.path
    )) === index
  ));

  if (uniqueSignals.length === 0) {
    return;
  }

  const matchedPaths = uniqueStrings(paths);

  matches.push({
    domain,
    confidence: confidenceFor(uniqueSignals, matchedPaths),
    signals: uniqueSignals,
    matchedPaths
  });
}

export function detectDomains(input: DomainEngineInput): DomainMatch[] {
  const task = input.task ?? "";
  const affectedFilePaths = input.affectedFilePaths ?? [];
  const affectedTestPaths = input.affectedTestPaths ?? [];
  const contextPaths = input.contextPaths ?? [];
  const affectedPaths = [...affectedFilePaths, ...affectedTestPaths];
  const matches: DomainMatch[] = [];

  for (const definition of domainDefinitions) {
    if (definition.domain === "context") {
      if (!input.includeContext) {
        continue;
      }

      const contextMatches = contextPaths.filter((filePath) => definition.pattern.test(filePath));

      addDomainMatch(
        matches,
        definition.domain,
        contextMatches,
        pathSignals("context path", contextMatches)
      );
      continue;
    }

    if (definition.domain === "workflow") {
      const workflowPaths = affectedFilePaths.filter(isWorkflowPath);
      const workflowTaskSignals = hasStrongWorkflowTaskWording(task) ? taskSignals(task, definition.pattern) : [];

      addDomainMatch(
        matches,
        definition.domain,
        workflowPaths,
        [
          ...pathSignals("affected file path", workflowPaths),
          ...(workflowPaths.length > 0 || affectedFilePaths.length === 0 ? workflowTaskSignals : [])
        ]
      );
      continue;
    }

    if (definition.domain === "github-integration") {
      const integrationPaths = affectedFilePaths.filter(isGithubIntegrationPath);

      addDomainMatch(
        matches,
        definition.domain,
        integrationPaths,
        [
          ...taskSignals(task, definition.pattern),
          ...pathSignals("affected file path", integrationPaths)
        ]
      );
      continue;
    }

    if (definition.domain === "frontend") {
      const frontendPaths = affectedFilePaths.filter(isFrontendVisiblePath);

      addDomainMatch(
        matches,
        definition.domain,
        frontendPaths,
        [
          ...pathSignals("affected file path", frontendPaths),
          ...(frontendPaths.length > 0 ? taskSignals(task, definition.pattern) : [])
        ]
      );
      continue;
    }

    if (definition.domain === "backend") {
      const backendPaths = affectedFilePaths.filter(isBackendBehaviorPath);

      addDomainMatch(
        matches,
        definition.domain,
        backendPaths,
        [
          ...pathSignals("affected file path", backendPaths),
          ...(backendPaths.length > 0 ? taskSignals(task, definition.pattern) : [])
        ]
      );
      continue;
    }

    const signals: DomainSignal[] = [];
    const paths = new Set<string>();

    signals.push(...taskSignals(task, definition.pattern));

    const affectedFileMatches = affectedFilePaths.filter((filePath) => definition.pattern.test(filePath));

    if (affectedFileMatches.length > 0) {
      signals.push(...pathSignals("affected file path", affectedFileMatches));
      affectedFileMatches.forEach((filePath) => paths.add(filePath));
    }

    const testMatches = affectedTestPaths.filter((filePath) => definition.pattern.test(filePath));

    if (testMatches.length > 0) {
      signals.push(...pathSignals("affected test path", testMatches));
      testMatches.forEach((filePath) => paths.add(filePath));
    }

    if (
      signals.length > 0
      && signals.every((signal) => signal.source === "affected test path")
    ) {
      continue;
    }

    if (signals.length === 0) {
      continue;
    }

    if (paths.size === 0) {
      affectedPaths.forEach((filePath) => paths.add(filePath));
    }

    addDomainMatch(matches, definition.domain, [...paths], signals);
  }

  return matches;
}
