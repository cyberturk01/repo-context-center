import path from "node:path";
import { readTextFile } from "./fileSystem";
import type { ScanReport } from "./scanner";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "unknown";

export interface RepositoryModuleUnderstanding {
  name: string;
  path: string;
  sourceRoot?: string;
}

export interface IgnoredAreaUnderstanding {
  path: string;
  reason: "generated" | "dependency" | "fixture" | "snapshot" | "lockfile" | "archive";
}

export interface RepositoryUnderstanding {
  packageName?: string;
  packageDescription?: string;
  readmePurpose?: string;
  packageManager: PackageManager;
  scripts: Record<string, string>;
  entrypoints: string[];
  keyDirectories: string[];
  modules: RepositoryModuleUnderstanding[];
  testFiles: string[];
  ignoredAreas: IgnoredAreaUnderstanding[];
  configFiles: string[];
}

export interface BuildRepositoryUnderstandingInput {
  cwd?: string;
  files: string[];
  packageJson?: unknown;
  scanner?: Partial<ScanReport["detected"]>;
}

const sourceRoots = ["src", "app", "lib", "libs", "packages", "apps", "services"];
const testRoots = ["tests", "test", "__tests__", "cypress", "e2e"];
const configFileNames = new Set([
  ".eslintrc",
  ".eslintrc.cjs",
  ".eslintrc.js",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.json",
  "biome.json",
  "eslint.config.js",
  "eslint.config.mjs",
  "package.json",
  "pyproject.toml",
  "tsconfig.json",
  "vite.config.js",
  "vite.config.ts"
]);
const configExtensions = /\.(?:config|rc)\.(?:cjs|js|json|mjs|ts|yaml|yml)$/;
const generatedAreaNames = new Set(["dist", "build", "coverage", ".next", "target", ".turbo"]);
const dependencyAreaNames = new Set(["node_modules", ".pnpm-store"]);
const lockfileNames = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"]);
const sourceFileExtensions = new Set([
  ".cjs",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".mjs",
  ".py",
  ".rs",
  ".ts",
  ".tsx"
]);
const keyDirectoryRoles = [
  ["libs", "monorepo packages/libraries"],
  ["packages", "monorepo packages/libraries"],
  ["apps", "applications"],
  ["services", "services"],
  ["src/cli", "CLI commands and command entrypoints"],
  ["src/config", "configuration loading and validation"],
  ["src/analyzers", "analysis and rule logic"],
  ["src/renderers", "report rendering and output formatting"],
  ["src/core", "orchestration and core business logic"],
  ["src/repo", "repository scanning and git helpers"],
  ["docs", "documentation"],
  ["templates", "templates/prompts/examples"],
  ["examples", "examples and usage samples"],
  ["examples/cookbook", "examples and usage samples"],
  ["tests", "test coverage, fixtures, and regression cases"],
  ["scripts", "automation and maintenance scripts"],
  [".github/workflows", "CI and release automation"],
  ["docs/ai-context", "generated agent context"],
  [".repo-context-center", "tool config"]
] as const;

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/").replace(/^\.\/+/, "");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function packageScripts(packageJson: unknown): Record<string, string> {
  if (!isRecord(packageJson) || !isRecord(packageJson.scripts)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(packageJson.scripts)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function packageStringField(packageJson: unknown, field: string): string | undefined {
  if (!isRecord(packageJson)) {
    return undefined;
  }

  const value = packageJson[field];
  return typeof value === "string" ? value : undefined;
}

function cleanMarkdownText(value: string): string {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isBadgeOrImageLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length === 0
    || /!\[[^\]]*]\([^)]+\)/.test(trimmed)
    || /<img\b/i.test(trimmed)
    || /shields\.io|badge\/|badge-|logo-margin/i.test(trimmed)
    || /^<\/?(p|div|span|a)\b[^>]*>$/i.test(trimmed);
}

function plainReadmeLines(content: string): string[] {
  return content
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "\n")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/<\/?(?:p|div|span|a|picture|source)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !isBadgeOrImageLine(line))
    .map(cleanMarkdownText)
    .filter((line) => line.length > 0);
}

