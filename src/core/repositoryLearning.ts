import path from "node:path";
import { pathExists, readTextFile } from "./fileSystem";
import { evaluateLearningQuality } from "./learningQuality";
import { classifyRepoFile } from "./repoFileClassifier";
import { parseWorkMemoryEntries, type WorkMemoryEntry } from "./workMemory";

export interface RepositoryLearningRelationship {
  source: string;
  related: string;
  reason: string;
  count: number;
}

export interface RepositoryLearningModifiedTogether {
  files: string[];
  count: number;
  recentSummary: string | null;
}

export interface RepositoryLearningVerificationPattern {
  scope: string;
  command: string;
  count: number;
}

export interface RepositoryLearningModel {
  recentFocusAreas: string[];
  commonFileRelationships: RepositoryLearningRelationship[];
  frequentlyModifiedTogether: RepositoryLearningModifiedTogether[];
  verificationPatterns: RepositoryLearningVerificationPattern[];
  repositoryHabits: string[];
}

export interface RepositoryLearningSources {
  decisions?: string;
  workIndex?: string;
  workLog?: string;
}

export interface RepositoryLearningBuildOptions {
  includeLowSignal?: boolean;
}

export const repositoryLearningLimits = {
  recentFocusAreas: 5,
  commonFileRelationships: 8,
  frequentlyModifiedTogether: 8,
  verificationPatterns: 8,
  repositoryHabits: 6
} as const;
const workLogPath = "docs/ai-context/WORK_LOG.md";
const workIndexPath = "docs/ai-context/WORK_INDEX.md";
const decisionsPath = "docs/ai-context/DECISIONS.md";
const ignoredContextFiles = new Set([
  "docs/ai-context/WORK_LOG.md",
  "docs/ai-context/WORK_INDEX.md",
  "docs/ai-context/REPOSITORY_LEARNING.md"
]);

