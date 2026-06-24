import { classifyRepoFile } from "./repoFileClassifier";

export type LearningSignal = "high" | "medium" | "low";

export interface LearningCandidate {
  files?: string[];
  summary: string;
  verification?: string[];
}

export interface LearningQualityEvaluation {
  confidence: number;
  reasons: string[];
  score: number;
  shouldLearn: boolean;
  signal: LearningSignal;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

function boundedScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function uniqueMeaningfulFiles(files: string[] = []): string[] {
  return [...new Set(files.map(normalizeRepoPath).filter(Boolean))]
    .filter((file) => {
      const role = classifyRepoFile(file).role;
      return role !== "generated" && role !== "asset" && role !== "fixture" && role !== "snapshot";
    });
}

const highValuePatterns = [
  /\barchitect(?:ure|ural)?\b/,
  /\bdecoupl(?:e|ed|ing)\b/,
  /\bmodulari[sz](?:e|ed|ing)\b/,
  /\brouting\b|\broute\b/,
  /\bbenchmark\b/,
  /\brelease\b.*\b(?:guard|safety|verification|check|gate|process)\b/,
  /\b(?:guard|safety|gate)\b.*\brelease\b/,
  /\bworkflow\b.*\b(?:convention|verification|process|guard|rule)\b/,
  /\bverification\b.*\b(?:rule|process|guard|pattern)\b/,
  /\b(?:repository|repo)-?wide\b|\bcross[- ]repo\b/,
  /\brecurring\b.*\b(?:troubleshooting|knowledge|pattern)\b/,
  /\bhandoff\b.*\bmemory\b|\bmemory\b.*\bhandoff\b/,
  /\blearning\b.*\b(?:quality|guard|evaluation|signal|filter)\b/
];

const mediumValuePatterns = [
  /\bimplement(?:ed|ing)?\b/,
  /\badd(?:ed|ing)?\b/,
  /\bimprov(?:e|ed|ing)\b/,
  /\brefactor(?:ed|ing)?\b/,
  /\bparser\b/,
  /\bmemory\b/,
  /\bapi\b/,
  /\bbehavior\b/,
  /\btest(?:s|ing)?\b/
];

const lowValuePatterns = [
  /\btypo\b|\bspelling\b/,
  /\bspacing\b|\bformatting\b|\bformat\b/,
  /\bcomment\b.*\b(?:wording|text|copy)\b|\b(?:wording|copy)\b.*\bcomment\b/,
  /\breadme\b.*\b(?:wording|copy|text|typo)\b/,
  /\b(?:wording|copy|text)\b.*\breadme\b/,
  /\brename(?:d|s)?\b.*\bvariable\b/,
  /\badjust(?:ed|s|ing)?\b.*\bspacing\b/,
  /\bfixed?\s+(?:a\s+)?typo\b/,
  /\bone[- ]off\b.*\b(?:cleanup|maintenance)\b/,
  /\bcleanup\b|\bcosmetic\b/
];

export function learningDuplicateKey(summary: string): string {
  return normalizeText(summary)
    .replace(/\b(?:fix|fixed|fixing|updated?|adjusted?|changed|tweaked)\b/g, "")
    .replace(/\b(?:a|an|the|to|in|for|of|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function evaluateLearningQuality(candidate: LearningCandidate): LearningQualityEvaluation {
  const summary = normalizeText(candidate.summary);
  const files = uniqueMeaningfulFiles(candidate.files);
  const verification = candidate.verification?.filter((item) => item.trim()) ?? [];
  const roles = new Set(files.map((file) => classifyRepoFile(file).role));
  const reasons: string[] = [];
  let score = 0.35;

  if (hasAny(summary, lowValuePatterns)) {
    score -= 0.35;
    reasons.push("low-value summary wording");
  }
  if (hasAny(summary, mediumValuePatterns)) {
    score += 0.2;
    reasons.push("implementation or behavior signal");
  }
  if (hasAny(summary, highValuePatterns)) {
    score += 0.45;
    reasons.push("repository-level learning signal");
  }
  if (files.length >= 2) {
    score += 0.12;
    reasons.push("multiple meaningful files");
  }
  if (roles.has("source") && roles.has("test")) {
    score += 0.14;
    reasons.push("source and test changed together");
  }
  if (verification.length > 0) {
    score += 0.1;
    reasons.push("verification recorded");
  }
  if (files.length === 0 && verification.length === 0) {
    score -= 0.08;
    reasons.push("no file or verification evidence");
  }

  const bounded = boundedScore(score);
  const signal: LearningSignal = bounded >= 0.78 ? "high" : bounded >= 0.5 ? "medium" : "low";

  return {
    confidence: signal === "high" ? Math.max(0.85, bounded) : signal === "medium" ? Math.max(0.68, bounded) : Math.max(0.7, 1 - bounded),
    reasons: reasons.length > 0 ? reasons : ["general completed work signal"],
    score: bounded,
    shouldLearn: signal !== "low",
    signal
  };
}
