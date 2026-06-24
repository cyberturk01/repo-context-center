export interface TaskIntentAnalysis {
  normalizedTask: string;
  rawTokens: string[];
  expandedTerms: string[];
  lookupTerms: string[];
  domainTerms: string[];
  actionTerms: string[];
  lowSignalTerms: string[];
  isCodeInvestigation: boolean;
  hasWorkflowDomain: boolean;
  hasCiWorkflowIntent: boolean;
  hasRoutingImplementationIntent: boolean;
  hasDocumentationIntent: boolean;
  hasReleaseIntent: boolean;
  isExplicitCommandTask: boolean;
  nextLookupKeyword: string | null;
}

type TermGroup =
  | "action"
  | "domain"
  | "actionNamedCommand"
  | "lowSignal"
  | "codeInvestigation"
  | "roleRelated";

const termRegistry: Record<TermGroup, readonly string[]> = {
  action: [
    "add",
    "analyze",
    "analiz",
    "ara",
    "bul",
    "change",
    "check",
    "create",
    "debug",
    "duzelt",
    "düzelt",
    "ekle",
    "find",
    "fix",
    "goster",
    "göster",
    "implement",
    "improve",
    "inspect",
    "investigate",
    "incele",
    "iyilestir",
    "iyileştir",
    "kontrol",
    "listele",
    "list",
    "review",
    "search",
    "show",
    "update"
  ],
  domain: [
    "action",
    "actions",
    "auth",
    "ci",
    "config",
    "contract",
    "contracts",
    "decision",
    "decisions",
    "deploy",
    "deployment",
    "evidence",
    "github",
    "hotspot",
    "json",
    "markdown",
    "output",
    "package",
    "qa",
    "release",
    "report",
    "reports",
    "sarif",
    "risk",
    "risks",
    "role",
    "security",
    "severity",
    "test",
    "workflow",
    "workflows"
  ],
  actionNamedCommand: ["find"],
  lowSignal: [
    "add",
    "bug",
    "change",
    "changes",
    "command",
    "commands",
    "defect",
    "find",
    "fix",
    "for",
    "improve",
    "inspect",
    "investigate",
    "issue",
    "issues",
    "possible",
    "potential",
    "related",
    "repair",
    "review",
    "search",
    "make",
    "task",
    "update",
    "instructions",
    "guardian",
    "hardening",
    "phase",
    "prepare",
    "project",
    "release",
    "bul",
    "ilgili",
    "ihtimal",
    "ihtimalleri",
    "incele"
  ],
  codeInvestigation: [
    "bug",
    "issue",
    "fix",
    "debug",
    "investigate",
    "find",
    "risk",
    "refactor",
    "ihtimal",
    "ihtimalleri",
    "hata",
    "bul",
    "incele",
    "duzelt",
    "düzelt",
    "ilgili"
  ],
  roleRelated: [
    "role",
    "roles",
    "classify",
    "classification",
    "repofileclassifier",
    "permission",
    "permissions",
    "auth",
    "authorization"
  ]
};

const expansions = {
  turkish: new Map<string, string[]>([
    ["rol", ["role", "roles"]],
    ["roller", ["role", "roles"]],
    ["role", ["role", "roles"]],
    ["yetki", ["permission", "permissions", "auth", "authorization"]],
    ["izin", ["permission", "permissions"]],
    ["hata", ["bug", "issue", "defect"]],
    ["bug", ["bug", "issue", "defect"]],
    ["ihtimal", ["risk", "possible", "potential"]],
    ["ihtimalleri", ["risk", "possible", "potential"]],
    ["bul", ["find", "search", "investigate"]],
    ["incele", ["inspect", "review", "investigate"]],
    ["duzelt", ["fix", "repair"]],
    ["düzelt", ["fix", "repair"]],
    ["goster", ["show"]],
    ["göster", ["show"]],
    ["iyilestir", ["improve"]],
    ["iyileştir", ["improve"]],
    ["ilgili", ["related"]],
    ["tasklari", ["task", "tasks"]],
    ["turkce", ["turkish"]],
    ["yonlendirme", ["routing", "route"]]
  ]),
  domain: new Map<string, string[]>([
    ["action", ["actions", "github", "workflow", "workflows"]],
    ["actions", ["github", "workflow", "workflows"]],
    ["ci", ["github", "workflow", "workflows"]],
    ["deploy", ["deployment"]],
    ["deployment", ["deploy"]],
    ["github", ["actions", "workflow", "workflows"]],
    ["hotspot", ["risk", "risks"]],
    ["markdown", ["report", "reports", "output"]],
    ["qa", ["evidence", "test", "analyzer"]],
    ["report", ["reports", "output"]],
    ["reports", ["report", "output"]],
    ["risk", ["risks", "hotspot"]],
    ["risks", ["risk", "hotspot"]],
    ["sarif", ["report", "reports", "output"]],
    ["severity", ["decision", "decisions"]],
    ["workflow", ["workflows"]],
    ["workflows", ["workflow"]]
  ])
};