function cleanInline(value: string, maxLength = 180): string {
  const cleaned = value.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}...` : cleaned;
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

function isMeaningfulMemoryFile(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath);
  if (!normalized || ignoredContextFiles.has(normalized) || normalized.startsWith("docs/ai-context/archive/")) {
    return false;
  }

  const info = classifyRepoFile(normalized);
  return info.role !== "generated"
    && info.role !== "asset"
    && info.role !== "fixture"
    && info.role !== "snapshot";
}

function filteredFiles(files: string[]): string[] {
  return [...new Set(files.map(normalizeRepoPath).filter(isMeaningfulMemoryFile))]
    .sort((left, right) => left.localeCompare(right));
}

function fallbackScopeFromPath(filePath: string): string {
  const normalized = normalizeRepoPath(filePath);
  const basename = normalized.split("/").pop() ?? normalized;
  const stem = basename.replace(/\.(test|spec)\.[^.]+$/i, "").replace(/\.[^.]+$/i, "");
  const parent = normalized.split("/").slice(-2, -1)[0];
  return cleanInline(stem || parent || normalized, 40).toLowerCase();
}

function scopeForEntry(entry: WorkMemoryEntry): string {
  const haystack = `${entry.summary} ${entry.files.join(" ")}`.toLowerCase();

  if (/\bhandoff\b|handoff\//.test(haystack)) {
    return "handoff";
  }
  if (/\barchive\b|archiver|archive\.test/.test(haystack)) {
    return "archive";
  }
  if (/\bdone\b|commands\/done|done\.test/.test(haystack)) {
    return "done";
  }
  if (/\bwork\b|commands\/work|work\.test|cli\/work\//.test(haystack)) {
    return "work";
  }
  if (/\bdecision\b|decisions\.md/.test(haystack)) {
    return "decision";
  }
  if (/\barchive\b|work index|work log|memory/.test(haystack)) {
    return "work memory";
  }
  if (/\btemplate\b|agents\.md|agent startup|guidance/.test(haystack)) {
    return "agent guidance";
  }
  if (/\bmeasure\b|token|benchmark/.test(haystack)) {
    return "measurement";
  }
  if (/\bmap\b|repository|scan|context/.test(haystack)) {
    return "repository context";
  }
  if (/\binit\b|doctor\b|cli\b|command\b/.test(haystack)) {
    return "cli";
  }
  if (/\btest\b|coverage\b/.test(haystack)) {
    return "tests";
  }

  const firstFile = filteredFiles(entry.files)[0];
  return firstFile ? fallbackScopeFromPath(firstFile) : "general maintenance";
}

function relationshipReason(source: string): string {
  if (source === "work") {
    return "Observed in completed work tasks";
  }
  if (source === "handoff" || source === "archive" || source === "done") {
    return `Observed in completed ${source} work`;
  }
  return `Observed in completed ${source} work`;
}

function increment<K>(map: Map<K, number>, key: K, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedRepeatedEntries<T, I extends { count: number; latest: string; summary: string | null }>(
  entries: Array<[T, I]>
): Array<[T, I]> {
  const repeated = entries.filter(([, info]) => info.count > 1);
  const ranked = repeated.length > 0 ? repeated : entries;
  return ranked.sort((left, right) => (
    right[1].count - left[1].count
    || right[1].latest.localeCompare(left[1].latest)
    || String(left[0]).localeCompare(String(right[0]))
  ));
}

function recentFocusAreas(entries: WorkMemoryEntry[]): string[] {
  const scopes = new Map<string, { count: number; latest: string }>();

  for (const entry of entries) {
    const scope = scopeForEntry(entry);
    const current = scopes.get(scope) ?? { count: 0, latest: entry.timestamp };
    current.count += 1;
    if (entry.timestamp > current.latest) {
      current.latest = entry.timestamp;
    }
    scopes.set(scope, current);
  }

  return [...scopes.entries()]
    .sort((left, right) => right[1].count - left[1].count || right[1].latest.localeCompare(left[1].latest))
    .slice(0, repositoryLearningLimits.recentFocusAreas)
    .map(([scope, info]) => `${scope} (${info.count})`);
}

function commonFileRelationships(entries: WorkMemoryEntry[]): RepositoryLearningRelationship[] {
  const relationships = new Map<string, { source: string; related: string; count: number; latest: string }>();

  for (const entry of entries) {
    const source = scopeForEntry(entry);
    for (const file of filteredFiles(entry.files)) {
      const key = `${source}\0${file}`;
      const current = relationships.get(key) ?? { source, related: file, count: 0, latest: entry.timestamp };
      current.count += 1;
      if (entry.timestamp > current.latest) {
        current.latest = entry.timestamp;
      }
      relationships.set(key, current);
    }
  }

  const rows = [...relationships.values()];
  const repeated = rows.filter((row) => row.count > 1);
  return (repeated.length > 0 ? repeated : rows)
    .sort((left, right) => right.count - left.count || right.latest.localeCompare(left.latest) || left.related.localeCompare(right.related))
    .slice(0, repositoryLearningLimits.commonFileRelationships)
    .map(({ source, related, count }) => ({
      source,
      related,
      reason: relationshipReason(source),
      count
    }));
}

function frequentlyModifiedTogether(entries: WorkMemoryEntry[]): RepositoryLearningModifiedTogether[] {
  const pairs = new Map<string, { count: number; files: string[]; latest: string; summary: string | null }>();

  for (const entry of entries) {
    const files = filteredFiles(entry.files).slice(0, 10);
    for (let index = 0; index < files.length; index += 1) {
      for (let next = index + 1; next < files.length; next += 1) {
        const pairFiles = [files[index], files[next]].sort((left, right) => left.localeCompare(right));
        const key = pairFiles.join("\0");
        const current = pairs.get(key) ?? {
          count: 0,
          files: pairFiles,
          latest: entry.timestamp,
          summary: cleanInline(entry.summary, 140)
        };
        current.count += 1;
        if (entry.timestamp > current.latest) {
          current.latest = entry.timestamp;
          current.summary = entry.summary;
        }
        pairs.set(key, current);
      }
    }
  }

  return sortedRepeatedEntries([...pairs.entries()].map(([, value]) => [value.files.join("\0"), value]))
    .filter(([, info]) => info.count > 1)
    .slice(0, repositoryLearningLimits.frequentlyModifiedTogether)
    .map(([, info]) => ({
      files: info.files,
      count: info.count,
      recentSummary: info.summary ? cleanInline(info.summary, 140) : null
    }));
}

function scopeForVerification(command: string): string {
  const testPath = command.match(/\btests\/([A-Za-z0-9_.-]+)\.test\.[jt]s\b/)?.[1];
  if (testPath) {
    return testPath.replace(/[-_.]+/g, " ").trim().toLowerCase();
  }
  if (/\bnpm\s+(?:run\s+)?test\b|\bnode\s+--test\b/.test(command)) {
    return "tests";
  }
  if (/\bnpm\s+run\s+build\b|\btsc\b/.test(command)) {
    return "build";
  }
  if (/\bbenchmark\b/.test(command)) {
    return "benchmark";
  }
  return "general";
}

function verificationPatterns(entries: WorkMemoryEntry[]): RepositoryLearningVerificationPattern[] {
  const counts = new Map<string, { scope: string; command: string; count: number }>();

  for (const entry of entries) {
    for (const verification of entry.verification) {
      for (const part of verification.split(";")) {
        const command = cleanInline(part, 140).replace(/`/g, "");
        if (!command) {
          continue;
        }
        const scope = scopeForVerification(command);
        const key = `${scope}\0${command}`;
        const current = counts.get(key) ?? { scope, command, count: 0 };
        current.count += 1;
        counts.set(key, current);
      }
    }
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.scope.localeCompare(right.scope) || left.command.localeCompare(right.command))
    .slice(0, repositoryLearningLimits.verificationPatterns);
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [];
  }

  const cells: string[] = [];
  let cell = "";
  const inner = trimmed.slice(1, -1);

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === "|" && inner[index - 1] !== "\\") {
      cells.push(cell.replace(/\\\|/g, "|").replace(/`/g, "").trim());
      cell = "";
      continue;
    }
    cell += char;
  }

  cells.push(cell.replace(/\\\|/g, "|").replace(/`/g, "").trim());
  return cells;
}