function firstSentence(text: string): string {
  const sentence = text.match(/^.{20,220}?[.!?](?=\s|$)/);
  if (sentence) {
    return sentence[0].trim();
  }

  const compact = text.length > 220 ? text.slice(0, 220).replace(/\s+\S*$/, "") : text;
  return /[.!?]$/.test(compact) ? compact : `${compact}.`;
}

function readmePurpose(content: string | undefined): string | undefined {
  if (!content) {
    return undefined;
  }

  const paragraphs = plainReadmeLines(content)
    .filter((paragraph) => paragraph.length >= 20)
    .filter((paragraph) => !/^(install|usage|quickstart|documentation|license)\b/i.test(paragraph));

  return paragraphs[0] ? firstSentence(paragraphs[0]) : undefined;
}

function packageBinEntrypoints(packageJson: unknown): string[] {
  if (!isRecord(packageJson)) {
    return [];
  }

  const bin = packageJson.bin;
  if (typeof bin === "string") {
    return [bin];
  }

  if (!isRecord(bin)) {
    return [];
  }

  return Object.entries(bin)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function packageManager(files: string[], packageJson: unknown): PackageManager {
  const packageManagerValue = packageStringField(packageJson, "packageManager");
  if (packageManagerValue?.startsWith("pnpm@")) {
    return "pnpm";
  }
  if (packageManagerValue?.startsWith("yarn@")) {
    return "yarn";
  }
  if (packageManagerValue?.startsWith("bun@")) {
    return "bun";
  }
  if (packageManagerValue?.startsWith("npm@")) {
    return "npm";
  }

  const fileSet = new Set(files);
  if (fileSet.has("pnpm-lock.yaml")) {
    return "pnpm";
  }
  if (fileSet.has("yarn.lock")) {
    return "yarn";
  }
  if (fileSet.has("bun.lockb")) {
    return "bun";
  }
  if (fileSet.has("package-lock.json")) {
    return "npm";
  }
  return fileSet.has("package.json") ? "npm" : "unknown";
}

function isFixturePath(filePath: string): boolean {
  return /(^|\/)(__fixtures__|fixtures?|test-fixtures)(\/|$)/i.test(filePath);
}

function isSnapshotPath(filePath: string): boolean {
  return /(^|\/)(__snapshots__|snapshots?)(\/|$)/i.test(filePath);
}

function isGeneratedPath(filePath: string): boolean {
  return filePath.split("/").some((part) => generatedAreaNames.has(part));
}

function isDependencyPath(filePath: string): boolean {
  return filePath.split("/").some((part) => dependencyAreaNames.has(part));
}

function isTestFile(filePath: string): boolean {
  if (isFixturePath(filePath) || isSnapshotPath(filePath)) {
    return false;
  }

  return /\.(test|spec|cy)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath)
    || /(^|\/)test_[^/]+\.py$/i.test(filePath)
    || /(^|\/)(tests?|__tests__|e2e|cypress)\/.*\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath)
    || /(^|\/)(tests?|__tests__|e2e|cypress)\/.*(^|\/)(test_[^/]+|[^/]+_test)\.py$/i.test(filePath);
}

function isSourceFile(filePath: string): boolean {
  return !isTestFile(filePath)
    && !isFixturePath(filePath)
    && !isSnapshotPath(filePath)
    && !isGeneratedPath(filePath)
    && !isDependencyPath(filePath)
    && sourceFileExtensions.has(path.posix.extname(filePath).toLowerCase());
}

function entrypointFiles(files: string[], packageJson: unknown): string[] {
  const declared = [
    ...packageBinEntrypoints(packageJson),
    packageStringField(packageJson, "main")
  ].filter((value): value is string => value !== undefined);
  const declaredEntrypoints = declared.map(normalizePath);

  const conventional = [
    ...files.filter((file) => /^src\/cli\/index\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)),
    ...files.filter((file) => /^cli\/index\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)),
    ...files.filter((file) => /^src\/index\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file))
  ];

  return uniqueOrdered(
    [...declaredEntrypoints, ...conventional].filter((file) => declaredEntrypoints.includes(file) || files.includes(file))
  );
}

