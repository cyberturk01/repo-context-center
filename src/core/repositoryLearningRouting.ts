import path from "node:path";
import { pathExists, readTextFile } from "./fileSystem";
import { classifyRepoFile } from "./repoFileClassifier";
import {
  buildRepositoryLearningModelForRepo,
  type RepositoryLearningModel
} from "./repositoryLearning";

export interface LearnedRoutingSignals {
  learnedRelatedFiles: string[];
  learnedTests: string[];
  learnedVerification: string[];
}

const repositoryLearningPath = "docs/ai-context/REPOSITORY_LEARNING.md";
const minimumLearnedCount = 2;
const maxLearnedRelatedFiles = 3;
const maxLearnedTests = 2;
const maxLearnedVerification = 2;
const genericScopes = new Set(["tests", "build", "repo", "repository", "general", "general maintenance"]);

function emptySignals(): LearnedRoutingSignals {
  return {
    learnedRelatedFiles: [],
    learnedTests: [],
    learnedVerification: []
  };
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

function isAllowedLearnedPath(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath);
  if (!normalized || normalized.startsWith("docs/ai-context/archive/") || /\barchive\b/i.test(normalized)) {
    return false;
  }

  const info = classifyRepoFile(normalized);
  return info.role !== "generated"
    && info.role !== "asset"
    && info.role !== "fixture"
    && info.role !== "snapshot";
}

function taskTerms(task: string): Set<string> {
  return new Set((task.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? [])
    .flatMap((term) => term.split(/[._-]+/))
    .filter((term) => term.length > 1));
}

function scopeMatchesTask(scope: string, terms: Set<string>): boolean {
  const normalizedScope = scope.toLowerCase().replace(/\(\d+\)\s*$/, "").trim();
  const scopeTerms = normalizedScope.split(/[^a-z0-9]+/).filter(Boolean);

  if (scopeTerms.length === 0) {
    return false;
  }

  if (genericScopes.has(normalizedScope)) {
    return scopeTerms.some((term) => terms.has(term)) && terms.size > 1;
  }

  return scopeTerms.some((term) => terms.has(term));
}

function pathMatchesTask(filePath: string, terms: Set<string>): boolean {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  const parts = normalized.split(/[\/._-]+/).filter(Boolean);
  return parts.some((part) => terms.has(part));
}

function uniquePush(values: string[], value: string, limit: number): void {
  if (values.length < limit && !values.includes(value)) {
    values.push(value);
  }
}

function markdownGeneratedSection(content: string): string {
  const start = "<!-- repo-context-center:repository-learning:start -->";
  const end = "<!-- repo-context-center:repository-learning:end -->";
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return content;
  }

  return content.slice(startIndex + start.length, endIndex);
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [];
  }

  return trimmed
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, "|").replace(/`/g, "").trim());
}

function parseRepositoryLearningMarkdown(content: string): RepositoryLearningModel {
  const generated = markdownGeneratedSection(content);
  const model: RepositoryLearningModel = {
    recentFocusAreas: [],
    commonFileRelationships: [],
    frequentlyModifiedTogether: [],
    verificationPatterns: [],
    repositoryHabits: []
  };
  let section = "";

  for (const line of generated.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/)?.[1];
    if (heading) {
      section = heading;
      continue;
    }

    if (section === "Common File Relationships") {
      const cells = splitMarkdownTableRow(line);
      if (cells.length === 4 && cells[0] !== "Source" && !cells.every((cell) => /^-+:?$/.test(cell))) {
        const count = Number.parseInt(cells[3], 10);
        if (Number.isFinite(count) && cells[0] !== "none detected yet") {
          model.commonFileRelationships.push({
            source: cells[0],
            related: cells[1],
            reason: cells[2],
            count
          });
        }
      }
    } else if (section === "Frequently Modified Together") {
      const cells = splitMarkdownTableRow(line);
      if (cells.length === 3 && cells[0] !== "Files" && !cells.every((cell) => /^-+:?$/.test(cell))) {
        const count = Number.parseInt(cells[1], 10);
        const files = cells[0].split(",").map((file) => file.trim()).filter(Boolean);
        if (Number.isFinite(count) && files.length > 0 && cells[0] !== "none detected yet") {
          model.frequentlyModifiedTogether.push({
            files,
            count,
            recentSummary: cells[2] === "none detected yet" ? null : cells[2]
          });
        }
      }
    } else if (section === "Verification Patterns") {
      const cells = splitMarkdownTableRow(line);
      if (cells.length === 3 && cells[0] !== "Scope" && !cells.every((cell) => /^-+:?$/.test(cell))) {
        const count = Number.parseInt(cells[2], 10);
        if (Number.isFinite(count) && cells[0] !== "none detected yet") {
          model.verificationPatterns.push({
            scope: cells[0],
            command: cells[1],
            count
          });
        }
      }
    }
  }

  return model;
}

async function readRenderedLearningModel(cwd: string): Promise<RepositoryLearningModel | null> {
  const fullPath = path.join(cwd, repositoryLearningPath);
  if (!await pathExists(fullPath)) {
    return null;
  }

  return parseRepositoryLearningMarkdown(await readTextFile(fullPath));
}

function hasLearnedData(model: RepositoryLearningModel): boolean {
  return model.commonFileRelationships.length > 0
    || model.frequentlyModifiedTogether.length > 0
    || model.verificationPatterns.length > 0;
}

export async function learnedRoutingSignalsForTask(cwd: string, task: string): Promise<LearnedRoutingSignals> {
  const terms = taskTerms(task);
  if (terms.size === 0) {
    return emptySignals();
  }

  let model = await buildRepositoryLearningModelForRepo(cwd);
  if (!hasLearnedData(model)) {
    model = await readRenderedLearningModel(cwd) ?? model;
  }

  const signals = emptySignals();
  const matchedScopes = new Set<string>();

  for (const relationship of model.commonFileRelationships) {
    if (relationship.count < minimumLearnedCount || !scopeMatchesTask(relationship.source, terms)) {
      continue;
    }

    matchedScopes.add(relationship.source.toLowerCase());
    const related = normalizeRepoPath(relationship.related);
    if (!isAllowedLearnedPath(related)) {
      continue;
    }

    const role = classifyRepoFile(related).role;
    if (role === "test") {
      uniquePush(signals.learnedTests, related, maxLearnedTests);
    } else {
      uniquePush(signals.learnedRelatedFiles, related, maxLearnedRelatedFiles);
    }
  }

  for (const item of model.frequentlyModifiedTogether) {
    if (item.count < minimumLearnedCount) {
      continue;
    }
    if (!item.files.some((file) => pathMatchesTask(file, terms))) {
      continue;
    }

    for (const file of item.files.map(normalizeRepoPath).filter(isAllowedLearnedPath)) {
      const role = classifyRepoFile(file).role;
      if (role === "test") {
        uniquePush(signals.learnedTests, file, maxLearnedTests);
      } else {
        uniquePush(signals.learnedRelatedFiles, file, maxLearnedRelatedFiles);
      }
    }
  }

  for (const pattern of model.verificationPatterns) {
    if (pattern.count < minimumLearnedCount || !scopeMatchesTask(pattern.scope, terms)) {
      continue;
    }
    if (genericScopes.has(pattern.scope.toLowerCase()) && matchedScopes.size === 0) {
      continue;
    }

    uniquePush(signals.learnedVerification, pattern.command, maxLearnedVerification);
  }

  return signals;
}
