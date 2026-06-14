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

export interface RepoMapData {
  root: string;
  generatedAt: string;
  filesScanned: number;
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
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
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

  return /\.(test|spec)\.(ts|js)$/i.test(filePath)
    || /(^|\/)(tests?|__tests__|e2e|cypress)\/.*integration.*\.(ts|js)$/i.test(filePath)
    || /(^|\/)integration-tests?\/.*\.(ts|js)$/i.test(filePath);
}

function isSourcePath(filePath: string): boolean {
  return sourceRoots.some((root) => filePath === root || filePath.startsWith(`${root}/`))
    && !isTestPath(filePath)
    && sourceExtensions.has(path.extname(filePath).toLowerCase());
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
  return /(^|\/)(__snapshots__|snapshots?|fixtures?)(\/|$)/i.test(filePath);
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
  return filePath.startsWith("src/analyzers/")
    || /(^|\/)(analy[sz]er|risk|hotspot|score|rule|validator|security)[^/]*\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath);
}

function isScannerPath(filePath: string): boolean {
  return filePath.startsWith("src/repo/")
    || /(^|\/)(scan|scanner|symbol|symbols|fileSystem|contextFiles)[^/]*\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath);
}

function isCoreOrchestrationPath(filePath: string): boolean {
  return filePath.startsWith("src/core/");
}

