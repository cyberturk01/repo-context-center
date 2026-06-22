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
