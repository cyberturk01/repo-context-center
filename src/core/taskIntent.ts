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
    "deploy",
    "deployment",
    "github",
    "hotspot",
    "package",
    "release",
    "risk",
    "risks",
    "role",
    "security",
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
    ["ilgili", ["related"]]
  ]),
  domain: new Map<string, string[]>([
    ["action", ["actions", "github", "workflow", "workflows"]],
    ["actions", ["github", "workflow", "workflows"]],
    ["ci", ["github", "workflow", "workflows"]],
    ["deploy", ["deployment"]],
    ["deployment", ["deploy"]],
    ["github", ["actions", "workflow", "workflows"]],
    ["hotspot", ["risk", "risks"]],
    ["release", ["workflow", "workflows"]],
    ["risk", ["risks", "hotspot"]],
    ["risks", ["risk", "hotspot"]],
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

export function analyzeTaskIntent(task: string): TaskIntentAnalysis {
  const filenameTerms = task
    .toLowerCase()
    .match(/\b[a-z0-9_-]+\.[a-z0-9][a-z0-9._-]*\b/g) ?? [];
  const normalizedTask = normalizeTaskText(task);
  const rawTokens = tokenize(normalizedTask);
  const expandedTerms = expandTaskTerms(rawTokens);
  const hasRoleSignal = expandedTerms.some((term) => term === "role" || term === "roles");
  const isExplicitCommandTask = expandedTerms.some((term) => explicitCommandTaskTerms.has(term));
  const termsForLookup = hasRoleSignal
    ? expandedTerms.filter((term) => term !== "risk")
    : expandedTerms;
  const lookupTerms = [...new Set([
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
    .replace(/\brole\s+ler(?:le|i|in|den|de|e|a)?\b/g, "role")
    .replace(/\broller(?:le|i|in|den|de|e|a)?\b/g, "rol")
    .replace(/\broll?erle\b/g, "rol")
    .replace(/\bhatalar[iı]?\b/g, "hata")
    .replace(/\bhata(?:lar)?[iı]?\b/g, "hata")
    .replace(/\bihtimaller(?:i|ini|in|le|den)?\b/g, "ihtimalleri")
    .replace(/\bd[uü]zelt(?:mek|me|in|elim)?\b/g, "duzelt");
}

function tokenize(value: string): string[] {
  return [...new Set(value
    .toLowerCase()
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