const actionTerms = new Set(termRegistry.action);
const domainTerms = new Set(termRegistry.domain);
const actionNamedCommandTerms = new Set(termRegistry.actionNamedCommand);
const lowSignalTerms = new Set(termRegistry.lowSignal);
const codeInvestigationTerms = new Set(termRegistry.codeInvestigation);
const roleRelatedTerms = new Set(termRegistry.roleRelated);
const explicitCommandTaskTerms = new Set(["cli", "command", "commands", "rcc"]);
const genericLookupStopTerms = new Set([
  "add",
  "change",
  "command",
  "commands",
  "continue",
  "create",
  "fix",
  "handle",
  "implement",
  "implementation",
  "improve",
  "make",
  "modify",
  "real",
  "refactor",
  "repo",
  "support",
  "test",
  "update"
]);
const routingImplementationTerms = new Set([
  "classification",
  "intent",
  "route",
  "routes",
  "routing",
  "task",
  "tasks",
  "tokenization",
  "turkce",
  "turkish",
  "yonlendirme"
]);
const workflowDomainTerms = new Set([
  "action",
  "actions",
  "ci",
  "deploy",
  "deployment",
  "github",
  "release",
  "workflow",
  "workflows"
]);
const outputContractTerms = new Set([
  "analyzer",
  "contract",
  "contracts",
  "decision",
  "decisions",
  "evidence",
  "json",
  "markdown",
  "qa",
  "report",
  "reports",
  "sarif",
  "severity"
]);
const documentationTerms = new Set([
  "copy",
  "docs",
  "documentation",
  "example",
  "examples",
  "explain",
  "guide",
  "positioning",
  "quick",
  "readme",
  "usage"
]);
const releaseIntentTerms = new Set([
  "changelog",
  "deploy",
  "deployment",
  "npm",
  "package",
  "publish",
  "release",
  "tag"
]);
const ciWorkflowIntentTerms = new Set([
  "action",
  "actions",
  "ci",
  "github",
  "risk",
  "risks"
]);