function hasDirectory(files: string[], dirPath: string): boolean {
  return files.some((file) => file.startsWith(`${dirPath}/`));
}

function hasNonContextDocs(files: string[]): boolean {
  return files.some((file) => file.startsWith("docs/") && !file.startsWith("docs/ai-context/"));
}

function packageRootLabel(packageRoot: string): string {
  if (packageRoot === "libs/core") {
    return "core library/package area";
  }
  if (packageRoot.startsWith("libs/")) {
    return "library/package area";
  }
  if (packageRoot.startsWith("apps/")) {
    return "application area";
  }
  if (packageRoot.startsWith("services/")) {
    return "service area";
  }
  return "package area";
}

function monorepoPackageDirectories(files: string[]): string[] {
  const packageRoots = new Set<string>();
  const monorepoRoots = new Set(["libs", "packages", "apps", "services"]);

  for (const file of files.filter(isSourceFile)) {
    const [root, child] = file.split("/");
    if (!root || !child || !monorepoRoots.has(root)) {
      continue;
    }
    if (generatedAreaNames.has(child) || dependencyAreaNames.has(child)) {
      continue;
    }
    packageRoots.add(`${root}/${child}`);
  }

  return [...packageRoots]
    .sort((left, right) => {
      if (left === "libs/core") {
        return -1;
      }
      if (right === "libs/core") {
        return 1;
      }
      return left.localeCompare(right);
    })
    .map((dirPath) => `\`${dirPath}\` - ${packageRootLabel(dirPath)}`);
}

function monorepoPackageRootFromLabel(label: string): string | undefined {
  const match = label.match(/^`([^`]+)`/);
  return match?.[1].split("/")[0];
}

function repositoryDirectoryName(cwd: string | undefined, packageJson: unknown): string | undefined {
  const packageName = packageStringField(packageJson, "name");
  const fallbackName = cwd ? path.basename(cwd) : undefined;
  const name = packageName ?? fallbackName;
  return name?.split("/").pop()?.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function keyDirectories(
  files: string[],
  packageJson: unknown,
  cwd: string | undefined,
  scanner?: Partial<ScanReport["detected"]>
): string[] {
  const repoDir = repositoryDirectoryName(cwd, packageJson);
  const packageRoot = repoDir && hasDirectory(files, repoDir)
    ? [`\`${repoDir}\` - primary package/source code`]
    : [];
  const packageDirectories = monorepoPackageDirectories(files);
  const roleDirectories = keyDirectoryRoles
    .filter(([dirPath]) => dirPath !== "docs" || hasNonContextDocs(files))
    .filter(([dirPath]) => hasDirectory(files, dirPath))
    .flatMap(([dirPath, role]) => {
      const directory = `\`${dirPath}\` - ${role}`;
      const nested = packageDirectories.filter((packageDirectory) => monorepoPackageRootFromLabel(packageDirectory) === dirPath);
      return [directory, ...nested];
    });

  if (packageRoot.length > 0 || roleDirectories.length > 0 || packageDirectories.length > 0) {
    return uniqueOrdered([...packageRoot, ...roleDirectories, ...packageDirectories]);
  }

  const topLevelDirs = uniqueSorted(files
    .map((file) => file.split("/")[0])
    .filter((part): part is string => part !== undefined && part !== ""));
  const sourceFolders = scanner?.sourceFolders ?? topLevelDirs.filter((dir) => sourceRoots.includes(dir));
  const testFolders = scanner?.testFolders ?? topLevelDirs.filter((dir) => testRoots.includes(dir));

  return uniqueSorted([...sourceFolders, ...testFolders, ...topLevelDirs.filter((dir) => dir === "docs" || dir === ".github")]);
}

