export interface WorkMemoryEntry {
  files: string[];
  followUps: string[];
  risks: string[];
  summary: string;
  timestamp: string;
  verification: string[];
}

interface LegacyWorkLogEntry {
  changedFiles: string[];
  followUps: string[];
  risks: string[];
  summary: string | null;
  timestamp: string | null;
  verification: string | null;
}

export const workLogPath = "docs/ai-context/WORK_LOG.md";
export const workLogArchivePath = "docs/ai-context/archive/WORK_LOG_ARCHIVE.md";
export const workIndexPath = "docs/ai-context/WORK_INDEX.md";
export const repositoryLearningPath = "docs/ai-context/REPOSITORY_LEARNING.md";
export const workLogStart = "<!-- repo-context-center:work-log:start -->";
export const workLogEnd = "<!-- repo-context-center:work-log:end -->";
export const workIndexStart = "<!-- repo-context-center:work-index:start -->";
export const workIndexEnd = "<!-- repo-context-center:work-index:end -->";
export const generatedStart = "<!-- repo-context-center:generated:start -->";
export const generatedEnd = "<!-- repo-context-center:generated:end -->";

function cleanInline(value: string, maxLength = 180): string {
  const cleaned = value.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}...` : cleaned;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)
    : [];
}

function verificationArray(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return stringArray(value);
}

export function parseChangedFilesLine(line: string): string[] {
  const value = line.replace(/^- Changed files:\s*/, "").trim();
  if (!value || value === "_none_" || value === "_not detected_" || value === "`auto`" || value === "auto") {
    return [];
  }

  const backtickPaths = [...value.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);

  if (backtickPaths.length > 0) {
    return backtickPaths;
  }

  return value
    .split(",")
    .map((item) => item.trim().replace(/^`|`$/g, ""))
    .filter(Boolean);
}

export function parseStructuredWorkEntry(value: unknown): WorkMemoryEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Record<string, unknown>;
  if (
    entry.schemaVersion !== 1
    || (entry.command !== undefined && entry.command !== "done" && entry.command !== "handoff")
  ) {
    return null;
  }

  const summary = typeof entry.summary === "string" ? entry.summary.trim() : "";
  const timestamp = typeof entry.timestamp === "string" ? entry.timestamp.trim() : "";
  if (!summary || !timestamp) {
    return null;
  }

  return {
    files: stringArray(entry.files),
    followUps: stringArray(entry.followUps),
    risks: stringArray(entry.risks),
    summary,
    timestamp,
    verification: verificationArray(entry.verification)
  };
}

function structuredHandoffEntries(content: string): WorkMemoryEntry[] {
  const entries: WorkMemoryEntry[] = [];
  const pattern = /<!--\s*rcc:handoff\s*(?<json>[\s\S]*?)-->/g;

  for (const match of content.matchAll(pattern)) {
    const rawJson = match.groups?.json;
    if (!rawJson) {
      continue;
    }

    try {
      const entry = parseStructuredWorkEntry(JSON.parse(rawJson));
      if (entry) {
        entries.push(entry);
      }
    } catch {
      // Ignore malformed handoff blocks and fall back to older parsing.
    }
  }

  return entries;
}

function structuredDoneEntries(content: string): WorkMemoryEntry[] {
  const entries: WorkMemoryEntry[] = [];
  const pattern = /```json repo-context-center:done\s*\n(?<json>[\s\S]*?)\n```/g;

  for (const match of content.matchAll(pattern)) {
    const rawJson = match.groups?.json;
    if (!rawJson) {
      continue;
    }

    try {
      const entry = parseStructuredWorkEntry(JSON.parse(rawJson));
      if (entry) {
        entries.push(entry);
      }
    } catch {
      // Ignore malformed structured blocks and fall back to legacy parsing.
    }
  }

  return entries;
}

function legacyWorkLogEntries(content: string): LegacyWorkLogEntry[] {
  const entries: LegacyWorkLogEntry[] = [];
  let current: LegacyWorkLogEntry | null = null;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      if (current) {
        entries.push(current);
      }
      current = {
        changedFiles: [],
        followUps: [],
        risks: [],
        summary: null,
        timestamp: trimmed.replace(/^##\s*/, "").trim() || null,
        verification: null
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (trimmed.startsWith("- Summary: ")) {
      current.summary = trimmed.replace(/^- Summary:\s*/, "").trim() || null;
      continue;
    }

    if (trimmed.startsWith("- Changed files: ")) {
      current.changedFiles = parseChangedFilesLine(trimmed);
      continue;
    }

    if (trimmed.startsWith("- Verification: ")) {
      current.verification = trimmed.replace(/^- Verification:\s*/, "").trim() || null;
      continue;
    }

    if (trimmed.startsWith("- Risk: ")) {
      const risk = trimmed.replace(/^- Risk:\s*/, "").trim();
      current.risks = risk ? [risk] : [];
      continue;
    }

    if (trimmed.startsWith("- Follow-ups: ")) {
      const followUp = trimmed.replace(/^- Follow-ups:\s*/, "").trim();
      current.followUps = followUp ? [followUp] : [];
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function entryFromLegacy(entry: LegacyWorkLogEntry): WorkMemoryEntry | null {
  if (!entry.summary || !entry.timestamp) {
    return null;
  }

  return {
    files: entry.changedFiles,
    followUps: entry.followUps,
    risks: entry.risks,
    summary: entry.summary,
    timestamp: entry.timestamp,
    verification: entry.verification ? [entry.verification] : []
  };
}

function sortEntries(entries: WorkMemoryEntry[]): WorkMemoryEntry[] {
  return [...entries].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export function parseWorkMemoryEntries(content: string): WorkMemoryEntry[] {
  const byTimestamp = new Map<string, WorkMemoryEntry>();

  for (const entry of legacyWorkLogEntries(content).map(entryFromLegacy).filter((entry): entry is WorkMemoryEntry => Boolean(entry))) {
    byTimestamp.set(entry.timestamp, entry);
  }

  for (const entry of structuredDoneEntries(content)) {
    byTimestamp.set(entry.timestamp, entry);
  }

  for (const entry of structuredHandoffEntries(content)) {
    byTimestamp.set(entry.timestamp, entry);
  }

  return sortEntries([...byTimestamp.values()]);
}

function themeForSummary(summary: string): string {
  const lower = summary.toLowerCase();

  if (/\bhandoff\b/.test(lower)) {
    return "Handoff";
  }
  if (/\barchive\b|work index|work log|memory/.test(lower)) {
    return "Work memory";
  }
  if (/\bwork\b|routing|route|rcc work|startup/.test(lower)) {
    return "Work routing";
  }
  if (/\btemplate\b|agents\.md|agent startup|guidance/.test(lower)) {
    return "Agent guidance";
  }
  if (/\bmeasure\b|token|benchmark/.test(lower)) {
    return "Measurement and benchmarks";
  }
  if (/\bmap\b|repository|scan|context/.test(lower)) {
    return "Repository context";
  }
  if (/\binit\b|doctor\b|cli\b|command\b/.test(lower)) {
    return "CLI commands";
  }
  if (/\btest\b|coverage\b/.test(lower)) {
    return "Tests";
  }

  return "General maintenance";
}

function markdownCell(value: string): string {
  return cleanInline(value || "-", 160).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function dateOnly(timestamp: string): string {
  return timestamp.split("T")[0] || timestamp;
}

function recentFocus(entries: WorkMemoryEntry[]): string[] {
  const focus = entries
    .slice(0, 7)
    .map((entry) => `- ${cleanInline(entry.summary, 140)}`);

  return focus.length > 0 ? focus : ["- No completed work has been recorded yet."];
}

function hotFiles(entries: WorkMemoryEntry[]): string[] {
  const files = new Map<string, { count: number; lastTouched: string; summaries: string[] }>();

  for (const entry of entries) {
    for (const file of entry.files) {
      const current = files.get(file) ?? { count: 0, lastTouched: entry.timestamp, summaries: [] };
      current.count += 1;
      if (entry.timestamp > current.lastTouched) {
        current.lastTouched = entry.timestamp;
      }
      if (current.summaries.length < 2) {
        current.summaries.push(entry.summary);
      }
      files.set(file, current);
    }
  }

  return [...files.entries()]
    .sort((left, right) => right[1].count - left[1].count || right[1].lastTouched.localeCompare(left[1].lastTouched))
    .slice(0, 10)
    .map(([file, info]) => `| \`${markdownCell(file)}\` | ${markdownCell(`${info.count} touch${info.count === 1 ? "" : "es"}; ${info.summaries[0] ?? "recent work"}`)} | ${markdownCell(dateOnly(info.lastTouched))} |`);
}