export function analyzeTaskIntent(task: string): TaskIntentAnalysis {
  const filenameTerms = task
    .toLowerCase()
    .match(/\b[a-z0-9_-]+\.[a-z0-9][a-z0-9._-]*\b/g) ?? [];
  const normalizedTask = normalizeTaskText(task);
  const rawTokens = tokenize(normalizedTask);
  const expandedTerms = expandTaskTerms(rawTokens);
  const hasDocumentationIntent = detectsDocumentationIntent(normalizedTask, expandedTerms);
  const hasReleaseIntent = detectsReleaseIntent(normalizedTask, expandedTerms);
  const hasRoutingImplementationIntent = detectsRoutingImplementationIntent(normalizedTask, expandedTerms);
  const hasCiWorkflowIntent = !hasRoutingImplementationIntent
    && detectsCiWorkflowIntent(normalizedTask, expandedTerms, hasDocumentationIntent);
  const hasRoleSignal = expandedTerms.some((term) => term === "role" || term === "roles");
  const isExplicitCommandTask = expandedTerms.some((term) => explicitCommandTaskTerms.has(term));
  const termsForLookup = hasRoleSignal
    ? expandedTerms.filter((term) => term !== "risk")
    : expandedTerms;
  const lookupCandidates = [...new Set([
    ...filenameTerms,
    ...termsForLookup
      .filter((token) => token.length > 2 || domainTerms.has(token))
      .filter((token) => (
        isExplicitCommandTask
          ? !actionTerms.has(token) || actionNamedCommandTerms.has(token)
          : (!lowSignalTerms.has(token) && !actionTerms.has(token))
      ))
      .filter((token) => !isExplicitCommandTask || !explicitCommandTaskTerms.has(token))
  ])];
  const genericFallbackTerms = [...new Set(termsForLookup
    .filter((token) => token.length > 2 || domainTerms.has(token))
    .filter((token) => genericLookupStopTerms.has(token))
    .filter((token) => !isExplicitCommandTask || !explicitCommandTaskTerms.has(token)))];
  const rawLookupTokens = rawTokens.filter((token) => token.length > 2 || domainTerms.has(token));
  const shouldFallbackToGenericTerms = rawLookupTokens.length > 0
    && rawLookupTokens.every((token) => genericLookupStopTerms.has(token));
  const routingPrioritizedTerms = prioritizeRoutingImplementationTerms(filterGenericLookupTerms(
    lookupCandidates,
    shouldFallbackToGenericTerms ? genericFallbackTerms : []
  ), hasRoutingImplementationIntent);
  const commandPrioritizedTerms = isExplicitCommandTask
    ? prioritizeExplicitCommandContextTerms(routingPrioritizedTerms)
    : routingPrioritizedTerms;
  const lookupTerms = shouldPrioritizeOutputContractTerms(commandPrioritizedTerms)
    ? prioritizeOutputContractTerms(commandPrioritizedTerms)
    : commandPrioritizedTerms;

  return {
    normalizedTask,
    rawTokens,
    expandedTerms,
    lookupTerms,
    domainTerms: expandedTerms.filter((term) => domainTerms.has(term)),
    actionTerms: expandedTerms.filter((term) => actionTerms.has(term)),
    lowSignalTerms: expandedTerms.filter((term) => lowSignalTerms.has(term)),
    isCodeInvestigation: expandedTerms.some((term) => codeInvestigationTerms.has(term)),
    hasWorkflowDomain: expandedTerms.some((term) => workflowDomainTerms.has(term)),
    hasCiWorkflowIntent,
    hasRoutingImplementationIntent,
    hasDocumentationIntent,
    hasReleaseIntent,
    isExplicitCommandTask,
    nextLookupKeyword: lookupTerms[0] ?? null
  };
}

export function termWeight(term: string): number {
  if (actionNamedCommandTerms.has(term)) {
    return 1;
  }
  if (actionTerms.has(term)) {
    return 0.25;
  }
  if (outputContractTerms.has(term)) {
    return 1.55;
  }
  if (domainTerms.has(term)) {
    return 1.35;
  }
  return 1;
}

export function weightedScore(score: number, term: string): number {
  return Math.round(score * termWeight(term));
}

function normalizeTaskText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\btasklar[iı]?\b/g, "tasklari")
    .replace(/\bt[uü]rk[cç]e\b/g, "turkce")
    .replace(/\by[oö]nlendirme(?:yi|si|sini|de|den|ye|e)?\b/g, "yonlendirme")
    .replace(/\brole\s+ler(?:le|i|in|den|de|e|a)?\b/g, "role")
    .replace(/\broller(?:le|i|in|den|de|e|a)?\b/g, "rol")
    .replace(/\broll?erle\b/g, "rol")
    .replace(/\bhatalar[iı]?\b/g, "hata")
    .replace(/\bhata(?:lar)?[iı]?\b/g, "hata")
    .replace(/\bihtimaller(?:i|ini|in|le|den)?\b/g, "ihtimalleri")
    .replace(/\bd[uü]zelt(?:mek|me|in|elim)?\b/g, "duzelt");
}

function detectsDocumentationIntent(normalizedTask: string, terms: string[]): boolean {
  return terms.some((term) => documentationTerms.has(term))
    || /\bquick\s+start\b/.test(normalizedTask)
    || /\bupdate\s+readme\b/.test(normalizedTask);
}

function detectsReleaseIntent(normalizedTask: string, terms: string[]): boolean {
  return terms.some((term) => releaseIntentTerms.has(term))
    || /\bversion\s+bump\b/.test(normalizedTask)
    || /\bci\s+release\b/.test(normalizedTask);
}

