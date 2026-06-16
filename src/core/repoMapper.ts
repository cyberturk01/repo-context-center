import path from "node:path";
import { requiredContextFiles, type RequiredContextFile } from "./contextFiles";
import { ensureDir, listDirectoryNames, readTextFile, writeTextFile, pathExists } from "./fileSystem";
import { buildRepositoryUnderstanding, type RepositoryUnderstanding } from "./repositoryUnderstanding";
import { extractExportedSymbols, type ScannedSymbol } from "./scanner";

export interface RepoMapOptions {
  cwd: string;
  maxFiles: number;
  write?: boolean;
  dryRun?: boolean;
}

export interface RepoMapRow {
  [key: string]: string;
}

export interface RepoModule {
  name: string;
  purpose: string;
  primaryFiles: string[];
  commonTasks: string[];
  tests: string[];
  dependencies: string[];
  risks: string[];
}

export interface RepoRisk {
  area: string;
  why: string;
  checks: string[];
}

export interface RepoDependency {
  from: string;
  dependsOn: string;
  why: string;
  inferred: boolean;
}

export interface RepoSymbol {
  symbol: string;
  file: string;
  use: string;
}

export interface RepoHotspot {
  file: string;
  why: string;
  checks: string[];
}

export interface RepoFirstFilesGroup {
  taskArea: string;
  files: string[];
}

export type RepoUnderstandingLevel = "High" | "Medium" | "Low";

export interface RepoUnderstandingQuality {
  level: RepoUnderstandingLevel;
  entrypointsDetected: number;
  keyDirectoriesDetected: number;
  modulesDetected: number;
  dependencyHintsMode: "Conservative";
  noiseFilteringStatus: string;
}

export interface RepoMapData {
  root: string;
  generatedAt: string;
  filesScanned: number;
  riskDefaultChecks: string[];
  firstFiles: RepoFirstFilesGroup[];
  taskRouting: RepoMapRow[];
  modules: RepoModule[];
  projectMap: {
    purpose: string;
    keyDirectories: string[];
    entrypoints: string[];
    config: string[];
    tests: string[];
    executionFlow: string[];
    ignoredAreas: string[];
    understandingQuality: RepoUnderstandingQuality;
    productionCriticalFlows: RepoMapRow[];
  };
  risks: RepoRisk[];
  dependencies: RepoDependency[];
  symbols: RepoSymbol[];
  hotspots: RepoHotspot[];
  doNotRead: string[];
  tokenBudget: RepoMapRow[];
  communicationNotes: string[];
  lessonsPlaceholder: string[];
}

export interface RepoMapChange {
  path: RequiredContextFile;
  action: "create" | "update";
  content: string;
}

export interface RepoMapResult {
  data: RepoMapData;
  changes: RepoMapChange[];
  written: string[];
}

export interface RepoMapCheckResult {
  data: RepoMapData;
  changes: RepoMapChange[];
  staleChanges: RepoMapChange[];
}

interface RepoFile {
  path: string;
  parts: string[];
  ext: string;
}

interface Category {
  key: string;
  label: string;
  taskType: string;
  purpose: string;
  commonTasks: string[];
  thenCheck: string[];
  notes: string;
  includeInRouting?: boolean;
  riskWhy?: string;
  match: (file: RepoFile) => boolean;
}

const generatedStart = "<!-- repo-context-center:generated:start -->";
const generatedEnd = "<!-- repo-context-center:generated:end -->";
const defaultMaxFiles = 500;
const sourceRoots = ["src", "app", "lib", "packages"];
const testRoots = ["tests", "test", "__tests__", "cypress", "e2e"];
const excludedDirs = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  "target",
  ".git",
  ".repo-context-center"
]);
const baseDoNotRead = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  "target",
  "docs/ai-context/archive",
  "snapshots",
  "__snapshots__",
  "fixtures",
  "package-lock.json"
];
const generatedExtensions = new Set([
  ".gif",
  ".ico",
  ".jpg",
  ".jpeg",
  ".map",
  ".mp4",
  ".png",
  ".svg",
  ".webp",
  ".woff",
  ".woff2"
]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".sh"]);
const textReadLimit = 128 * 1024;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function compactList(values: string[], fallback = "none", limit = 4): string {
  const list = uniqueSorted(values).slice(0, limit);
  return list.length > 0 ? list.map((value) => `\`${value}\``).join(", ") : fallback;
}

function compactOrderedList(values: string[], fallback = "none", limit = 4): string {
  const seen = new Set<string>();
  const list = values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  }).slice(0, limit);
  return list.length > 0 ? list.map((value) => `\`${value}\``).join(", ") : fallback;
}

function compactPlainList(values: string[], fallback = "none", limit = 4): string {
  const list = uniqueSorted(values).slice(0, limit);
  return list.length > 0 ? list.join(", ") : fallback;
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function fileName(filePath: string): string {
  return path.posix.basename(filePath);
}

function withoutExt(filePath: string): string {
  return filePath.replace(/\.[^.]+$/, "");
}

function words(filePath: string): string[] {
  return filePath.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function pathHas(file: RepoFile, terms: string[]): boolean {
  const fileWords = new Set(words(file.path));
  return terms.some((term) => fileWords.has(term) || file.path.toLowerCase().includes(term));
}

function isTestPath(filePath: string): boolean {
  if (isFixtureOrSnapshotPath(filePath)) {
    return false;
  }

  return /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath)
    || /(^|\/)test_[^/]+\.py$/i.test(filePath)
    || /(^|\/)(tests?|__tests__|e2e|cypress)\/.*\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath)
    || /(^|\/)(tests?|__tests__|e2e|cypress)\/.*(^|\/)(test_[^/]+|[^/]+_test)\.py$/i.test(filePath)
    || /(^|\/)(tests?|__tests__|e2e|cypress)\/.*integration.*\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath)
    || /(^|\/)integration-tests?\/.*\.(ts|tsx|js|jsx|mjs|cjs|py)$/i.test(filePath);
}

function isSourcePath(filePath: string): boolean {
  return !isDocumentationPath(filePath)
    && sourceRoots.some((root) => filePath === root || filePath.startsWith(`${root}/`))
    && !isTestPath(filePath)
    && sourceExtensions.has(path.extname(filePath).toLowerCase());
}

function isDocumentationPath(filePath: string): boolean {
  return filePath.startsWith("docs/") || /\.(md|mdx|rst|txt)$/i.test(filePath);
}

function isContextPath(filePath: string): boolean {
  return filePath === "AGENTS.md"
    || filePath.startsWith("docs/ai-context/")
    || filePath === ".repo-context-center/config.json"
    || filePath.startsWith(".project-brain/");
}

function isConfigPath(filePath: string): boolean {
  return filePath.startsWith("src/config/")
    || /^src\/core\/config\.[^.]+$/.test(filePath)
    || filePath === "guardian.config.json"
    || /^examples\/[^/]+\/guardian\.config\.json$/.test(filePath)
    || filePath === "pyproject.toml"
    || filePath === "package.json"
    || filePath === "package-lock.json"
    || filePath === "pnpm-lock.yaml"
    || filePath === "yarn.lock";
}

function isLockfilePath(filePath: string): boolean {
  return filePath === "package-lock.json" || filePath === "pnpm-lock.yaml" || filePath === "yarn.lock";
}

function isDatabasePath(filePath: string): boolean {
  return filePath.startsWith("db/")
    || filePath.startsWith("migrations/")
    || filePath.startsWith("src/db/")
    || /(^|\/)migration/i.test(filePath);
}

function isPublicPath(filePath: string): boolean {
  return filePath.startsWith("public/") || filePath.startsWith("static/");
}

function isGeneratedAsset(filePath: string): boolean {
  return generatedExtensions.has(path.extname(filePath).toLowerCase()) || /\.min\.[^.]+$/i.test(filePath);
}

function isFixtureOrSnapshotPath(filePath: string): boolean {
  return /(^|\/)(__fixtures__|__snapshots__|snapshots?|fixtures?|test-fixtures)(\/|$)/i.test(filePath)
    || /(^|\/)[^/]+\.(?:snap|snapshot)(?:\.[^/]*)?$/i.test(filePath);
}

function isReleasePath(filePath: string): boolean {
  return filePath.startsWith(".github/workflows/")
    || /(^|\/)(deploy|deployment|release)[^/]*\.(ts|js|md|json|ya?ml)$/i.test(filePath)
    || /(^|\/)(deploy|deployment|release)(\/|$)/i.test(filePath)
    || filePath === "Dockerfile"
    || filePath === "docker-compose.yml"
    || filePath === "railway.json"
    || filePath === "vercel.json";
}

function isTemplatePath(filePath: string): boolean {
  return filePath.startsWith("src/templates/")
    || filePath.startsWith("templates/")
    || /^src\/core\/templateInstaller\.[^.]+$/.test(filePath);
}

function isReportPath(filePath: string): boolean {
  return filePath.startsWith("src/renderers/")
    || /^src\/core\/repoMapper\.[^.]+$/.test(filePath)
    || /(^|\/)(archive|estimate|suggest|map|report)[^/]*\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath);
}

function isAnalyzerPath(filePath: string): boolean {
  if (isDocumentationPath(filePath)) {
    return false;
  }

  return filePath.startsWith("src/analyzers/")
    || filePath.startsWith("analyzers/")
    || /(^|\/)(analy[sz]er|risk|hotspot|score|rule|validator|security)[^/]*\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php)$/i.test(filePath);
}

function isSourceLikeClassificationPath(filePath: string): boolean {
  return !isDocumentationPath(filePath)
    && sourceExtensions.has(path.extname(filePath).toLowerCase());
}