function decisionRows(content: string | undefined): string[][] {
  if (!content) {
    return [];
  }

  return content
    .split(/\r?\n/)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length === 5 && cells[0] !== "Date" && !cells.every((cell) => /^-+$/.test(cell)));
}

function workIndexFallbackEntries(content: string | undefined): WorkMemoryEntry[] {
  if (!content) {
    return [];
  }

  const entries: WorkMemoryEntry[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) {
      continue;
    }
    const cells = splitMarkdownTableRow(line);
    if (cells.length < 3 || cells[0] === "File" || cells[0] === "Theme" || cells.every((cell) => /^-+$/.test(cell))) {
      continue;
    }
    if (cells[0] && cells[0] !== "_none_" && isMeaningfulMemoryFile(cells[0])) {
      entries.push({
        files: [cells[0]],
        followUps: [],
        risks: [],
        summary: cells[1] || "Work index entry",
        timestamp: cells[2] || "0000-00-00",
        verification: []
      });
    }
  }

  return entries;
}

function workLogEntries(content: string | undefined): WorkMemoryEntry[] {
  return content ? parseWorkMemoryEntries(content) : [];
}

function repositoryHabits(entries: WorkMemoryEntry[], decisions: string[][]): string[] {
  const habits: string[] = [];
  const withFiles = entries.filter((entry) => filteredFiles(entry.files).length > 0).length;
  const withVerification = entries.filter((entry) => entry.verification.length > 0).length;
  const withFollowUps = entries.filter((entry) => entry.followUps.length > 0).length;
  const changedTests = entries.filter((entry) => filteredFiles(entry.files).some((file) => classifyRepoFile(file).role === "test")).length;
  const activeDecisions = decisions.filter((cells) => /^active$/i.test(cells[3] ?? "")).length;

  if (withFiles > 0) {
    habits.push(`Completed work records meaningful changed files (${withFiles}/${entries.length}).`);
  }
  if (withVerification > 0) {
    habits.push(`Verification commands are recorded with completed work (${withVerification}/${entries.length}).`);
  }
  if (changedTests > 0) {
    habits.push(`Tests are commonly changed with related implementation work (${changedTests}/${entries.length}).`);
  }
  if (withFollowUps > 0) {
    habits.push(`Follow-ups are captured when residual tasks remain (${withFollowUps}/${entries.length}).`);
  }
  if (activeDecisions > 0) {
    habits.push(`Active decision memory is maintained in DECISIONS.md (${activeDecisions}).`);
  }

  return habits.slice(0, repositoryLearningLimits.repositoryHabits);
}

export function buildRepositoryLearningModelFromEntries(
  entries: WorkMemoryEntry[],
  options: { decisions?: string; includeLowSignal?: boolean } = {}
): RepositoryLearningModel {
  const sorted = [...entries]
    .map((entry) => ({ ...entry, files: filteredFiles(entry.files) }))
    .filter((entry) => {
      if (!entry.summary.trim() || !entry.timestamp.trim()) {
        return false;
      }

      const quality = evaluateLearningQuality(entry);
      if (quality.shouldLearn || options.includeLowSignal) {
        return true;
      }

      return false;
    })
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  const decisions = decisionRows(options.decisions);

  return {
    recentFocusAreas: recentFocusAreas(sorted),
    commonFileRelationships: commonFileRelationships(sorted),
    frequentlyModifiedTogether: frequentlyModifiedTogether(sorted),
    verificationPatterns: verificationPatterns(sorted),
    repositoryHabits: repositoryHabits(sorted, decisions)
  };
}

export function buildRepositoryLearningModel(
  sources: RepositoryLearningSources,
  options: RepositoryLearningBuildOptions = {}
): RepositoryLearningModel {
  const entries = workLogEntries(sources.workLog);
  return buildRepositoryLearningModelFromEntries(
    entries.length > 0 ? entries : workIndexFallbackEntries(sources.workIndex),
    { decisions: sources.decisions, includeLowSignal: options.includeLowSignal }
  );
}

export async function readRepositoryLearningSources(cwd: string): Promise<RepositoryLearningSources> {
  const readOptional = async (relativePath: string): Promise<string | undefined> => {
    const fullPath = path.join(cwd, relativePath);
    return (await pathExists(fullPath)) ? readTextFile(fullPath) : undefined;
  };

  const [workLog, workIndex, decisions] = await Promise.all([
    readOptional(workLogPath),
    readOptional(workIndexPath),
    readOptional(decisionsPath)
  ]);

  return { decisions, workIndex, workLog };
}

export async function buildRepositoryLearningModelForRepo(cwd: string): Promise<RepositoryLearningModel> {
  return buildRepositoryLearningModel(await readRepositoryLearningSources(cwd));
}
