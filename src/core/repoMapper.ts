import path from "node:path";
import { requiredContextFiles, type RequiredContextFile } from "./contextFiles";
import { ensureDir, listDirectoryNames, readTextFile, writeTextFile, pathExists } from "./fileSystem";
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
    coreShape: string[];
    entrypoints: string[];
    config: string[];
    tests: string[];
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
  "docs/ai-context/archive"
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
  const parts = filePath.split("/");
  return parts.some((part) => part.toLowerCase().includes("tests"))
    || testRoots.includes(parts[0] ?? "")
    || /\.(test|spec|cy)\.[^.]+$/i.test(filePath);
}

function isSourcePath(filePath: string): boolean {
  return sourceRoots.some((root) => filePath === root || filePath.startsWith(`${root}/`))
    && !isTestPath(filePath)
    && sourceExtensions.has(path.extname(filePath).toLowerCase());
}

function isContextPath(filePath: string): boolean {
  return filePath === "AGENTS.md" || filePath.startsWith("docs/ai-context/") || filePath.startsWith(".project-brain/");
}

function isConfigPath(filePath: string): boolean {
  return filePath === "package.json"
    || filePath === "package-lock.json"
    || filePath === "pnpm-lock.yaml"
    || filePath === "yarn.lock"
    || filePath === "Dockerfile"
    || filePath === "docker-compose.yml"
    || filePath === "railway.json"
    || filePath === "vercel.json"
    || filePath.startsWith(".github/workflows/");
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
        if (!excludedDirs.has(entry.name) && normalized !== "docs/ai-context/archive") {
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

async function readPackageScripts(cwd: string): Promise<Set<string>> {
  try {
    const content = await readTextFile(path.join(cwd, "package.json"));
    const parsed = JSON.parse(content) as { scripts?: Record<string, string> };
    return new Set(Object.keys(parsed.scripts ?? {}));
  } catch {
    return new Set();
  }
}

const categories: Category[] = [
  {
    key: "cli",
    label: "CLI",
    taskType: "CLI argument parsing",
    purpose: "Command parsing and user-facing output",
    commonTasks: ["commands", "arguments", "output"],
    match: (file) => file.path.startsWith("src/cli/")
  },
  {
    key: "config",
    label: "Configuration",
    taskType: "Configuration loading/validation",
    purpose: "Project configuration and setup rules",
    commonTasks: ["config", "validation", "setup"],
    riskWhy: "Config mistakes can misroute agent work or break validation.",
    match: (file) => isConfigPath(file.path) || pathHas(file, ["config", "validate", "validator"])
  },
  {
    key: "scanner",
    label: "Repository scanning",
    taskType: "Repository scanning",
    purpose: "Repo inspection and lightweight analysis",
    commonTasks: ["scan", "file discovery", "symbols"],
    match: (file) => pathHas(file, ["scan", "scanner", "symbol", "symbols"])
  },
  {
    key: "risk",
    label: "Risk rules",
    taskType: "Risk rule evaluation",
    purpose: "Risk, validation, and hotspot guidance",
    commonTasks: ["risk", "warnings", "checks"],
    riskWhy: "Risk guidance affects what agents inspect before changes.",
    match: (file) => pathHas(file, ["risk", "hotspot", "validate", "validator", "security"])
  },
  {
    key: "reports",
    label: "Report generation",
    taskType: "Report generation",
    purpose: "Generated CLI reports and markdown output",
    commonTasks: ["formatting", "markdown", "json"],
    match: (file) => pathHas(file, ["archive", "estimate", "suggest", "map", "report"])
  },
  {
    key: "fixtures",
    label: "Test fixtures",
    taskType: "Test fixtures",
    purpose: "Test data, temp repos, and fixtures",
    commonTasks: ["fixtures", "test setup", "coverage"],
    match: (file) => isTestPath(file.path)
  },
  {
    key: "auth",
    label: "Auth/access",
    taskType: "Auth/access",
    purpose: "Authentication, sessions, roles, and permissions",
    commonTasks: ["auth", "access", "sessions"],
    riskWhy: "Auth changes can expose accounts or bypass permissions.",
    match: (file) => pathHas(file, ["auth", "session", "token", "password", "permission", "role", "security"])
  },
  {
    key: "database",
    label: "Database/migrations",
    taskType: "Database/migrations",
    purpose: "Persistence, schema, and migrations",
    commonTasks: ["schema", "migration", "data"],
    riskWhy: "Schema changes can lose data or break production deploys.",
    match: (file) => isDatabasePath(file.path)
  },
  {
    key: "email",
    label: "Email/messaging",
    taskType: "Email/messaging",
    purpose: "Email, messages, notifications, and campaigns",
    commonTasks: ["delivery", "templates", "queues"],
    riskWhy: "Messaging changes can send incorrect or duplicate communication.",
    match: (file) => pathHas(file, ["email", "mail", "message", "notification", "campaign"])
  },
  {
    key: "business",
    label: "Business-sensitive flows",
    taskType: "Coupon/reward/loyalty",
    purpose: "Coupon, reward, customer, and loyalty behavior",
    commonTasks: ["business rules", "eligibility", "redemption"],
    riskWhy: "Business rules can affect customer value or owner accounting.",
    match: (file) => pathHas(file, ["coupon", "reward", "loyalty", "referral", "visit", "contact", "customer"])
  },
  {
    key: "public-staff-pos",
    label: "Staff/POS/public flows",
    taskType: "Staff/POS/public flows",
    purpose: "Public, staff, owner, POS, and QR flows",
    commonTasks: ["public UI", "staff workflow", "POS"],
    riskWhy: "Public and staff flows are user-visible and often role-sensitive.",
    match: (file) => isPublicPath(file.path) || pathHas(file, ["owner", "staff", "pos", "qr", "public"])
  },
  {
    key: "context",
    label: "Context docs",
    taskType: "Context docs / agent workflow",
    purpose: "Agent routing, context maps, and workflow notes",
    commonTasks: ["context updates", "agent workflow", "docs"],
    match: (file) => isContextPath(file.path)
  },
  {
    key: "release",
    label: "Release workflow",
    taskType: "GitHub Actions / release workflow",
    purpose: "CI, deployment, and release configuration",
    commonTasks: ["CI", "deployment", "release"],
    riskWhy: "Workflow changes can block releases or deploy broken builds.",
    match: (file) => file.path.startsWith(".github/workflows/")
      || pathHas(file, ["docker", "railway", "vercel", "deploy", "release"])
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

function buildTaskRouting(files: RepoFile[], testFiles: string[], packageScripts: Set<string>): RepoMapRow[] {
  const hasProjectFiles = files.some((file) => !isContextPath(file.path));

  return categories.flatMap((category) => {
    if (category.key === "context" && !hasProjectFiles) {
      return [];
    }

    const matches = filesForCategory(files, category).filter((file) => !isContextPath(file.path) || category.key === "context");
    if (matches.length === 0) {
      return [];
    }

    const primary = matches
      .filter((file) => !isTestPath(file.path))
      .map((file) => file.path)
      .slice(0, 4);
    const tests = relatedTests(primary, testFiles);
    const inspect = primary.length > 0 ? primary : matches.map((file) => file.path).slice(0, 4);

    return [{
      "Task type": category.taskType,
      "Inspect first": compactList(inspect),
      "Focused verification": verificationFor(inspect, tests, packageScripts)
    }];
  });
}

function buildModules(files: RepoFile[], testFiles: string[], maxModules = 12): RepoModule[] {
  const hasProjectFiles = files.some((file) => !isContextPath(file.path));

  return categories
    .map((category) => {
      if (category.key === "context" && !hasProjectFiles) {
        return undefined;
      }

      const primary = filesForCategory(files, category)
        .filter((file) => !isTestPath(file.path))
        .map((file) => file.path)
        .slice(0, 5);
      if (primary.length === 0 && category.key !== "fixtures") {
        return undefined;
      }

      const moduleTests = category.key === "fixtures"
        ? filesForCategory(files, category).map((file) => file.path).slice(0, 5)
        : relatedTests(primary, testFiles).slice(0, 5);

      if (primary.length === 0 && moduleTests.length === 0) {
        return undefined;
      }

      return {
        name: category.label,
        purpose: category.purpose,
        primaryFiles: primary,
        commonTasks: category.commonTasks,
        tests: moduleTests
      };
    })
    .filter((module): module is RepoModule => module !== undefined)
    .slice(0, maxModules);
}

function buildRisks(files: RepoFile[], testFiles: string[], packageScripts: Set<string>): RepoRisk[] {
  return categories.flatMap((category) => {
    if (!category.riskWhy) {
      return [];
    }

    const matches = filesForCategory(files, category)
      .filter((file) => !isTestPath(file.path))
      .map((file) => file.path);
    if (matches.length === 0) {
      return [];
    }

    return [{
      area: `${category.label}: ${compactList(matches, "none", 3)}`,
      why: category.riskWhy,
      checks: verificationFor(matches, relatedTests(matches, testFiles), packageScripts).split("; ")
    }];
  });
}

function importSpecifiers(content: string): string[] {
  const imports: string[] = [];
  const patterns = [
    /\bimport\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^'"]+\s+from\s+["']([^"']+)["']/g,
    /\brequire\(["']([^"']+)["']\)/g
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

function resolveLocalImport(fromFile: string, specifier: string, sourceFileSet: Set<string>): string | undefined {
  if (!specifier.startsWith(".")) {
    return undefined;
  }

  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`
  ];

  return candidates.find((candidate) => sourceFileSet.has(candidate));
}

async function buildDependencies(cwd: string, sourceFiles: string[], maxFiles: number): Promise<RepoDependency[]> {
  const sourceFileSet = new Set(sourceFiles);
  const dependencies: RepoDependency[] = [];

  for (const sourceFile of sourceFiles.slice(0, maxFiles)) {
    let content = "";
    try {
      content = (await readTextFile(path.join(cwd, sourceFile))).slice(0, textReadLimit);
    } catch {
      continue;
    }

    for (const specifier of importSpecifiers(content)) {
      const resolved = resolveLocalImport(sourceFile, specifier, sourceFileSet);
      if (resolved) {
        dependencies.push({
          from: sourceFile,
          dependsOn: resolved,
          why: "local import",
          inferred: false
        });
      }
    }
  }

  if (dependencies.length > 0) {
    return dependencies.slice(0, 20);
  }

  return sourceFiles
    .filter((file) => file.includes("/routes/") || file.includes("/api/") || file.includes("/cli/"))
    .slice(0, 8)
    .map((file) => ({
      from: file,
      dependsOn: "nearby service/core files",
      why: "inferred from path; verify before relying on it",
      inferred: true
    }));
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
  const candidates = uniqueSorted([
    ...sourceFiles.filter((file) => riskyPaths.has(file)),
    ...[...dependentCounts.entries()].filter(([, count]) => count > 1).map(([file]) => file),
    ...sourceFiles.filter((file) => /config|workflow|deploy|auth|session|migration|payment|coupon|reward/i.test(file)),
    "package.json",
    ...sourceFiles.filter((file) => file.startsWith(".github/workflows/"))
  ]).filter((file) => sourceFiles.includes(file) || file === "package.json");

  const rows: RepoHotspot[] = [];
  for (const file of candidates.slice(0, 12)) {
    const size = await fileSize(cwd, file);
    const checks = verificationFor([file], findMatchingTestFiles(file, testFiles), packageScripts).split("; ");
    const reasons = [
      riskyPaths.has(file) ? "risky area" : "",
      (dependentCounts.get(file) ?? 0) > 1 ? "multiple local dependents" : "",
      size > 20_000 ? "large central file" : "",
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

function buildProjectMap(files: RepoFile[], testFiles: string[], risks: RepoRisk[]): RepoMapData["projectMap"] {
  const sourceFolders = uniqueSorted(files
    .map((file) => file.parts[0])
    .filter((part): part is string => sourceRoots.includes(part ?? "")));
  const entrypoints = files
    .filter((file) => /(^|\/)(index|main|server|app|cli)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file.path)
      || file.path === "package.json")
    .map((file) => file.path)
    .slice(0, 8);
  const config = files.filter((file) => isConfigPath(file.path)).map((file) => file.path).slice(0, 8);

  return {
    coreShape: sourceFolders.length > 0 ? sourceFolders.map((folder) => `${folder}/ source root`) : ["No standard source roots detected"],
    entrypoints,
    config,
    tests: testFiles.slice(0, 8),
    productionCriticalFlows: risks.map((risk) => ({
      Flow: risk.area,
      "Why critical": risk.why,
      "First check": risk.checks[0] ?? "focused review"
    }))
  };
}

function buildDoNotRead(files: RepoFile[]): string[] {
  const topLevel = new Set(files.map((file) => file.parts[0] ?? ""));
  return uniqueSorted([
    ...baseDoNotRead,
    ...[...excludedDirs].filter((folder) => topLevel.has(folder)),
    ...files
      .filter((file) => isGeneratedAsset(file.path))
      .map((file) => path.posix.dirname(file.path))
      .filter((folder) => folder !== ".")
  ]);
}

function buildTokenBudget(filesScanned: number, modules: RepoModule[], risks: RepoRisk[]): RepoMapRow[] {
  const repoSize = filesScanned < 50 ? "small" : filesScanned < 300 ? "medium" : "large";
  const compactMax = repoSize === "small" ? "20" : repoSize === "medium" ? "35" : "50";
  const detailedMax = repoSize === "small" ? "80" : repoSize === "medium" ? "150" : "250";

  return [
    {
      Mode: "Compact Mode",
      "Use when": "small localized task",
      "Read first": "AGENTS.md, TASK_ROUTING.md, relevant module row",
      "Max files": compactMax
    },
    {
      Mode: "Investigation Mode",
      "Use when": risks.length > 0 ? "risk, auth, data, release, or bug task" : "bug or unclear task",
      "Read first": "RISK_REGISTER.md, HOTSPOTS.md, DEPENDENCY_MAP.md",
      "Max files": detailedMax
    },
    {
      Mode: "Detailed Mode",
      "Use when": "cross-module refactor or broad behavior change",
      "Read first": `${modules.length} module rows plus targeted source/tests`,
      "Max files": detailedMax
    }
  ];
}

function table(headers: string[], rows: RepoMapRow[]): string {
  if (rows.length === 0) {
    return "_No repo-specific rows detected._";
  }

  return [
    `| ${headers.join(" |")} |`,
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
  return table(["Task type", "Inspect first", "Focused verification"], data.taskRouting);
}

function renderModules(data: RepoMapData): string {
  return table(["Module", "Purpose", "Primary files", "Common tasks", "Tests"], data.modules.map((module) => ({
    Module: module.name,
    Purpose: module.purpose,
    "Primary files": compactList(module.primaryFiles),
    "Common tasks": module.commonTasks.join(", "),
    Tests: compactList(module.tests)
  })));
}

function renderProjectMap(data: RepoMapData): string {
  return [
    "### Core Shape",
    bullets(data.projectMap.coreShape),
    "",
    "### Startup / Entrypoints",
    bullets(data.projectMap.entrypoints.map((file) => `\`${file}\``)),
    "",
    "### Config",
    bullets(data.projectMap.config.map((file) => `\`${file}\``)),
    "",
    "### Tests",
    bullets(data.projectMap.tests.map((file) => `\`${file}\``)),
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
    "Depends on": dependency.inferred ? dependency.dependsOn : `\`${dependency.dependsOn}\``,
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
    "Avoid broad scans unless routing, module maps, and targeted tests leave a concrete unknown."
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
  return data.lessonsPlaceholder.map((note) => `- ${note}`).join("\n");
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
  const packageScripts = await readPackageScripts(cwd);
  const sourceFiles = files.filter((file) => isSourcePath(file.path)).map((file) => file.path);
  const testFiles = files.filter((file) => isTestPath(file.path)).map((file) => file.path);
  const modules = buildModules(files, testFiles);
  const risks = buildRisks(files, testFiles, packageScripts);
  const dependencies = await buildDependencies(cwd, sourceFiles, maxFiles);
  const symbolLimit = maxFiles === defaultMaxFiles ? 50 : maxFiles;
  const symbols = await buildSymbols(cwd, sourceFiles.slice(0, maxFiles), symbolLimit);
  const hotspots = await buildHotspots(cwd, sourceFiles, testFiles, risks, dependencies, packageScripts);

  return {
    root: cwd,
    generatedAt: todayIso(),
    filesScanned: files.length,
    taskRouting: buildTaskRouting(files, testFiles, packageScripts),
    modules,
    projectMap: buildProjectMap(files, testFiles, risks),
    risks,
    dependencies,
    symbols,
    hotspots,
    doNotRead: buildDoNotRead(files),
    tokenBudget: buildTokenBudget(files.length, modules, risks),
    communicationNotes: risks.length > 0
      ? [`Use Investigation Mode for ${risks.map((risk) => risk.area.split(":")[0]).join(", ")} tasks.`]
      : [],
    lessonsPlaceholder: ["Add durable lessons only after repeated tasks or verified mistakes."]
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