function completedThemes(entries: WorkMemoryEntry[]): string[] {
  const themes = new Map<string, { count: number; latest: string; summary: string }>();

  for (const entry of entries) {
    const theme = themeForSummary(entry.summary);
    const current = themes.get(theme);
    if (!current) {
      themes.set(theme, { count: 1, latest: entry.timestamp, summary: entry.summary });
      continue;
    }

    current.count += 1;
    if (entry.timestamp > current.latest) {
      current.latest = entry.timestamp;
      current.summary = entry.summary;
    }
  }

  return [...themes.entries()]
    .sort((left, right) => right[1].count - left[1].count || right[1].latest.localeCompare(left[1].latest))
    .slice(0, 8)
    .map(([theme, info]) => `| ${markdownCell(theme)} | ${info.count} | ${markdownCell(info.summary)} |`);
}

function verificationPatterns(entries: WorkMemoryEntry[]): string[] {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    for (const verification of entry.verification) {
      for (const part of verification.split(";")) {
        const command = cleanInline(part, 120);
        if (!command) {
          continue;
        }
        counts.set(command, (counts.get(command) ?? 0) + 1);
      }
    }
  }

  const lines = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([command, count]) => `- \`${command.replace(/`/g, "")}\` (${count})`);

  return lines.length > 0 ? lines : ["- No verification commands recorded yet."];
}