function detectsRoutingImplementationIntent(normalizedTask: string, terms: string[]): boolean {
  const hasRoutingLogicTerm = terms.some((term) => [
    "classification",
    "intent",
    "route",
    "routes",
    "routing",
    "tokenization",
    "yonlendirme"
  ].includes(term));
  const hasImplementationContext = terms.some((term) => [
    "rcc",
    "task",
    "tasks",
    "turkce",
    "turkish",
    "yonlendirme"
  ].includes(term))
    || /\btask\s+routing\b/.test(normalizedTask)
    || /\brcc\b/.test(normalizedTask);

  return hasRoutingLogicTerm && hasImplementationContext;
}

function detectsCiWorkflowIntent(normalizedTask: string, terms: string[], hasDocumentationIntent: boolean): boolean {
  if (hasDocumentationIntent && /\b(?:readme|docs?|documentation|guide|usage|agent|user)\s+workflow\b/.test(normalizedTask)) {
    return false;
  }

  return /\bgithub\s+actions?\b/.test(normalizedTask)
    || /\bci\s+workflow\b/.test(normalizedTask)
    || /\bworkflow\s+ya?ml\b/.test(normalizedTask)
    || /\.github\/workflows\b/.test(normalizedTask)
    || /\baction\s+failure\b/.test(normalizedTask)
    || /\brelease\s+workflow\b/.test(normalizedTask)
    || (terms.includes("workflow") && terms.some((term) => ciWorkflowIntentTerms.has(term)));
}

function tokenize(value: string): string[] {
  return [...new Set(value
    .toLowerCase()
    .replace(/türkçe/g, "turkce")
    .replace(/yönlendirme/g, "yonlendirme")
    .replace(/düzelt/g, "duzelt")
    .replace(/göster/g, "goster")
    .replace(/iyileştir/g, "iyilestir")
    .split(/[^a-z0-9_-]+/)
    .filter((token) => token.length > 1))];
}

function expandTaskTerms(terms: string[]): string[] {
  const expanded: string[] = [];

  for (const term of terms) {
    expanded.push(term);
    for (const expansion of expansions.turkish.get(term) ?? []) {
      expanded.push(expansion);
    }
    for (const expansion of expansions.domain.get(term) ?? []) {
      expanded.push(expansion);
    }
  }

  if (expanded.some((term) => term === "role" || term === "roles")) {
    expanded.push(...roleRelatedTerms);
  }

  return [...new Set(expanded)];
}

function filterGenericLookupTerms(terms: string[], genericFallbackTerms: string[]): string[] {
  const meaningfulTerms = terms.filter((term) => !genericLookupStopTerms.has(term));

  if (meaningfulTerms.length > 0) {
    return meaningfulTerms;
  }

  return terms.length > 0 ? terms : genericFallbackTerms;
}

function prioritizeRoutingImplementationTerms(terms: string[], enabled: boolean): string[] {
  if (!enabled) {
    return terms;
  }

  const priority = ["routing", "intent", "route", "routes", "tokenization", "classification", "turkish", "turkce", "task", "tasks", "yonlendirme"];
  const implementationTerms = priority.filter((term) => terms.includes(term));
  const remainingTerms = terms.filter((term) => !routingImplementationTerms.has(term));

  return [...new Set([...implementationTerms, ...remainingTerms])];
}

function prioritizeOutputContractTerms(terms: string[]): string[] {
  const priority = [
    "qa",
    "evidence",
    "json",
    "markdown",
    "sarif",
    "report",
    "reports",
    "analyzer",
    "severity",
    "decision",
    "decisions",
    "contract",
    "contracts"
  ];
  const outputTerms = priority.filter((term) => terms.includes(term));
  const remainingTerms = terms.filter((term) => !outputContractTerms.has(term));

  return [...new Set([...outputTerms, ...remainingTerms])];
}

function shouldPrioritizeOutputContractTerms(terms: string[]): boolean {
  return terms.some((term) => [
    "contract",
    "contracts",
    "evidence",
    "markdown",
    "qa",
    "report",
    "reports",
    "sarif",
    "severity"
  ].includes(term));
}

function prioritizeExplicitCommandContextTerms(terms: string[]): string[] {
  const outputTerms = new Set(["json", "output"]);
  const commandContextTerms = terms.filter((term) => !outputTerms.has(term));
  const remainingTerms = terms.filter((term) => outputTerms.has(term));

  return [...new Set([...commandContextTerms, ...remainingTerms])];
}