async function walkRepo(cwd: string, maxFiles: number): Promise<RepoFile[]> {
  const files: RepoFile[] = [];

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
        files.push({
          path: normalized,
          parts: normalized.split("/"),
          ext: path.extname(normalized).toLowerCase()
        });
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
    checks.push(`node --test ${tests.slice(0, 2).join(" ")}`);
  } else if (packageScripts.has("test")) {
    checks.push("npm test");
  }
  if (packageScripts.has("lint")) {
    checks.push("npm run lint");
  }
  if (checks.length === 0 && files.length > 0) {
    checks.push(`review ${files.slice(0, 2).join(", ")}`);
  }
  return checks.join("; ") || "focused manual review";
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
    match: (file) => isConfigPath(file.path) || pathHas(file, ["config", "validate", "validator"])
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

    const matches = filesForCategory(files, category)
      .filter((file) => !isTestPath(file.path))
      .map((file) => file.path);
    if (matches.length === 0) {
      return [] as RepoRisk[];
    }

    return [{
      area: `${category.label}: ${compactList(matches, "none", 3)}`,
      why: riskWhy,
      checks: verificationFor(matches, relatedTests(matches, testFiles), packageScripts).split("; ")
    }];
  });

  const fixtureFiles = files.filter((file) => isFixtureOrSnapshotPath(file.path) || isTestPath(file.path)).map((file) => file.path);
  if (fixtureFiles.length > 0) {
    detected.push({
      area: `Fixture/snapshot drift: ${compactList(fixtureFiles, "none", 3)}`,
      why: "Fixtures and expected output can drift from generated map behavior.",
      checks: verificationFor(fixtureFiles, fixtureFiles.filter(isTestPath), packageScripts).split("; ")
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

async function buildDependencies(files: RepoFile[], sourceFiles: string[], testFiles: string[]): Promise<RepoDependency[]> {
  const dependencies: RepoDependency[] = [];
  const allPaths = files.map((file) => file.path);
  const sourceSet = new Set(sourceFiles);
  const firstExisting = (patterns: RegExp[]): string | undefined =>
    allPaths.find((file) => patterns.some((pattern) => pattern.test(file)));
  const add = (from: string | undefined, dependsOn: string | undefined, why: string): void => {
    if (from && dependsOn && from !== dependsOn) {
      dependencies.push({ from, dependsOn, why, inferred: true });
    }
  };

  for (const cliFile of sourceFiles.filter((file) => file.startsWith("src/cli/")).slice(0, 6)) {
    add(cliFile, firstExisting([/^src\/core\/config/, /^src\/core\//]), "CLI command likely delegates to core/config behavior");
  }

  for (const coreFile of sourceFiles.filter((file) => file.startsWith("src/core/")).slice(0, 8)) {
    add(coreFile, firstExisting([/^src\/core\/contextFiles/, /^src\/core\/fileSystem/]), "core modules share context/file helpers");
  }

  for (const reportFile of sourceFiles.filter((file) => /map|suggest|estimate|archive|report/i.test(file)).slice(0, 8)) {
    add(reportFile, firstExisting([/^src\/core\/.*\.ts$/, /^src\/cli\/commands\//]), "report output depends on core model and command formatting");
  }

  for (const authFile of sourceFiles.filter((file) => /auth|session|security|consent/i.test(file)).slice(0, 5)) {
    add(authFile, firstExisting([/^src\/db\//, /db|database|store|repo/i]), "auth/security path likely touches persistence or session state");
  }

  for (const testFile of testFiles.slice(0, 8)) {
    add(testFile, firstExisting([/fixtures?\//, /__snapshots__|snapshots?/, /^src\//]), "tests depend on fixtures, snapshots, or target source");
  }

  if (dependencies.length === 0 && sourceFiles.length > 0) {
    add(sourceFiles[0], sourceFiles.find((file) => file !== sourceFiles[0] && sourceSet.has(file)), "path heuristic fallback; verify before relying on it");
  }

  const seen = new Set<string>();
  return dependencies.filter((dependency) => {
    const key = `${dependency.from}->${dependency.dependsOn}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, 24);
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

async function buildHotspots(
  cwd: string,
  files: RepoFile[],
  sourceFiles: string[],
  testFiles: string[],
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
  const candidates = uniqueSorted([
    ...sourceFiles.filter((file) => riskyPaths.has(file)),
    ...[...dependentCounts.entries()].filter(([, count]) => count > 1).map(([file]) => file),
    ...allPaths.filter((file) => /(^src\/cli\/index|config|workflow|deploy|auth|session|migration|payment|coupon|reward|scanner|mapper|renderer|classifier)/i.test(file)),
    "package.json",
    ...allPaths.filter((file) => file.startsWith(".github/workflows/"))
  ]).filter((file) => allPaths.includes(file) || file === "package.json");

  const rows: RepoHotspot[] = [];
  for (const file of candidates.slice(0, 12)) {
    const size = await fileSize(cwd, file);
    const checks = verificationFor([file], findMatchingTestFiles(file, testFiles), packageScripts).split("; ");
    const reasons = [
      riskyPaths.has(file) ? "risky area" : "",
      (dependentCounts.get(file) ?? 0) > 1 ? "multiple local dependents" : "",
      size > 20_000 ? "large central file" : "",
      /src\/cli\/index/.test(file) ? "CLI entrypoint" : "",
      /config|scanner|mapper|renderer|classifier/i.test(file) ? "core orchestration or classification" : "",
      /package\.json|\.github\/workflows/.test(file) ? "build or release configuration" : ""
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
    purpose: "Repository Context Center CLI for installing, validating, mapping, estimating, and suggesting low-token repository context.",
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
  return table(["Task Type", "Start With", "Then Check", "Tests", "Notes"], data.taskRouting);
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
  return table(["Area", "Why risky", "First checks"], data.risks.map((risk) => ({
    Area: risk.area,
    "Why risky": risk.why,
    "First checks": risk.checks.join("; ")
  })));
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

const renderers: Record<RequiredContextFile, { title: string; render: (data: RepoMapData) => string }> = {
  "AGENTS.md": {
    title: "AGENTS.md",
    render: () => "Start with `docs/ai-context/TASK_ROUTING.md`, then read only the generated rows relevant to the task."
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
  const dependencies = await buildDependencies(files, sourceFiles, testFiles);
  const symbolLimit = maxFiles === defaultMaxFiles ? 30 : Math.min(maxFiles, 30);
  const symbolSourceFiles = sourceFiles.filter((file) => !isFixtureOrSnapshotPath(file));
  const symbols = await buildSymbols(cwd, symbolSourceFiles.slice(0, maxFiles), symbolLimit);
  const hotspots = await buildHotspots(cwd, files, sourceFiles, testFiles, risks, dependencies, packageScripts);
  const doNotRead = buildDoNotRead(files);

  return {
    root: cwd,
    generatedAt: todayIso(),
    filesScanned: files.length,
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
    if (file === "AGENTS.md" && existing !== undefined && !existing.includes(generatedStart)) {
      continue;
    }
    const content = upsertGeneratedSection(existing, renderer.title, renderer.render(data));
    changes.push({
      path: file,
      action: existing === undefined ? "create" : "update",
      content
    });
  }

  return changes;
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

export function generatedMarkers(): { start: string; end: string } {
  return { start: generatedStart, end: generatedEnd };
}