function noneDetected(): string[] {
  return ["- none detected yet"];
}

function pathArea(filePath: string): string {
  if (filePath.startsWith("docs/ai-context/")) {
    return "agent context";
  }
  if (filePath.startsWith("tests/") || /(^|\/)(tests?|__tests__|e2e|cypress)(\/|$)/.test(filePath)) {
    return "tests";
  }
  if (filePath.startsWith(".github/workflows/")) {
    return "ci workflows";
  }
  if (filePath.startsWith("src/cli/")) {
    return "cli";
  }
  if (filePath.startsWith("src/core/")) {
    return "core";
  }
  if (filePath.startsWith("src/")) {
    return "source";
  }
  if (/^(package.json|package-lock.json|pnpm-lock.yaml|yarn.lock|bun.lockb)$/.test(filePath)) {
    return "package metadata";
  }
  if (/^(README|CHANGELOG|AGENTS)\.md$/i.test(filePath)) {
    return "root docs";
  }

  return filePath.split("/")[0] || "repository";
}

function repositoryFocusAreas(entries: WorkMemoryEntry[]): string[] {
  const themes = completedThemes(entries)
    .slice(0, 5)
    .map((row) => row.match(/^\| ([^|]+) \| ([^|]+) \|/)?.slice(1, 3))
    .filter((match): match is string[] => Array.isArray(match))
    .map(([theme, count]) => `- ${theme.trim()} (${count.trim()})`);

  return themes.length > 0 ? themes : noneDetected();
}

function commonFileRelationships(entries: WorkMemoryEntry[]): string[] {
  const relationships = new Map<string, number>();

  for (const entry of entries) {
    const areas = [...new Set(entry.files.map(pathArea))].sort((left, right) => left.localeCompare(right));
    for (let index = 0; index < areas.length; index += 1) {
      for (let next = index + 1; next < areas.length; next += 1) {
        const key = `${areas[index]} + ${areas[next]}`;
        relationships.set(key, (relationships.get(key) ?? 0) + 1);
      }
    }
  }

  const lines = [...relationships.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([relationship, count]) => `- ${relationship} (${count})`);

  return lines.length > 0 ? lines : noneDetected();
}

function modifiedTogether(entries: WorkMemoryEntry[]): string[] {
  const pairs = new Map<string, number>();

  for (const entry of entries) {
    const files = [...new Set(entry.files)].sort((left, right) => left.localeCompare(right)).slice(0, 8);
    for (let index = 0; index < files.length; index += 1) {
      for (let next = index + 1; next < files.length; next += 1) {
        const key = `\`${files[index].replace(/`/g, "")}\` + \`${files[next].replace(/`/g, "")}\``;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }

  const lines = [...pairs.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([pair, count]) => `- ${pair} (${count})`);

  return lines.length > 0 ? lines : noneDetected();
}

