export type TaskSize = "tiny" | "small" | "medium" | "large";

export type TaskMode = "fast_fix" | "normal" | "deep";

export interface TaskSizeClassification {
  size: TaskSize;
  mode: TaskMode;
  confidence: "low" | "medium" | "high";
  reasons: string[];
}

interface RuleMatch {
  label: string;
  pattern: RegExp;
}

const tinyRules: RuleMatch[] = [
  { label: "typo", pattern: /\btypos?\b/ },
  { label: "spelling", pattern: /\bspell(?:ing)?\b/ },
  { label: "spacing", pattern: /\bspacing\b/ },
  { label: "wording", pattern: /\bwording\b/ },
  { label: "README", pattern: /\breadme\b/ },
  { label: "CHANGELOG", pattern: /\bchangelogs?\b/ },
  { label: "docs", pattern: /\bdocs?\b|\bdocumentation\b/ },
  { label: "comment", pattern: /\bcomments?\b/ },
  { label: "label", pattern: /\blabels?\b/ },
  { label: "copy", pattern: /\bcopy\b/ },
  { label: "translation wording", pattern: /\btranslation\s+wording\b/ },
  { label: "rename label", pattern: /\brename\s+(?:a\s+|the\s+)?labels?\b/ },
  { label: "fix text", pattern: /\bfix\s+(?:the\s+)?text\b/ },
  { label: "one-line output issue", pattern: /\bone[\s-]line\s+output\s+(?:issue|bug|fix)\b/ }
];

const smallRules: RuleMatch[] = [
  { label: "single bug", pattern: /\bsingle\s+bugs?\b/ },
  { label: "single bug", pattern: /\bfix\b.*\bbugs?\b|\bbugs?\b.*\bfix\b/ },
  { label: "small bug", pattern: /\bsmall\s+(?:cli\s+)?bugs?\b/ },
  { label: "small test update", pattern: /\bsmall\s+tests?\s+updates?\b/ },
  { label: "small CLI output fix", pattern: /\bsmall\s+cli\s+output\s+fix\b/ },
  { label: "CLI bug", pattern: /\bcli\s+bugs?\b/ },
  { label: "one command behavior adjustment", pattern: /\bone\s+command\s+behavior\s+adjustment\b/ }
];

const mediumRules: RuleMatch[] = [
  { label: "new flag", pattern: /\bnew\s+flags?\b/ },
  { label: "command behavior", pattern: /\bcommand\s+behavior\b/ },
  { label: "JSON output", pattern: /\bjson\s+output\b/ },
  { label: "parser improvement", pattern: /\bparser\s+improvements?\b/ },
  { label: "test coverage update", pattern: /\btest\s+coverage\s+updates?\b/ }
];

const largeRules: RuleMatch[] = [
  { label: "architecture", pattern: /\barchitecture\b/ },
  { label: "refactor", pattern: /\brefactors?\b|\brefactoring\b/ },
  { label: "memory system", pattern: /\bmemory\s+system\b/ },
  { label: "learning system", pattern: /\blearning\s+system\b/ },
  { label: "handoff architecture", pattern: /\bhandoff\s+architecture\b/ },
  { label: "repository-wide behavior", pattern: /\brepository[\s-]wide\s+behavior\b/ },
  { label: "performance model", pattern: /\bperformance\s+model\b/ }
];

const tinyDowngradeBlockers: RuleMatch[] = [
  { label: "refactor", pattern: /\brefactors?\b|\brefactoring\b/ },
  { label: "implement", pattern: /\bimplement(?:s|ed|ing)?\b/ },
  { label: "feature", pattern: /\badd\s+(?:a\s+|an\s+|the\s+)?features?\b|\bfeatures?\b/ },
  { label: "migrate", pattern: /\bmigrat(?:e|es|ed|ing|ion)\b/ },
  { label: "auth flow", pattern: /\bauth\s+flow\b/ },
  { label: "database schema", pattern: /\bdatabase\s+schema\b|\bdb\s+schema\b/ },
  { label: "workflow behavior", pattern: /\bworkflow\s+behaviou?r\b/ },
  { label: "API endpoint", pattern: /\bapi\s+endpoints?\b/ },
  { label: "security", pattern: /\bsecurity\b/ },
  { label: "middleware", pattern: /\bmiddleware\b/ }
];

function normalizeTask(task: string): string {
  return task.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchingReasons(task: string, rules: RuleMatch[]): string[] {
  return rules
    .filter((rule) => rule.pattern.test(task))
    .map((rule) => rule.label);
}

function result(
  size: TaskSize,
  confidence: TaskSizeClassification["confidence"],
  reasons: string[]
): TaskSizeClassification {
  const mode: TaskMode = size === "large" ? "deep" : size === "medium" ? "normal" : "fast_fix";

  return {
    size,
    mode,
    confidence,
    reasons
  };
}

export function classifyTaskSize(task: string): TaskSizeClassification {
  const normalizedTask = normalizeTask(task);

  if (!normalizedTask) {
    return result("medium", "low", ["empty task"]);
  }

  const largeReasons = matchingReasons(normalizedTask, largeRules);
  if (largeReasons.length > 0) {
    return result("large", largeReasons.length > 1 ? "high" : "medium", largeReasons);
  }

  const tinyReasons = matchingReasons(normalizedTask, tinyRules);
  const tinyBlockers = matchingReasons(normalizedTask, tinyDowngradeBlockers);
  const mediumReasons = matchingReasons(normalizedTask, mediumRules);
  const smallReasons = matchingReasons(normalizedTask, smallRules);

  if (tinyReasons.length > 0 && tinyBlockers.length === 0 && mediumReasons.length === 0 && smallReasons.length === 0) {
    return result("tiny", "high", tinyReasons);
  }

  if (mediumReasons.length > 0) {
    return result("medium", mediumReasons.length > 1 ? "high" : "medium", mediumReasons);
  }

  if (smallReasons.length > 0) {
    return result("small", smallReasons.length > 1 ? "high" : "medium", smallReasons);
  }

  if (tinyReasons.length > 0 && tinyBlockers.length === 0) {
    return result("tiny", "medium", tinyReasons);
  }

  return result("medium", "low", ["unclear task size"]);
}