function isScannerPath(filePath: string): boolean {
  return filePath.startsWith("src/repo/")
    || /(^|\/)(scan|scanner|symbol|symbols|fileSystem|contextFiles)[^/]*\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath);
}

function isCoreOrchestrationPath(filePath: string): boolean {
  return filePath.startsWith("src/core/");
}

function isLowValueHotspotPath(filePath: string, hasSourceOrTests = true): boolean {
  return filePath === ".repo-context-center/config.json"
    || filePath.startsWith(".project-brain/metrics/")
    || filePath.startsWith("docs/ai-context/")
    || (hasSourceOrTests && isDocumentationPath(filePath))
    || isFixtureOrSnapshotPath(filePath);
}

async function walkRepo(cwd: string, maxFiles: number): Promise<RepoFile[]> {
  const files: RepoFile[] = [];
  const seen = new Set<string>();
  const repoDirName = path.basename(cwd);

  function addFile(filePath: string): void {
    const normalized = normalizePath(filePath);
    if (seen.has(normalized) || isGeneratedAsset(normalized) || files.length >= maxFiles) {
      return;
    }

    seen.add(normalized);
    files.push({
      path: normalized,
      parts: normalized.split("/"),
      ext: path.extname(normalized).toLowerCase()
    });
  }

  async function seedRepresentativeFiles(relativeDir: string, limit: number): Promise<void> {
    if (files.length >= maxFiles || limit <= 0) {
      return;
    }

    let dirEntries;
    try {
      dirEntries = await import("node:fs/promises").then((fs) =>
        fs.readdir(path.join(cwd, relativeDir), { withFileTypes: true })
      );
    } catch {
      return;
    }

    dirEntries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of dirEntries) {
      if (files.length >= maxFiles || limit <= 0) {
        return;
      }

      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const normalized = normalizePath(relativePath);
      if (entry.isFile()) {
        if (!seen.has(normalized) && !isGeneratedAsset(normalized)) {
          addFile(normalized);
          limit -= 1;
        }
      } else if (entry.isDirectory() && !excludedDirs.has(entry.name) && normalized !== "docs/ai-context/archive") {
        const before = files.length;
        await seedRepresentativeFiles(normalized, limit);
        limit -= files.length - before;
      }
    }
  }

  const seedDirs = uniqueOrdered([
    repoDirName,
    "src",
    "app",
    "lib",
    "packages",
    "tests",
    "test",
    "__tests__",
    "scripts",
    "docs",
    ".github/workflows"
  ]);

  for (const dir of seedDirs) {
    await seedRepresentativeFiles(dir, dir === repoDirName ? 8 : 4);
  }

  async function walk(relativeDir: string): Promise<void> {
    if (files.length >= maxFiles) {
      return;
    }

    const entries = await listDirectoryNames(path.join(cwd, relativeDir));
    const names = new Set(entries);

    let dirEntries;
    try {
      dirEntries = await import("node:fs/promises").then((fs) =>
        fs.readdir(path.join(cwd, relativeDir), { withFileTypes: true })
      );
    } catch {
      return;
    }

    dirEntries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of dirEntries) {
      if (files.length >= maxFiles) {
        return;
      }

      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const normalized = normalizePath(relativePath);

      if (entry.isDirectory()) {
        if (normalized === ".repo-context-center") {
          const configPath = ".repo-context-center/config.json";
          if (await pathExists(path.join(cwd, configPath))) {
            files.push({
              path: configPath,
              parts: configPath.split("/"),
              ext: ".json"
            });
          }
        } else if (!excludedDirs.has(entry.name) && normalized !== "docs/ai-context/archive") {
          await walk(normalized);
        }
      } else if (entry.isFile() && !isGeneratedAsset(normalized)) {
        addFile(normalized);
      }
    }

    void names;
  }

  await walk("");
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function findMatchingTestFiles(sourceFile: string, tests: string[]): string[] {
  const sourceBase = path.posix.basename(withoutExt(sourceFile)).replace(/\.(test|spec|cy)$/i, "");
  const sourceStem = withoutExt(sourceFile)
    .replace(/^(src|app|lib|packages)\//, "")
    .replace(/\/index$/, "");

  return tests.filter((testFile) => {
    const testStem = withoutExt(testFile)
      .replace(/\.(test|spec|cy)$/i, "")
      .replace(/^(tests?|__tests__|cypress|e2e)\//, "");
    return testStem.endsWith(sourceStem) || path.posix.basename(testStem) === sourceBase;
  });
}

function findCategoryTestFiles(category: Category, tests: string[]): string[] {
  const keyTerms: Record<string, string[]> = {
    cli: ["cli", "command"],
    config: ["config", "validator", "init"],
    scanner: ["scan", "scanner", "symbol"],
    analyzers: ["analyzer", "analysis", "risk", "hotspot", "validate", "validator", "security"],
    reports: ["map", "report", "archive", "estimate", "suggest"],
    core: ["core"],
    templates: ["template", "context"],
    auth: ["auth", "session", "security", "consent"],
    database: ["db", "database", "migration"],
    email: ["email", "mail", "message", "notification"],
    business: ["coupon", "reward", "loyalty", "customer"],
    "public-staff-pos": ["public", "staff", "pos", "qr"],
    context: ["context", "template", "map", "validate"],
    release: ["release", "deploy", "deployment", "workflow", "ci"]
  };
  const terms = keyTerms[category.key] ?? [];
  return tests.filter((testFile) => {
    const testWords = new Set(words(testFile));
    return terms.some((term) => testWords.has(term));
  });
}

function categoryRank(category: Category, filePath: string, hasAiContextDocs: boolean): number {
  if (category.key === "config") {
    if (filePath.startsWith("src/config/")) {
      return 0;
    }
    if (/^src\/core\/config\.[^.]+$/.test(filePath)) {
      return 1;
    }
    if (filePath === "guardian.config.json") {
      return 2;
    }
    if (/^examples\/[^/]+\/guardian\.config\.json$/.test(filePath)) {
      return 3;
    }
    return 9;
  }

  if (category.key === "context") {
    if (filePath === "AGENTS.md") {
      return 0;
    }
    if (filePath === "docs/ai-context/TASK_ROUTING.md") {
      return 1;
    }
    if (filePath === "docs/ai-context/MODULE_INDEX.md") {
      return 2;
    }
    if (filePath === "docs/ai-context/PROJECT_MAP.md") {
      return 3;
    }
    if (filePath === ".repo-context-center/config.json") {
      return 4;
    }
    if (filePath.startsWith("docs/ai-context/")) {
      return 5;
    }
    if (filePath.startsWith(".project-brain/metrics/") && hasAiContextDocs) {
      return 10;
    }
    if (filePath.startsWith(".project-brain/")) {
      return 6;
    }
  }

  if (category.key === "analyzers") {
    if (filePath.startsWith("src/analyzers/")) {
      return 0;
    }
    if (/validator|risk|hotspot|security/i.test(filePath) && sourceExtensions.has(path.extname(filePath).toLowerCase())) {
      return 1;
    }
    return 5;
  }

  if (category.key === "reports") {
    if (filePath.startsWith("src/renderers/")) {
      return 0;
    }
    if (/^src\/core\/repoMapper\.[^.]+$/.test(filePath)) {
      return 1;
    }
    return 5;
  }

  if (category.key === "core") {
    if (filePath.startsWith("src/core/")) {
      return 0;
    }
    return 5;
  }

  if (category.key === "scanner") {
    if (filePath.startsWith("src/repo/")) {
      return 0;
    }
    if (/scanner|scan|symbol/i.test(filePath)) {
      return 1;
    }
    return 5;
  }

  if (category.key === "templates") {
    if (filePath.startsWith("src/templates/")) {
      return 0;
    }
    if (/^src\/core\/templateInstaller\.[^.]+$/.test(filePath)) {
      return 1;
    }
    if (filePath.startsWith("templates/")) {
      return 2;
    }
    if (filePath.startsWith("src/project-brain/")) {
      return 3;
    }
    return 5;
  }

  if (category.key === "release") {
    if (filePath.startsWith(".github/workflows/")) {
      return 0;
    }
    if (/deploy|deployment|release/i.test(filePath) && sourceExtensions.has(path.extname(filePath).toLowerCase())) {
      return 1;
    }
    if (/deploy|deployment|release/i.test(filePath) && /\.(md|json|ya?ml)$/i.test(filePath)) {
      return 2;
    }
    return 3;
  }

  return 0;
}

function primaryFilesForCategory(files: RepoFile[], category: Category, limit: number): string[] {
  const hasAiContextDocs = files.some((file) => file.path.startsWith("docs/ai-context/"));

  return filesForCategory(files, category)
    .filter((file) => !isTestPath(file.path))
    .filter((file) => category.key === "fixtures" || !isFixtureOrSnapshotPath(file.path))
    .filter((file) => category.key === "release" || !isLockfilePath(file.path))
    .filter((file) => category.key !== "context" || !file.path.startsWith(".project-brain/metrics/") || !hasAiContextDocs)
    .sort((left, right) => {
      const rankDiff = categoryRank(category, left.path, hasAiContextDocs) - categoryRank(category, right.path, hasAiContextDocs);
      return rankDiff === 0 ? left.path.localeCompare(right.path) : rankDiff;
    })
    .map((file) => file.path)
    .slice(0, limit);
}

function verificationFor(files: string[], tests: string[], packageScripts: Set<string>): string {
  const checks: string[] = [];
  if (packageScripts.has("build")) {
    checks.push("npm run build");
  }
  if (tests.length > 0) {
    checks.push(testReviewCheck(tests));
  } else if (packageScripts.has("test")) {
    checks.push("npm test");
  }
  if (packageScripts.has("lint")) {
    checks.push("npm run lint");
  }
  if (checks.length === 0 && files.length > 0) {
    checks.push(`review ${files.slice(0, 2).join(", ")}`);
  }
  return uniqueOrdered(checks).join("; ") || "focused manual review";
}

function testReviewCheck(tests: string[]): string {
  const selected = tests.slice(0, 2);
  const nodeRunnable = selected.every((testFile) => /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(testFile));
  return nodeRunnable
    ? `node --test ${selected.join(" ")}`
    : `review ${selected.join(", ")}`;
}

function defaultVerificationChecks(packageScripts: Set<string>): string[] {
  return [
    packageScripts.has("build") ? "npm run build" : undefined,
    packageScripts.has("test") ? "npm test" : undefined,
    packageScripts.has("lint") ? "npm run lint" : undefined
  ].filter((check): check is string => check !== undefined);
}

function focusedVerificationFor(files: string[], tests: string[]): string[] {
  const checks: string[] = [];
  if (tests.length > 0) {
    checks.push(testReviewCheck(tests));
  }
  if (files.length > 0) {
    checks.push(`review ${files.slice(0, 2).join(", ")}`);
  }
  const deduped = uniqueOrdered(checks);
  return deduped.length > 0 ? deduped : ["focused manual review"];
}

const categories: Category[] = [
  {
    key: "cli",
    label: "CLI",
    taskType: "CLI flags/output",
    purpose: "Command parsing and user-facing output",
    commonTasks: ["add flags", "adjust help text", "change stdout/stderr", "set exit codes"],
    thenCheck: ["core command handler", "README examples", "CLI tests"],
    notes: "Keep output stable for tests and scripts.",
    match: (file) => file.path.startsWith("src/cli/")
  },
  {
    key: "config",
    label: "Configuration",
    taskType: "Config behavior",
    purpose: "Project configuration and setup rules",
    commonTasks: ["change defaults", "validate config", "install templates", "update setup rules"],
    thenCheck: ["template installer", "validator", "init tests"],
    notes: "Preserve existing user files unless force behavior is explicit.",
    riskWhy: "Config mistakes can misroute agent work or break validation.",
    match: (file) => isConfigPath(file.path) || (isSourceLikeClassificationPath(file.path) && pathHas(file, ["config", "validate", "validator"]))
  },
  {
    key: "analyzers",
    label: "Analyzers / Risk Rules",
    taskType: "Analyzer/risk rule changes",
    purpose: "Analysis, validation, risk scoring, and hotspot guidance",
    commonTasks: ["change analyzers", "adjust risk rows", "score context quality", "validate rules"],
    thenCheck: ["validator", "hotspots", "risk register tests"],
    notes: "Risk and analyzer wording affects future agent read order.",
    riskWhy: "Risk guidance affects what agents inspect before changes.",
    match: (file) => isAnalyzerPath(file.path)
  },
  {
    key: "reports",
    label: "Renderers / Reports",
    taskType: "Report rendering",
    purpose: "Generated CLI reports and markdown output",
    commonTasks: ["format markdown", "format JSON", "preserve generated markers", "summarize report output"],
    thenCheck: ["renderers", "snapshot-like tests", "README examples"],
    notes: "Keep generated sections deterministic.",
    match: (file) => isReportPath(file.path)
  },
  {
    key: "core",
    label: "Core / Orchestration",
    taskType: "Core/orchestration changes",
    purpose: "Core coordination and shared command behavior",
    commonTasks: ["coordinate commands", "connect scanner and renderers", "share common services"],
    thenCheck: ["CLI commands", "map output", "core tests"],
    notes: "Check callers because core changes often affect multiple commands.",
    includeInRouting: false,
    match: (file) => isCoreOrchestrationPath(file.path)
  },
  {
    key: "scanner",
    label: "Repository scanning",
    taskType: "Repository scanning/classification",
    purpose: "Repo inspection and lightweight analysis",
    commonTasks: ["classify files", "ignore generated areas", "detect symbols", "match tests"],
    thenCheck: ["context file rules", "symbol map output", "scan tests"],
    notes: "Avoid full source reads except bounded symbol extraction.",
    match: (file) => isScannerPath(file.path)
  },
  {
    key: "templates",
    label: "Templates",
    taskType: "Template/context generation",
    purpose: "Generated templates and starter context content",
    commonTasks: ["update templates", "change generated defaults", "adjust starter docs"],
    thenCheck: ["template installer", "context docs", "template tests"],
    notes: "Keep templates compact and aligned with generated context files.",
    match: (file) => isTemplatePath(file.path) || file.path.startsWith("src/project-brain/")
  },
  {
    key: "fixtures",
    label: "Tests / Fixtures",
    taskType: "Test fixture/snapshot updates",
    purpose: "Test data, temp repos, and fixtures",
    commonTasks: ["update temp repo setup", "change fixtures", "refresh expected docs"],
    thenCheck: ["affected tests", "generated docs", "do-not-read rules"],
    notes: "Fixture drift can hide broken routing or map output.",
    match: (file) => isFixtureOrSnapshotPath(file.path)
  },
  {
    key: "auth",
    label: "Auth/access",
    taskType: "Auth/access",
    purpose: "Authentication, sessions, roles, and permissions",
    commonTasks: ["auth", "access", "sessions"],
    thenCheck: ["database/session code", "risk register", "auth tests"],
    notes: "Use Investigation Mode.",
    riskWhy: "Auth changes can expose accounts or bypass permissions.",
    match: (file) => pathHas(file, ["auth", "session", "password", "permission", "role", "security", "consent"])
  },
  {
    key: "database",
    label: "Database/migrations",
    taskType: "Database/migrations",
    purpose: "Persistence, schema, and migrations",
    commonTasks: ["schema", "migration", "data"],
    thenCheck: ["data callers", "migration tests", "rollback notes"],
    notes: "Use Investigation Mode for production data changes.",
    riskWhy: "Schema changes can lose data or break production deploys.",
    match: (file) => isDatabasePath(file.path)
  },
  {
    key: "email",
    label: "Email/messaging",
    taskType: "Email/messaging",
    purpose: "Email, messages, notifications, and campaigns",
    commonTasks: ["delivery", "templates", "queues"],
    thenCheck: ["queue boundaries", "template tests", "delivery guards"],
    notes: "Check duplicate-send and incorrect-recipient risks.",
    riskWhy: "Messaging changes can send incorrect or duplicate communication.",
    match: (file) => pathHas(file, ["email", "mail", "message", "notification", "campaign"])
  },
  {
    key: "business",
    label: "Business-sensitive flows",
    taskType: "Coupon/reward/loyalty",
    purpose: "Coupon, reward, customer, and loyalty behavior",
    commonTasks: ["business rules", "eligibility", "redemption"],
    thenCheck: ["service rules", "public/staff callers", "business tests"],
    notes: "Check accounting, eligibility, and duplicate-use cases.",
    riskWhy: "Business rules can affect customer value or owner accounting.",
    match: (file) => pathHas(file, ["coupon", "reward", "loyalty", "referral", "visit", "contact", "customer"])
  },
  {
    key: "public-staff-pos",
    label: "Staff/POS/public flows",
    taskType: "Staff/POS/public flows",
    purpose: "Public, staff, owner, POS, and QR flows",
    commonTasks: ["public UI", "staff workflow", "POS"],
    thenCheck: ["role checks", "route handlers", "e2e tests"],
    notes: "User-visible and often role-sensitive.",
    riskWhy: "Public and staff flows are user-visible and often role-sensitive.",
    match: (file) => isPublicPath(file.path) || pathHas(file, ["owner", "staff", "pos", "qr", "public"])
  },
  {
    key: "context",
    label: "Context docs",
    taskType: "Context doc updates",
    purpose: "Agent routing, context maps, and workflow notes",
    commonTasks: ["update routing", "refresh maps", "preserve manual notes"],
    thenCheck: ["templates", "map tests", "validator"],
    notes: "Keep generated content compact and factual.",
    includeInRouting: false,
    match: (file) => isContextPath(file.path)
  },
  {
    key: "release",
    label: "Release workflow",
    taskType: "GitHub Actions / release workflow",
    purpose: "CI, deployment, and release configuration",
    commonTasks: ["CI", "deployment", "release"],
    thenCheck: ["package scripts", "workflow files", "release docs"],
    notes: "Use Investigation Mode before changing deploy or release behavior.",
    riskWhy: "Workflow changes can block releases or deploy broken builds.",
    match: (file) => isReleasePath(file.path)
  }
];

function filesForCategory(files: RepoFile[], category: Category): RepoFile[] {
  return files.filter((file) => {
    if (category.key !== "context" && isContextPath(file.path)) {
      return false;
    }

    return category.match(file);
  });
}

const sourceEvidenceRoots = ["src", "app", "lib", "packages"];
const domainCategoryKeys = new Set(["auth", "database", "email", "business", "public-staff-pos"]);

function isProductionDomainEvidence(file: RepoFile, category: Category): boolean {
  if (isTestPath(file.path)
    || isFixtureOrSnapshotPath(file.path)
    || isGeneratedOrIgnoredNavigationPath(file.path)
    || isContextPath(file.path)
  ) {
    return false;
  }

  const root = file.parts[0] ?? "";
  const isSourceCode = sourceEvidenceRoots.includes(root) && sourceExtensions.has(file.ext);
  if (isSourceCode) {
    return true;
  }

  return category.key === "database" && isDatabasePath(file.path) && /\.(sql|ya?ml|json)$/i.test(file.path);
}

function categoryHasProductionDomainEvidence(files: RepoFile[], category: Category): boolean {
  return !domainCategoryKeys.has(category.key)
    || filesForCategory(files, category).some((file) => isProductionDomainEvidence(file, category));
}

function relatedTests(sourceFiles: string[], testFiles: string[]): string[] {
  return uniqueSorted(sourceFiles.flatMap((file) => findMatchingTestFiles(file, testFiles)));
}

function testsForCategory(category: Category, primary: string[], testFiles: string[]): string[] {
  if (category.key === "context" || category.key === "fixtures") {
    return findCategoryTestFiles(category, testFiles);
  }

  return uniqueSorted([
    ...relatedTests(primary, testFiles),
    ...findCategoryTestFiles(category, testFiles)
  ]);
}

interface FirstFilesDefinition {
  taskArea: string;
  categoryKey: string;
  primary: RegExp[];
  related: RegExp[];
  helper: RegExp[];
  tests: RegExp[];
}

const firstFilesDefinitions: FirstFilesDefinition[] = [
  {
    taskArea: "CLI behavior",
    categoryKey: "cli",
    primary: [/^src\/cli\/index\./, /^src\/cli\/commands\//],
    related: [/^src\/core\/guardian\./, /^src\/core\/repoMapper\./, /^src\/core\/config\./, /^src\/config\//],
    helper: [/^src\/renderers\//],
    tests: [/^tests\/cli\.(test|spec)\./, /(^|\/)cli\.(test|spec)\./]
  },
  {
    taskArea: "Configuration",
    categoryKey: "config",
    primary: [/^src\/config\//, /^src\/core\/config\./],
    related: [/^src\/core\/validator\./, /^src\/core\/templateInstaller\./, /^guardian\.config\.json$/],
    helper: [/^examples\/[^/]+\/guardian\.config\.json$/],
    tests: [/config\.(test|spec)\./, /validator\.(test|spec)\./]
  },
  {
    taskArea: "Analyzer / risk scoring",
    categoryKey: "analyzers",
    primary: [/^src\/analyzers\//, /^analyzers\//],
    related: [/^src\/core\/validator\./, /^src\/core\/.*risk/i],
    helper: [/(^|\/)(analy[sz]er|risk|hotspot|score|rule|validator|security)[^/]*\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php)$/i],
    tests: [/analy[sz]er\.(test|spec)\./, /risk\.(test|spec)\./, /security\.(test|spec)\./]
  },
  {
    taskArea: "Report rendering",
    categoryKey: "reports",
    primary: [/^src\/renderers\//],
    related: [/^src\/core\/repoMapper\./],
    helper: [/^src\/cli\/commands\/(map|suggest|estimate|archive)\./],
    tests: [/(map|report|archive|estimate|suggest)\.(test|spec)\./]
  },
  {
    taskArea: "Repository scanning / classification",
    categoryKey: "scanner",
    primary: [/^src\/repo\//, /^src\/core\/scanner\./],
    related: [/^src\/core\/fileSystem\./, /^src\/core\/contextFiles\./],
    helper: [/symbol/i],
    tests: [/(scan|scanner|symbols?)\.(test|spec)\./]
  },
  {
    taskArea: "Template / context generation",
    categoryKey: "templates",
    primary: [/^src\/templates\//, /^src\/core\/templateInstaller\./],
    related: [/^templates\//],
    helper: [/^src\/project-brain\//],
    tests: [/(template|init)\.(test|spec)\./]
  },
  {
    taskArea: "CI / release workflow",
    categoryKey: "release",
    primary: [/^\.github\/workflows\//],
    related: [/^src\/.*(?:release|deploy|deployment).*\.([cm]?js|jsx|tsx?|mjs)$/i],
    helper: [/^package\.json$/],
    tests: [/release\.(test|spec)\./, /integration\/release\./]
  },
  {
    taskArea: "Tests / fixtures",
    categoryKey: "fixtures",
    primary: [/^tests?\//, /^__tests__\//],
    related: [/fixtures?/i],
    helper: [/__snapshots__|snapshots?/i],
    tests: [/\.(test|spec)\./]
  }
];

function matchesAny(filePath: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(filePath));
}

function isGeneratedOrIgnoredNavigationPath(filePath: string): boolean {
  return filePath.startsWith("docs/ai-context/")
    || filePath.startsWith(".project-brain/metrics/")
    || filePath === ".repo-context-center/config.json"
    || filePath === "package-lock.json"
    || filePath === "pnpm-lock.yaml"
    || filePath === "yarn.lock"
    || filePath.split("/").some((part) => excludedDirs.has(part));
}

function isNormalFirstFileCandidate(filePath: string): boolean {
  return !isGeneratedOrIgnoredNavigationPath(filePath) && !isFixtureOrSnapshotPath(filePath);
}

function uniqueOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function filesByPatternOrder(paths: string[], patterns: RegExp[]): string[] {
  return patterns.flatMap((pattern) => paths.filter((file) => pattern.test(file)));
}

function rankedFirstFiles(definition: FirstFilesDefinition, paths: string[], testFiles: string[]): string[] {
  const normalPaths = definition.categoryKey === "fixtures"
    ? paths
    : paths.filter(isNormalFirstFileCandidate);
  const primarySource = definition.categoryKey === "fixtures"
    ? normalPaths.filter((file) => !isFixtureOrSnapshotPath(file) && isTestPath(file))
    : filesByPatternOrder(normalPaths, definition.primary);
  const related = filesByPatternOrder(normalPaths, definition.related);
  const helper = filesByPatternOrder(normalPaths, definition.helper)
    .filter((file) => definition.categoryKey !== "analyzers" || isAnalyzerPath(file));
  const tests = filesByPatternOrder(testFiles, definition.tests);
  const fixtureOrSnapshot = definition.categoryKey === "fixtures"
    ? paths.filter(isFixtureOrSnapshotPath)
    : [];

  if (definition.categoryKey === "fixtures") {
    return uniqueOrdered([
      ...primarySource.slice(0, 2),
      ...fixtureOrSnapshot,
      ...tests
    ]).slice(0, 4);
  }

  return uniqueOrdered([
    ...primarySource,
    ...related,
    ...helper,
    ...tests,
    ...fixtureOrSnapshot
  ]).slice(0, 4);
}

function buildFirstFiles(files: RepoFile[], understanding: RepositoryUnderstanding): RepoFirstFilesGroup[] {
  const paths = files.map((file) => file.path);

  return firstFilesDefinitions.flatMap((definition) => {
    const category = categories.find((entry) => entry.key === definition.categoryKey);
    const categoryMatches = category
      ? filesForCategory(files, category).map((file) => file.path)
      : [];
    const patternMatches = paths.filter((file) =>
      matchesAny(file, [...definition.primary, ...definition.related, ...definition.helper])
    );
    const tests = understanding.testFiles.filter((file) => matchesAny(file, definition.tests));
    const candidates = uniqueSorted([...categoryMatches, ...patternMatches, ...tests]);
    const selected = rankedFirstFiles(definition, candidates, understanding.testFiles);

    if (selected.length === 0) {
      return [] as RepoFirstFilesGroup[];
    }

    return [{ taskArea: definition.taskArea, files: selected }];
  });
}

function buildTaskRouting(files: RepoFile[], understanding: RepositoryUnderstanding, packageScripts: Set<string>): RepoMapRow[] {
  const hasProjectFiles = files.some((file) => !isContextPath(file.path));
  const testFiles = understanding.testFiles;

  return categories.flatMap((category) => {
    if (category.includeInRouting === false) {
      return [];
    }

    if (category.key === "context" && !hasProjectFiles) {
      return [];
    }

    if (!categoryHasProductionDomainEvidence(files, category)) {
      return [];
    }

    const matches = filesForCategory(files, category)
      .filter((file) => !isContextPath(file.path) || category.key === "context")
      .filter((file) => category.key === "fixtures" || !isFixtureOrSnapshotPath(file.path));
    if (matches.length === 0) {
      return [];
    }

    const primary = primaryFilesForCategory(files, category, 4);
    const tests = testsForCategory(category, primary, testFiles);
    const inspect = primary.length > 0 ? primary : matches.map((file) => file.path).slice(0, 4);

    return [{
      "Task Type": category.taskType,
      "Start With": compactList(inspect),
      "Then Check": category.thenCheck.join(", "),
      Tests: compactList(tests, "none detected", 3),
      Notes: category.notes
    }];
  });
}

function buildModules(files: RepoFile[], understanding: RepositoryUnderstanding, maxModules = 12): RepoModule[] {
  const hasProjectFiles = files.some((file) => !isContextPath(file.path));
  const testFiles = understanding.testFiles;

  return categories
    .map((category) => {
      if (category.key === "context" && !hasProjectFiles) {
        return undefined;
      }

      const primary = primaryFilesForCategory(files, category, 5);
      if (primary.length === 0 && category.key !== "fixtures") {
        return undefined;
      }

      const moduleTests = testsForCategory(category, primary, testFiles).slice(0, 5);

      if (primary.length === 0 && moduleTests.length === 0) {
        return undefined;
      }

      return {
        name: category.label,
        purpose: category.purpose,
        primaryFiles: primary,
        commonTasks: category.commonTasks,
        tests: moduleTests,
        dependencies: dependencyHintsForCategory(category.key, files).slice(0, 5),
        risks: riskHintsForCategory(category.key, primary).slice(0, 4)
      };
    })
    .filter((module): module is RepoModule => module !== undefined)
    .slice(0, maxModules);
}

function buildRisks(files: RepoFile[], testFiles: string[], packageScripts: Set<string>): RepoRisk[] {
  const hasProjectFiles = files.some((file) => !isContextPath(file.path));
  const detected = categories.flatMap((category) => {
    if (category.key === "context" && !hasProjectFiles) {
      return [] as RepoRisk[];
    }

    const defaultRisk = defaultRiskForCategory(category.key);
    const riskWhy = category.riskWhy ?? defaultRisk;
    if (!riskWhy) {
      return [] as RepoRisk[];
    }

    if (!categoryHasProductionDomainEvidence(files, category)) {
      return [] as RepoRisk[];
    }

    const matches = filesForCategory(files, category)
      .filter((file) => !isTestPath(file.path))
      .filter((file) => category.key === "fixtures" || !isFixtureOrSnapshotPath(file.path))
      .map((file) => file.path);
    if (matches.length === 0) {
      return [] as RepoRisk[];
    }

    return [{
      area: `${category.label}: ${compactList(matches, "none", 3)}`,
      why: riskWhy,
      checks: focusedVerificationFor(matches, relatedTests(matches, testFiles))
    }];
  });

  const fixtureFiles = files.filter((file) => isFixtureOrSnapshotPath(file.path)).map((file) => file.path);
  if (fixtureFiles.length > 0) {
    detected.push({
      area: `Fixture/snapshot drift: ${compactList(fixtureFiles, "none", 3)}`,
      why: "Fixtures and expected output can drift from generated map behavior.",
      checks: focusedVerificationFor(fixtureFiles, fixtureFiles.filter(isTestPath))
    });
  }

  return detected.slice(0, 14);
}

function defaultRiskForCategory(key: string): string | undefined {
  const risks: Record<string, string> = {
    cli: "CLI behavior changes can break scripts, help text, JSON output, or exit codes.",
    scanner: "File classification changes can cause future agents to read too much or miss important files.",
    analyzers: "Analyzer and risk-rule changes can misclassify important work or understate risk.",
    reports: "Report rendering changes can break generated markdown, JSON consumers, or marker preservation.",
    templates: "Template changes can propagate stale or oversized context into new repos.",
    fixtures: "Fixture changes can make tests pass while real map output gets worse.",
    context: "Context doc changes affect future agent routing and token use.",
    release: "CI or workflow changes can block validation or release broken packages."
  };
  return risks[key];
}

function dependencyHintsForCategory(key: string, files: RepoFile[]): string[] {
  const paths = files.map((file) => file.path);
  const has = (pattern: RegExp) => paths.some((file) => pattern.test(file));
  const first = (pattern: RegExp) => paths.find((file) => pattern.test(file));
  const existing = (values: Array<string | undefined>): string[] =>
    values.filter((value): value is string => value !== undefined && (paths.includes(value) || value.endsWith("/*") || value === "nearby tests"));
  const area = (prefix: string): string | undefined => has(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`)) ? `${prefix}/*` : undefined;

  const hints: Record<string, string[]> = {
    cli: existing([
      first(/^src\/cli\/commands\//) ?? area("src/cli/commands"),
      first(/^src\/core\//) ?? area("src/core"),
      first(/^src\/core\/config/)
    ]),
    config: existing([
      first(/^src\/core\/config/),
      first(/^src\/core\/templateInstaller/),
      first(/^src\/core\/validator/)
    ]),
    scanner: existing([
      first(/^src\/repo\//),
      first(/^src\/core\/fileSystem/),
      first(/^src\/core\/contextFiles/),
      has(/^tests\//) ? "tests/*" : undefined
    ]),
    analyzers: existing([
      first(/^src\/analyzers\//),
      first(/^src\/core\/validator/),
      first(/^src\/core\/.*risk/i),
      has(/^tests\//) ? "tests/*" : undefined
    ]),
    reports: existing([
      first(/^src\/renderers\//),
      first(/^src\/core\/repoMapper/) ?? "src/core/repoMapper.ts",
      first(/^src\/core\/.*er\.ts$/),
      has(/^tests\//) ? "tests/*" : undefined
    ]),
    core: existing([
      first(/^src\/cli\/commands\//),
      first(/^src\/core\//),
      has(/^tests\//) ? "tests/*" : undefined
    ]),
    templates: existing([
      first(/^src\/core\/templateInstaller/),
      area("src/templates"),
      area("templates"),
      area("docs/ai-context")
    ]),
    fixtures: existing([has(/^tests\//) ? "tests/*" : undefined, area("fixtures"), area("__snapshots__"), area("snapshots")]),
    context: existing([area("docs/ai-context"), area("src/templates/generic"), first(/^src\/core\/repoMapper/)]),
    release: existing([first(/^package\.json$/), area(".github/workflows")])
  };

  return uniqueSorted((hints[key] ?? []).filter(Boolean));
}

function riskHintsForCategory(key: string, files: string[]): string[] {
  const hints: Record<string, string[]> = {
    cli: ["stdout/stderr compatibility", "exit code regressions", "help text drift"],
    config: ["default config drift", "unsafe overwrite behavior"],
    scanner: ["generated files included", "real source files missed"],
    analyzers: ["over-broad warnings", "under-reported risky areas"],
    reports: ["broken generated markers", "unstable markdown ordering"],
    core: ["cross-command regression", "shared behavior drift"],
    templates: ["stale generated defaults", "template/context mismatch"],
    fixtures: ["fixture/snapshot drift"],
    context: ["manual content overwritten", "future agents misrouted"],
    release: ["CI blocked", "release validation skipped"],
    auth: ["permission bypass", "session handling regression"],
    database: ["data loss", "migration rollback gap"]
  };

  const fallback = files.length > 0 ? ["review real callers before editing"] : [];
  return hints[key] ?? fallback;
}

function buildDependencies(files: RepoFile[], understanding: RepositoryUnderstanding): RepoDependency[] {
  const dependencies: RepoDependency[] = [];
  const allPaths = files.map((file) => file.path);
  const firstExisting = (patterns: RegExp[]): string | undefined => {
    for (const pattern of patterns) {
      const found = allPaths.find((file) => pattern.test(file));
      if (found) {
        return found;
      }
    }
    return undefined;
  };
  const firstEntrypoint = (patterns: RegExp[]): string | undefined => {
    for (const pattern of patterns) {
      const found = understanding.entrypoints.find((file) => pattern.test(file));
      if (found) {
        return found;
      }
    }
    return firstExisting(patterns);
  };
  const add = (from: string | undefined, dependsOn: string | undefined, why: string): void => {
    if (from && dependsOn && from !== dependsOn) {
      dependencies.push({ from, dependsOn, why, inferred: true });
    }
  };

  const cliEntrypoint = firstEntrypoint([/^src\/cli\/index\./, /^cli\/index\./, /^src\/cli\//]);
  add(cliEntrypoint, firstExisting([/^src\/core\/config\./, /^src\/config\//]), "CLI loads repository configuration before command behavior");
  add(cliEntrypoint, firstExisting([/^src\/core\/guardian\./, /^src\/core\/repoMapper\./, /^src\/core\/index\./]), "CLI delegates repository work to core modules");
  add(cliEntrypoint, firstExisting([/^src\/renderers\//]), "CLI output may be formatted by renderer modules");

  const coreModel = firstExisting([
    /^src\/core\/guardian\./,
    /^src\/core\/repoMapper\./,
    /^src\/core\/.*(?:map|report|guidance|decision|types)/i,
    /^src\/core\/index\./
  ]);
  add(coreModel, firstExisting([/^src\/analyzers\//]), "core mapping coordinates analyzer and risk-rule results");
  add(coreModel, firstExisting([/^src\/repo\//, /^src\/core\/scanner\./]), "core mapping consumes repository scanning/classification");
  add(coreModel, firstExisting([/^src\/core\/config\./, /^src\/config\//]), "core behavior is driven by configuration");

  const analyzer = firstExisting([/^src\/analyzers\//, /(^|\/)(analy[sz]er|risk|hotspot|score|rule|validator|security)[^/]*\.(ts|tsx|js|jsx|mjs|cjs)$/i]);
  add(analyzer, firstExisting([/^src\/config\//, /^src\/core\/config\./, /^guardian\.config\.json$/]), "analyzers read configuration rules when present");

  const renderer = firstExisting([/^src\/renderers\//]);
  add(renderer, coreModel, "renderers format the core report model");

  const testContext = understanding.ignoredAreas.find((ignored) => ignored.reason === "fixture" || ignored.reason === "snapshot");
  add(understanding.testFiles[0], testContext?.path, "tests use fixtures or snapshots only as test context");

  const seen = new Set<string>();
  return dependencies.filter((dependency) => {
    const key = `${dependency.from}->${dependency.dependsOn}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, 16);
}

function topHotspotFiles(values: string[], limit: number): string[] {
  return values.filter((value, index) => values.indexOf(value) === index).slice(0, limit);
}

function coreHotspotRank(filePath: string): number {
  if (/^src\/core\/guardian\./.test(filePath) || /^src\/core\/repoMapper\./.test(filePath)) {
    return 0;
  }
  if (/^src\/core\/reportDecisionSupport\./.test(filePath)) {
    return 1;
  }
  if (/^src\/core\/actionableGuidance\./.test(filePath)) {
    return 2;
  }
  if (/^src\/core\/baseline\./.test(filePath)) {
    return 3;
  }
  return 9;
}

function symbolUse(symbol: ScannedSymbol): string {
  if (/config|load|parse/i.test(symbol.name)) {
    return "configuration or parsing entrypoint";
  }
  if (/route|router|handler|command/i.test(symbol.name)) {
    return "routing or command entrypoint";
  }
  if (/service/i.test(symbol.name)) {
    return "service boundary";
  }
  if (/repo|repository/i.test(symbol.name)) {
    return "data access boundary";
  }
  if (/scan|map|suggest|validate|estimate|archive/i.test(symbol.name)) {
    return "analysis or report behavior";
  }
  return `${symbol.kind} exported from source`;
}

async function buildSymbols(cwd: string, sourceFiles: string[], symbolLimit: number): Promise<RepoSymbol[]> {
  const symbols: RepoSymbol[] = [];

  for (const sourceFile of sourceFiles) {
    if (symbols.length >= symbolLimit) {
      break;
    }

    let content = "";
    try {
      content = (await readTextFile(path.join(cwd, sourceFile))).slice(0, textReadLimit);
    } catch {
      continue;
    }

    const exported = extractExportedSymbols(sourceFile, content)
      .filter((symbol) => /command|config|load|route|router|service|repo|repository|scan|map|suggest|validate|estimate|archive|auth|session/i.test(symbol.name)
        || symbol.kind === "class"
        || symbol.kind === "function")
      .slice(0, Math.max(0, symbolLimit - symbols.length));

    symbols.push(...exported.map((symbol) => ({
      symbol: symbol.name,
      file: sourceFile,
      use: symbolUse(symbol)
    })));
  }

  return symbols;
}

async function fileSize(cwd: string, filePath: string): Promise<number> {
  try {
    const fs = await import("node:fs/promises");
    const fileStat = await fs.stat(path.join(cwd, filePath));
    return fileStat.size;
  } catch {
    return 0;
  }
}

function sourceLikeHotspotPath(filePath: string): boolean {
  return !isDocumentationPath(filePath)
    && !isContextPath(filePath)
    && !isFixtureOrSnapshotPath(filePath)
    && !filePath.split("/").some((part) => excludedDirs.has(part))
    && sourceExtensions.has(path.extname(filePath).toLowerCase());
}

function packageSourceHotspotFiles(allPaths: string[], understanding: RepositoryUnderstanding): string[] {
  const packageDirs = understanding.keyDirectories
    .map((directory) => directory.match(/^`([^`]+)` - primary package\/source code$/)?.[1])
    .filter((directory): directory is string => directory !== undefined);

  return packageDirs.flatMap((directory) =>
    allPaths.filter((file) => file.startsWith(`${directory}/`) && sourceLikeHotspotPath(file))
  );
}

function scriptHotspotFiles(allPaths: string[]): string[] {
  return allPaths.filter((file) => file.startsWith("scripts/") && sourceLikeHotspotPath(file));
}

async function buildHotspots(
  cwd: string,
  files: RepoFile[],
  understanding: RepositoryUnderstanding,
  risks: RepoRisk[],
  dependencies: RepoDependency[],
  packageScripts: Set<string>
): Promise<RepoHotspot[]> {
  const dependentCounts = new Map<string, number>();
  for (const dependency of dependencies) {
    dependentCounts.set(dependency.dependsOn, (dependentCounts.get(dependency.dependsOn) ?? 0) + 1);
  }

  const riskyPaths = new Set(risks.flatMap((risk) => [...risk.area.matchAll(/`([^`]+)`/g)].map((match) => match[1])));
  const allPaths = files.map((file) => file.path);
  const hasSourceOrTests = allPaths.some((file) => sourceLikeHotspotPath(file) || isTestPath(file));
  const highImpactGroups = [
    understanding.entrypoints.filter((file) => allPaths.includes(file)),
    topHotspotFiles(packageSourceHotspotFiles(allPaths, understanding), 4),
    topHotspotFiles(
      allPaths
        .filter((file) => /^src\/core\/(guardian|repoMapper|reportDecisionSupport|actionableGuidance|baseline|types)\.[^.]+$/.test(file))
        .sort((left, right) => {
          const rankDiff = coreHotspotRank(left) - coreHotspotRank(right);
          return rankDiff === 0 ? left.localeCompare(right) : rankDiff;
        }),
      2
    ),
    topHotspotFiles(allPaths.filter((file) => /^src\/core\/config\.[^.]+$/.test(file) || file.startsWith("src/config/")), 2),
    topHotspotFiles(allPaths.filter((file) => isAnalyzerPath(file)), 2),
    topHotspotFiles(allPaths.filter((file) => file.startsWith("src/renderers/") || /^src\/core\/repoMapper\.[^.]+$/.test(file)), 2),
    topHotspotFiles(allPaths.filter((file) => isScannerPath(file)), 1),
    topHotspotFiles(scriptHotspotFiles(allPaths), 2),
    topHotspotFiles(understanding.testFiles.filter((file) => allPaths.includes(file)), 2),
    topHotspotFiles(allPaths.filter((file) => file.startsWith(".github/workflows/")), 2),
    topHotspotFiles(allPaths.filter((file) => isTemplatePath(file) || file.startsWith("src/project-brain/")), 2),
    [...dependentCounts.entries()].filter(([, count]) => count > 1).map(([file]) => file),
    allPaths.filter((file) => riskyPaths.has(file)),
    allPaths.includes("package.json") ? ["package.json"] : []
  ];
  const candidates = highImpactGroups
    .flat()
    .filter((file) => allPaths.includes(file))
    .filter((file) => !isLowValueHotspotPath(file, hasSourceOrTests));

  const rows: RepoHotspot[] = [];
  const seen = new Set<string>();
  for (const file of candidates) {
    if (rows.length >= 12) {
      break;
    }
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);

    const size = await fileSize(cwd, file);
    const checks = verificationFor([file], findMatchingTestFiles(file, understanding.testFiles), packageScripts).split("; ");
    const reasons = [
      understanding.entrypoints.includes(file) ? "CLI or package entrypoint" : "",
      riskyPaths.has(file) ? "risky area" : "",
      (dependentCounts.get(file) ?? 0) > 1 ? "multiple local dependents" : "",
      size > 20_000 ? "large central file" : "",
      isCoreOrchestrationPath(file) ? "core orchestration or shared model" : "",
      /^src\/core\/config\.[^.]+$/.test(file) || file.startsWith("src/config/") ? "configuration loader or defaults" : "",
      isAnalyzerPath(file) ? "analyzer or risk scoring" : "",
      file.startsWith("src/renderers/") || /^src\/core\/repoMapper\.[^.]+$/.test(file) ? "report rendering or map model" : "",
      isScannerPath(file) ? "repository scanner or classifier" : "",
      file.startsWith("scripts/") ? "automation or maintenance script" : "",
      isTestPath(file) ? "test coverage or regression case" : "",
      file.startsWith(".github/workflows/") ? "CI or release workflow" : "",
      isTemplatePath(file) || file.startsWith("src/project-brain/") ? "template or context generator" : "",
      file === "package.json" ? "package scripts and release metadata" : ""
    ].filter(Boolean);

    rows.push({
      file,
      why: reasons.join(", ") || "central inferred path",
      checks
    });
  }

  return rows;
}

function firstProjectCheck(risk: RepoRisk, understanding: RepositoryUnderstanding): string {
  if (understanding.scripts.build) {
    return "npm run build";
  }
  if (understanding.scripts.lint) {
    return "npm run lint";
  }
  if (understanding.scripts.test) {
    return "npm test";
  }
  if (understanding.scripts.coverage) {
    return "npm run coverage";
  }

  return risk.checks[0] ?? "focused review";
}

function projectPurpose(understanding: RepositoryUnderstanding): string {
  if (understanding.readmePurpose) {
    return understanding.readmePurpose;
  }
  if (understanding.packageDescription) {
    return understanding.packageDescription;
  }
  if (understanding.packageName) {
    return `${understanding.packageName} repository.`;
  }
  return "Repository purpose not declared in package metadata or README.";
}

function isNoisePath(filePath: string): boolean {
  return isFixtureOrSnapshotPath(filePath)
    || filePath.startsWith("docs/ai-context/archive/")
    || filePath.split("/").some((part) => excludedDirs.has(part));
}

function understandingQuality(understanding: RepositoryUnderstanding): RepoUnderstandingQuality {
  const signalEntrypoints = understanding.entrypoints.filter((file) => !isNoisePath(file)).length;
  const signalKeyDirectories = understanding.keyDirectories.filter((directory) =>
    !/^`?tests?\b/.test(directory) || understanding.testFiles.length > 0
  ).length;
  const signalModules = understanding.modules.filter((module) => !isNoisePath(module.path)).length;
  const keyDirectoriesDetected = understanding.keyDirectories.length;
  const modulesDetected = understanding.modules.length;
  const hasSourceSignals = signalModules > 0
    || understanding.keyDirectories.some((directory) => /`(?:src|lib|libs|packages|apps|services)(?:\/|`)/.test(directory));
  const hasWorkflowSignals = understanding.keyDirectories.some((directory) => directory.startsWith("`.github/workflows`"));
  const hasTestSignals = understanding.testFiles.length > 0;
  const hasHighSignals = signalEntrypoints > 0 && signalKeyDirectories >= 4 && signalModules >= 4;
  const hasMediumSignals = signalEntrypoints > 0 && (signalKeyDirectories >= 2 || signalModules >= 2)
    || (hasSourceSignals && hasTestSignals && hasWorkflowSignals)
    || signalKeyDirectories >= 3
    || signalModules >= 3;
  const level: RepoUnderstandingLevel = hasHighSignals ? "High" : hasMediumSignals ? "Medium" : "Low";

  return {
    level,
    entrypointsDetected: understanding.entrypoints.length,
    keyDirectoriesDetected,
    modulesDetected,
    dependencyHintsMode: "Conservative",
    noiseFilteringStatus: understanding.ignoredAreas.length > 0
      ? `Active (${understanding.ignoredAreas.length} ignored/noise areas separated)`
      : "Active (no ignored/noise areas detected)"
  };
}

function buildProjectMap(
  files: RepoFile[],
  testFiles: string[],
  risks: RepoRisk[],
  doNotRead: string[],
  understanding: RepositoryUnderstanding
): RepoMapData["projectMap"] {
  const entrypoints = understanding.entrypoints.slice(0, 8);
  const configCategory = categories.find((category) => category.key === "config");
  const config = configCategory
    ? primaryFilesForCategory(files, configCategory, 8)
    : files.filter((file) => isConfigPath(file.path)).map((file) => file.path).slice(0, 8);
  const cliEntrypoints = entrypoints.filter((file) => file.startsWith("src/cli/"));
  const coreEntrypoints = files.filter((file) => file.path.startsWith("src/core/")).map((file) => file.path).slice(0, 4);

  return {
    purpose: projectPurpose(understanding),
    keyDirectories: understanding.keyDirectories.length > 0
      ? understanding.keyDirectories
      : ["No standard source roots detected"],
    entrypoints,
    config,
    tests: testFiles.slice(0, 8),
    executionFlow: [
      cliEntrypoints.length > 0
        ? `CLI starts in ${compactList(cliEntrypoints, "CLI entrypoint", 2)}`
        : "CLI entrypoint not detected",
      coreEntrypoints.length > 0
        ? `Commands delegate to ${compactList(coreEntrypoints, "core modules", 4)}`
        : "Core command modules not detected",
      testFiles.length > 0
        ? `Behavior is checked by ${compactList(testFiles, "tests", 4)}`
        : "No tests detected"
    ],
    ignoredAreas: doNotRead,
    understandingQuality: understandingQuality(understanding),
    productionCriticalFlows: risks.map((risk) => ({
      Flow: risk.area,
      "Why critical": risk.why,
      "First check": firstProjectCheck(risk, understanding)
    }))
  };
}

function buildDoNotRead(files: RepoFile[]): string[] {
  const topLevel = new Set(files.map((file) => file.parts[0] ?? ""));
  return uniqueSorted([
    ...baseDoNotRead,
    ...[...excludedDirs].filter((folder) => topLevel.has(folder)),
    ...files
      .filter((file) => isFixtureOrSnapshotPath(file.path))
      .map((file) => path.posix.dirname(file.path))
      .filter((folder) => folder !== "."),
    ...files
      .filter((file) => isGeneratedAsset(file.path))
      .map((file) => path.posix.dirname(file.path))
      .filter((folder) => folder !== ".")
  ]);
}

function buildTokenBudget(filesScanned: number, modules: RepoModule[], risks: RepoRisk[]): RepoMapRow[] {
  const repoSize = filesScanned < 50 ? "small" : filesScanned < 300 ? "medium" : "large";
  const compactMax = repoSize === "small" ? "8" : repoSize === "medium" ? "12" : "16";
  const investigationMax = repoSize === "small" ? "16" : repoSize === "medium" ? "24" : "32";
  const detailedMax = repoSize === "small" ? "30" : repoSize === "medium" ? "45" : "60";
  const moduleNames = modules.slice(0, 3).map((module) => module.name);

  return [
    {
      Mode: "Compact Mode",
      "Use when": "small localized task",
      "Read first": "AGENTS.md, TASK_ROUTING.md, one MODULE_INDEX section",
      "Max files": compactMax
    },
    {
      Mode: "Investigation Mode",
      "Use when": risks.length > 0 ? "risk, auth, data, release, or bug task" : "bug or unclear task",
      "Read first": "RISK_REGISTER.md, HOTSPOTS.md, DEPENDENCY_MAP.md",
      "Max files": investigationMax
    },
    {
      Mode: "Detailed Mode",
      "Use when": "cross-module refactor or broad behavior change",
      "Read first": moduleNames.length > 0 ? `${moduleNames.join(", ")} sections plus targeted source/tests` : "PROJECT_MAP.md plus targeted source/tests",
      "Max files": detailedMax
    }
  ];
}

function table(headers: string[], rows: RepoMapRow[]): string {
  if (rows.length === 0) {
    return "_No repo-specific rows detected._";
  }

  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => row[header] || "none").join(" | ")} |`)
  ].join("\n");
}

function bullets(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- none detected";
}

function renderGenerated(title: string, body: string): string {
  return `${generatedStart}\n## Generated Repo Map\n\n${body.trim()}\n\n_Generated by repo-context-center. Edit outside this section._\n${generatedEnd}`;
}

function upsertGeneratedSection(existing: string | undefined, title: string, body: string): string {
  const safeExisting = sanitizeGenericPlaceholders(existing);
  const section = renderGenerated(title, body);
  if (!safeExisting || safeExisting.trim().length === 0) {
    return `# ${title}\n\n${section}\n`;
  }

  const start = safeExisting.indexOf(generatedStart);
  const end = safeExisting.indexOf(generatedEnd);
  if (start !== -1 && end !== -1 && end > start) {
    const before = safeExisting.slice(0, start).trimEnd();
    const after = safeExisting.slice(end + generatedEnd.length).trimStart();
    return `${before}\n\n${section}${after ? `\n\n${after.trimEnd()}` : ""}\n`;
  }

  return `${safeExisting.trimEnd()}\n\n${section}\n`;
}

function sanitizeGenericPlaceholders(existing: string | undefined): string | undefined {
  if (!existing) {
    return existing;
  }

  const placeholderPatterns = [
    /`src\/\.\.\.`/,
    /`path\/or\/flow`/,
    /`module\/package`/
  ];

  return existing
    .split(/\r?\n/)
    .filter((line) => !placeholderPatterns.some((pattern) => pattern.test(line)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function renderTaskRouting(data: RepoMapData): string {
  const firstFiles = table(["Task Area", "Open First"], data.firstFiles.map((group) => ({
    "Task Area": group.taskArea,
    "Open First": compactOrderedList(group.files, "none detected", 4)
  })));

  return [
    "### First Files to Open",
    firstFiles,
    "",
    "### Task Routing",
    table(["Task Type", "Start With", "Then Check", "Tests", "Notes"], data.taskRouting)
  ].join("\n");
}

function renderModules(data: RepoMapData): string {
  if (data.modules.length === 0) {
    return "_No repo-specific modules detected._";
  }

  return data.modules.map((module) => [
    `## ${module.name}`,
    `- Purpose: ${module.purpose}.`,
    `- Primary files: ${compactOrderedList(module.primaryFiles, "none", module.name === "Context docs" ? 5 : 4)}.`,
    `- Common tasks: ${module.commonTasks.join(", ")}.`,
    `- Related tests: ${compactList(module.tests, "none detected")}.`,
    `- Dependency hints: ${compactPlainList(module.dependencies)}.`,
    `- Risks: ${compactPlainList(module.risks)}.`
  ].join("\n")).join("\n\n");
}

function renderProjectMap(data: RepoMapData): string {
  const quality = data.projectMap.understandingQuality;

  return [
    "### Main Purpose",
    data.projectMap.purpose,
    "",
    "### Key Directories",
    bullets(data.projectMap.keyDirectories),
    "",
    "### Startup / Entrypoints",
    bullets(data.projectMap.entrypoints.map((file) => `\`${file}\``)),
    "",
    "### Repository Understanding Quality",
    table(["Signal", "Value"], [
      { Signal: "Repo understanding level", Value: quality.level },
      { Signal: "Entrypoints detected", Value: String(quality.entrypointsDetected) },
      { Signal: "Key directories detected", Value: String(quality.keyDirectoriesDetected) },
      { Signal: "Modules detected", Value: String(quality.modulesDetected) },
      { Signal: "Dependency hints mode", Value: quality.dependencyHintsMode },
      { Signal: "Generated/noise filtering", Value: quality.noiseFilteringStatus }
    ]),
    "",
    "### Main Execution Flow",
    bullets(data.projectMap.executionFlow),
    "",
    "### Config",
    bullets(data.projectMap.config.map((file) => `\`${file}\``)),
    "",
    "### Tests",
    bullets(data.projectMap.tests.map((file) => `\`${file}\``)),
    "",
    "### Generated / Ignored Areas",
    bullets(data.projectMap.ignoredAreas.map((file) => `\`${file.replace(/\/$/, "")}/\``)),
    "",
    "### Production-Critical Flows",
    table(["Flow", "Why critical", "First check"], data.projectMap.productionCriticalFlows)
  ].join("\n");
}

function renderRisks(data: RepoMapData): string {
  return [
    "### Default Checks",
    bullets(data.riskDefaultChecks.map((check) => `\`${check}\``)),
    "",
    "### Focused Risks",
    table(["Area", "Why risky", "Focused checks"], data.risks.map((risk) => ({
      Area: risk.area,
      "Why risky": risk.why,
      "Focused checks": risk.checks.join("; ")
    })))
  ].join("\n");
}

function renderDependencies(data: RepoMapData): string {
  return table(["From", "Depends on", "Why"], data.dependencies.map((dependency) => ({
    From: `\`${dependency.from}\``,
    "Depends on": `\`${dependency.dependsOn}\``,
    Why: dependency.inferred ? `${dependency.why} (inferred)` : dependency.why
  })));
}

function renderSymbols(data: RepoMapData): string {
  return table(["Symbol", "File", "Use"], data.symbols.map((symbol) => ({
    Symbol: `\`${symbol.symbol}\``,
    File: `\`${symbol.file}\``,
    Use: symbol.use
  })));
}

function renderHotspots(data: RepoMapData): string {
  return table(["File", "Why hot", "Checks"], data.hotspots.map((hotspot) => ({
    File: `\`${hotspot.file}\``,
    "Why hot": hotspot.why,
    Checks: hotspot.checks.join("; ")
  })));
}

function renderTokenBudget(data: RepoMapData): string {
  return [
    `Repo size estimate: ${data.filesScanned} scanned files.`,
    "",
    table(["Mode", "Use when", "Read first", "Max files"], data.tokenBudget),
    "",
    "Suggested max files: Compact 8-16, Investigation 16-32, Detailed 30-60.",
    "",
    "Do not read generated, fixture, snapshot, archive, or lockfile content unless the task specifically needs it.",
    "",
    "Escalate only when routing, module maps, and targeted tests leave a concrete unknown."
  ].join("\n");
}

function renderDoNotRead(data: RepoMapData): string {
  return data.doNotRead.map((folder) => `- \`${folder.replace(/\/$/, "")}/\``).join("\n");
}

function renderCommunication(data: RepoMapData): string {
  return data.communicationNotes.length > 0
    ? data.communicationNotes.map((note) => `- ${note}`).join("\n")
    : "- No project-specific risk modes detected.";
}

function renderLessons(data: RepoMapData): string {
  return data.lessonsPlaceholder.join("\n");
}

function renderChangeLog(data: RepoMapData): string {
  return table(["Date", "Command", "Files updated", "Reason"], [{
    Date: data.generatedAt,
    Command: "`repo-context-center map --write`",
    "Files updated": `${requiredContextFiles.length} context files`,
    Reason: "generated repo-specific context map"
  }]);
}

function renderAgents(): string {
  return [
    "Repo Context Center startup.",
    "",
    "Before a task:",
    "- Shell: `npx repo-context-center start \"<task>\"`.",
    "- Use output for docs, files, tests, risk, instructions.",
    "- No shell: read `docs/ai-context/TASK_ROUTING.md`, `docs/ai-context/MODULE_INDEX.md`, `docs/ai-context/TOKEN_BUDGET.md`, `docs/ai-context/DO_NOT_READ.md`.",
    "- Verify source before editing.",
    "- After meaningful changes: `npx repo-context-center log \"<summary>\" --files <paths>`.",
    "",
    "Read:",
    "1. `docs/ai-context/COMMUNICATION_MODE.md`",
    "2. `docs/ai-context/TASK_ROUTING.md`",
    "3. `docs/ai-context/TOKEN_BUDGET.md`",
    "4. `docs/ai-context/DO_NOT_READ.md`",
    "",
    "Use `TASK_ROUTING.md` before opening repo files.",
    "",
    "Modes:",
    "- Compact: default for small localized tasks.",
    "- Investigation: security/auth, release, migrations, high-risk bugs.",
    "- Detailed: explicit request or broad cross-module change.",
    "",
    "On demand:",
    "- `MODULE_INDEX.md`",
    "- `PROJECT_MAP.md`",
    "- `DEPENDENCY_MAP.md`",
    "- `RISK_REGISTER.md`",
    "- `HOTSPOTS.md`",
    "- `SYMBOL_MAP.md`",
    "- `LESSONS_LEARNED.md`",
    "",
    "Skip:",
    "- `docs/ai-context/archive/*`",
    "- paths in `DO_NOT_READ.md`",
    "- `.repo-context-center/config.json` unless debugging install",
    "",
    "Code is source of truth."
  ].join("\n");
}

const renderers: Record<RequiredContextFile, { title: string; render: (data: RepoMapData) => string }> = {
  "AGENTS.md": {
    title: "AGENTS.md",
    render: renderAgents
  },
  "docs/ai-context/COMMUNICATION_MODE.md": { title: "Communication Mode", render: renderCommunication },
  "docs/ai-context/TASK_ROUTING.md": { title: "Task Routing", render: renderTaskRouting },
  "docs/ai-context/MODULE_INDEX.md": { title: "Module Index", render: renderModules },
  "docs/ai-context/PROJECT_MAP.md": { title: "Project Map", render: renderProjectMap },
  "docs/ai-context/RISK_REGISTER.md": { title: "Risk Register", render: renderRisks },
  "docs/ai-context/DEPENDENCY_MAP.md": { title: "Dependency Map", render: renderDependencies },
  "docs/ai-context/SYMBOL_MAP.md": { title: "Symbol Map", render: renderSymbols },
  "docs/ai-context/TOKEN_BUDGET.md": { title: "Token Budget", render: renderTokenBudget },
  "docs/ai-context/DO_NOT_READ.md": { title: "Do Not Read", render: renderDoNotRead },
  "docs/ai-context/HOTSPOTS.md": { title: "Hotspots", render: renderHotspots },
  "docs/ai-context/LESSONS_LEARNED.md": {
    title: "Lessons Learned",
    render: renderLessons
  },
  "docs/ai-context/CHANGE_LOG.md": { title: "Change Log", render: renderChangeLog }
};

async function buildMapData(cwd: string, maxFiles: number): Promise<RepoMapData> {
  const files = await walkRepo(cwd, maxFiles);
  const understanding = await buildRepositoryUnderstanding({ cwd, files: files.map((file) => file.path) });
  const packageScripts = new Set(Object.keys(understanding.scripts));
  const sourceFiles = files.filter((file) => isSourcePath(file.path)).map((file) => file.path);
  const testFiles = understanding.testFiles;
  const modules = buildModules(files, understanding);
  const risks = buildRisks(files, testFiles, packageScripts);
  const dependencies = buildDependencies(files, understanding);
  const symbolLimit = maxFiles === defaultMaxFiles ? 30 : Math.min(maxFiles, 30);
  const symbolSourceFiles = sourceFiles.filter((file) => !isFixtureOrSnapshotPath(file));
  const symbols = await buildSymbols(cwd, symbolSourceFiles.slice(0, maxFiles), symbolLimit);
  const hotspots = await buildHotspots(cwd, files, understanding, risks, dependencies, packageScripts);
  const doNotRead = buildDoNotRead(files);

  return {
    root: cwd,
    generatedAt: todayIso(),
    filesScanned: files.length,
    riskDefaultChecks: defaultVerificationChecks(packageScripts),
    firstFiles: buildFirstFiles(files, understanding),
    taskRouting: buildTaskRouting(files, understanding, packageScripts),
    modules,
    projectMap: buildProjectMap(files, testFiles, risks, doNotRead, understanding),
    risks,
    dependencies,
    symbols,
    hotspots,
    doNotRead,
    tokenBudget: buildTokenBudget(files.length, modules, risks),
    communicationNotes: risks.length > 0
      ? [`Use Investigation Mode for ${risks.map((risk) => risk.area.split(":")[0]).join(", ")} tasks.`]
      : [],
    lessonsPlaceholder: ["No generated lessons yet. Add stable lessons manually after repeated issues."]
  };
}

async function buildChanges(cwd: string, data: RepoMapData): Promise<RepoMapChange[]> {
  const changes: RepoMapChange[] = [];

  for (const file of requiredContextFiles) {
    const targetPath = path.join(cwd, file);
    const renderer = renderers[file];
    const existing = (await pathExists(targetPath)) ? await readTextFile(targetPath) : undefined;
    const content = upsertGeneratedSection(existing, renderer.title, renderer.render(data));
    changes.push({
      path: file,
      action: existing === undefined ? "create" : "update",
      content
    });
  }

  return changes;
}

function generatedSection(content: string): string | undefined {
  const start = content.indexOf(generatedStart);
  const end = content.indexOf(generatedEnd);

  if (start === -1 || end === -1 || end <= start) {
    return undefined;
  }

  return content.slice(start, end + generatedEnd.length);
}

function isGeneratedChangeCurrent(existing: string | undefined, proposed: string): boolean {
  if (existing === undefined) {
    return false;
  }

  const existingGenerated = generatedSection(existing);
  const proposedGenerated = generatedSection(proposed);

  if (existingGenerated !== undefined && proposedGenerated !== undefined) {
    return existingGenerated === proposedGenerated;
  }

  return existing === proposed;
}

async function staleChanges(cwd: string, changes: RepoMapChange[]): Promise<RepoMapChange[]> {
  const stale: RepoMapChange[] = [];

  for (const change of changes) {
    const targetPath = path.join(cwd, change.path);
    const existing = (await pathExists(targetPath)) ? await readTextFile(targetPath) : undefined;
    if (!isGeneratedChangeCurrent(existing, change.content)) {
      stale.push(change);
    }
  }

  return stale;
}

export async function mapRepository(options: RepoMapOptions): Promise<RepoMapResult> {
  if (!Number.isInteger(options.maxFiles) || options.maxFiles < 1) {
    throw new Error("--max-files must be a positive integer");
  }

  const data = await buildMapData(options.cwd, options.maxFiles);
  const changes = await buildChanges(options.cwd, data);
  const written: string[] = [];

  if (options.write && !options.dryRun) {
    for (const change of changes) {
      const targetPath = path.join(options.cwd, change.path);
      await ensureDir(path.dirname(targetPath));
      await writeTextFile(targetPath, change.content);
      written.push(change.path);
    }
  }

  return { data, changes, written };
}

export async function checkRepositoryMap(options: Pick<RepoMapOptions, "cwd" | "maxFiles">): Promise<RepoMapCheckResult> {
  if (!Number.isInteger(options.maxFiles) || options.maxFiles < 1) {
    throw new Error("--max-files must be a positive integer");
  }

  const data = await buildMapData(options.cwd, options.maxFiles);
  const changes = await buildChanges(options.cwd, data);
  return {
    data,
    changes,
    staleChanges: await staleChanges(options.cwd, changes)
  };
}

export function generatedMarkers(): { start: string; end: string } {
  return { start: generatedStart, end: generatedEnd };
}