function repositoryHabits(entries: WorkMemoryEntry[]): string[] {
  if (entries.length === 0) {
    return noneDetected();
  }

  const lines: string[] = [];
  const withFiles = entries.filter((entry) => entry.files.length > 0).length;
  const withVerification = entries.filter((entry) => entry.verification.length > 0).length;
  const withFollowUps = entries.filter((entry) => entry.followUps.length > 0).length;
  const contextTouches = entries.filter((entry) => entry.files.some((file) => file.startsWith("docs/ai-context/"))).length;

  if (withFiles > 0) {
    lines.push(`- Completed work usually records changed files (${withFiles}/${entries.length}).`);
  }
  if (withVerification > 0) {
    lines.push(`- Verification is commonly captured with completed work (${withVerification}/${entries.length}).`);
  }
  if (withFollowUps > 0) {
    lines.push(`- Follow-ups appear in completed work when residual tasks remain (${withFollowUps}/${entries.length}).`);
  }
  if (contextTouches > 0) {
    lines.push(`- Agent context files are maintained as part of RCC workflow changes (${contextTouches}/${entries.length}).`);
  }

  return lines.length > 0 ? lines : noneDetected();
}

function learningVerificationPatterns(entries: WorkMemoryEntry[]): string[] {
  const patterns = verificationPatterns(entries);
  return patterns.some((line) => /No verification commands recorded yet/.test(line)) ? noneDetected() : patterns;
}

export function renderRepositoryLearningBody(entries: WorkMemoryEntry[]): string {
  const sorted = sortEntries(entries);

  return [
    "## Recent Focus Areas",
    "",
    ...repositoryFocusAreas(sorted),
    "",
    "## Common File Relationships",
    "",
    ...commonFileRelationships(sorted),
    "",
    "## Frequently Modified Together",
    "",
    ...modifiedTogether(sorted),
    "",
    "## Verification Patterns",
    "",
    ...learningVerificationPatterns(sorted),
    "",
    "## Repository Habits",
    "",
    ...repositoryHabits(sorted)
  ].join("\n");
}

function renderGeneratedRepositoryLearning(entries: WorkMemoryEntry[]): string {
  return [
    generatedStart,
    "## Generated Repo Map",
    "",
    renderRepositoryLearningBody(entries),
    "",
    "_Generated by repo-context-center. Edit outside this section._",
    generatedEnd
  ].join("\n");
}

export function upsertRepositoryLearning(existing: string | undefined, entries: WorkMemoryEntry[]): string {
  const generated = renderGeneratedRepositoryLearning(entries);

  if (!existing || existing.trim().length === 0) {
    return `# Repository Learning\n\nCompact generated patterns from completed RCC work.\n\n${generated}\n`;
  }

  const normalized = existing.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(generatedStart);
  const end = normalized.indexOf(generatedEnd);

  if (start !== -1 && end !== -1 && end > start) {
    const before = normalized.slice(0, start).trimEnd();
    const after = normalized.slice(end + generatedEnd.length).trimStart();
    return `${before}\n\n${generated}${after ? `\n\n${after.trimEnd()}` : ""}\n`;
  }

  return `${normalized.trimEnd()}\n\n${generated}\n`;
}

export function renderWorkIndex(entries: WorkMemoryEntry[]): string {
  const sorted = sortEntries(entries);
  const hotFileRows = hotFiles(sorted);
  const themeRows = completedThemes(sorted);

  return [
    "# Work Index",
    "",
    "Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.",
    "",
    workIndexStart,
    "",
    "## Recent Focus",
    "",
    ...recentFocus(sorted),
    "",
    "## Hot Files",
    "",
    "| File | Reason | Last touched |",
    "| ---- | ------ | ------------ |",
    ...(hotFileRows.length > 0 ? hotFileRows : ["| _none_ | No files recorded yet | - |"]),
    "",
    "## Completed Work Themes",
    "",
    "| Theme | Count | Recent summary |",
    "| ----- | ----: | -------------- |",
    ...(themeRows.length > 0 ? themeRows : ["| _none_ | 0 | No completed work has been recorded yet |"]),
    "",
    "## Verification Patterns",
    "",
    ...verificationPatterns(sorted),
    "",
    workIndexEnd,
    ""
  ].join("\n");
}
