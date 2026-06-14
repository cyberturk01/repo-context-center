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

const sourceRoots = ["src", "app", "lib", "packages"];
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
  "tsconfig.json",
  "vite.config.js",
  "vite.config.ts"
]);
const configExtensions = /\.(?:config|rc)\.(?:cjs|js|json|mjs|ts|yaml|yml)$/;
const generatedAreaNames = new Set(["dist", "build", "coverage", ".next", "target", ".turbo"]);
const dependencyAreaNames = new Set(["node_modules", ".pnpm-store"]);
const lockfileNames = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"]);
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/").replace(/^\.\/+/, "");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
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

  return Object.values(bin).filter((value): value is string => typeof value === "string");
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
  return /(^|\/)fixtures?(\/|$)/i.test(filePath);
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
    || /(^|\/)(tests?|__tests__|e2e|cypress)\/.*\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(filePath);
}

function entrypointFiles(files: string[], packageJson: unknown): string[] {
  const declared = [
    packageStringField(packageJson, "main"),
    packageStringField(packageJson, "module"),
    packageStringField(packageJson, "types"),
    ...packageBinEntrypoints(packageJson)
  ].filter((value): value is string => value !== undefined);

  const conventional = files.filter((file) =>
    /(^|\/)(index|main|server|app|cli)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)
  );

  return uniqueSorted([...declared, ...conventional].filter((file) => files.includes(file)));
}

function keyDirectories(files: string[], scanner?: Partial<ScanReport["detected"]>): string[] {
  const topLevelDirs = uniqueSorted(files
    .map((file) => file.split("/")[0])
    .filter((part): part is string => part !== undefined && part !== ""));
  const sourceFolders = scanner?.sourceFolders ?? topLevelDirs.filter((dir) => sourceRoots.includes(dir));
  const testFolders = scanner?.testFolders ?? topLevelDirs.filter((dir) => ["tests", "test", "__tests__", "cypress", "e2e"].includes(dir));

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
    if (!sourceRoot || !child || !sourceRoots.includes(sourceRoot)) {
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

export async function buildRepositoryUnderstanding(
  input: BuildRepositoryUnderstandingInput
): Promise<RepositoryUnderstanding> {
  const files = uniqueSorted(input.files.map(normalizePath));
  const packageJson = await readPackageJson(input.cwd, input.packageJson);

  return {
    packageManager: packageManager(files, packageJson),
    scripts: packageScripts(packageJson),
    entrypoints: entrypointFiles(files, packageJson),
    keyDirectories: keyDirectories(files, input.scanner),
    modules: modules(files, input.scanner),
    testFiles: files.filter(isTestFile),
    ignoredAreas: ignoredAreas(files),
    configFiles: configFiles(files)
  };
}