function modules(files: string[], scanner?: Partial<ScanReport["detected"]>): RepositoryModuleUnderstanding[] {
  if (scanner?.modules && scanner.modules.length > 0) {
    return scanner.modules
      .map((module) => ({ name: module.name, path: module.path, sourceRoot: module.sourceRoot }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  const moduleMap = new Map<string, RepositoryModuleUnderstanding>();
  for (const file of files) {
    const [sourceRoot, child] = file.split("/");
    if (!sourceRoot || !child || !sourceRoots.includes(sourceRoot) || !isSourceFile(file)) {
      continue;
    }
    if (generatedAreaNames.has(child) || dependencyAreaNames.has(child)) {
      continue;
    }

    const modulePath = `${sourceRoot}/${child}`;
    moduleMap.set(modulePath, { name: child, path: modulePath, sourceRoot });
  }

  return [...moduleMap.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function configFiles(files: string[]): string[] {
  return files.filter((file) => configFileNames.has(file) || configExtensions.test(path.posix.basename(file)));
}

function ignoredAreas(files: string[]): IgnoredAreaUnderstanding[] {
  const byPath = new Map<string, IgnoredAreaUnderstanding>();
  const add = (areaPath: string, reason: IgnoredAreaUnderstanding["reason"]): void => {
    const existing = byPath.get(areaPath);
    if (!existing || existing.reason.localeCompare(reason) > 0) {
      byPath.set(areaPath, { path: areaPath, reason });
    }
  };

  for (const file of files) {
    const parts = file.split("/");
    const firstGeneratedPart = parts.find((part) => generatedAreaNames.has(part));
    const firstDependencyPart = parts.find((part) => dependencyAreaNames.has(part));

    if (firstDependencyPart) {
      add(parts.slice(0, parts.indexOf(firstDependencyPart) + 1).join("/"), "dependency");
    } else if (firstGeneratedPart) {
      add(parts.slice(0, parts.indexOf(firstGeneratedPart) + 1).join("/"), "generated");
    }

    if (isFixturePath(file)) {
      const index = parts.findIndex((part) => /^fixtures?$/i.test(part));
      add(parts.slice(0, index + 1).join("/"), "fixture");
    }
    if (isSnapshotPath(file)) {
      const index = parts.findIndex((part) => /^(__snapshots__|snapshots?)$/i.test(part));
      add(parts.slice(0, index + 1).join("/"), "snapshot");
    }
    if (lockfileNames.has(file)) {
      add(file, "lockfile");
    }
    if (file.startsWith("docs/ai-context/archive/")) {
      add("docs/ai-context/archive", "archive");
    }
  }

  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function readPackageJson(cwd: string | undefined, provided: unknown): Promise<unknown> {
  if (provided !== undefined || cwd === undefined) {
    return provided;
  }

  try {
    return JSON.parse(await readTextFile(path.join(cwd, "package.json"))) as unknown;
  } catch {
    return undefined;
  }
}

async function readReadme(cwd: string | undefined): Promise<string | undefined> {
  if (cwd === undefined) {
    return undefined;
  }

  try {
    return await readTextFile(path.join(cwd, "README.md"));
  } catch {
    return undefined;
  }
}

export async function buildRepositoryUnderstanding(
  input: BuildRepositoryUnderstandingInput
): Promise<RepositoryUnderstanding> {
  const files = uniqueSorted(input.files.map(normalizePath));
  const packageJson = await readPackageJson(input.cwd, input.packageJson);
  const readme = await readReadme(input.cwd);

  return {
    packageName: packageStringField(packageJson, "name"),
    packageDescription: packageStringField(packageJson, "description"),
    readmePurpose: readmePurpose(readme),
    packageManager: packageManager(files, packageJson),
    scripts: packageScripts(packageJson),
    entrypoints: entrypointFiles(files, packageJson),
    keyDirectories: keyDirectories(files, packageJson, input.cwd, input.scanner),
    modules: modules(files, input.scanner),
    testFiles: files.filter(isTestFile),
    ignoredAreas: ignoredAreas(files),
    configFiles: configFiles(files)
  };
}
