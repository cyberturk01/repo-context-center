import { realpath } from "node:fs/promises";
import path from "node:path";
import { pathExists, readJsonFile } from "../../core/fileSystem";
import type { CliIO } from "../index";

interface PackageInfo {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface PackageLocation {
  path: string;
  packageJson: PackageInfo;
}

const usage = "Usage: repo-context-center doctor\n";
const packageFileName = "package.json";
const packageName = "repo-context-center";
const modernWorkAgentSupported = true;

async function readPackageJson(filePath: string): Promise<PackageInfo | null> {
  try {
    return await readJsonFile<PackageInfo>(filePath);
  } catch {
    return null;
  }
}

async function findNearestPackage(startPath: string, expectedName?: string): Promise<PackageLocation | null> {
  let current = path.resolve(startPath);

  if (!path.extname(current)) {
    current = path.resolve(current);
  } else {
    current = path.dirname(current);
  }

  while (true) {
    const packagePath = path.join(current, packageFileName);
    if (await pathExists(packagePath)) {
      const packageJson = await readPackageJson(packagePath);
      if (packageJson && (!expectedName || packageJson.name === expectedName)) {
        return {
          path: current,
          packageJson
        };
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function findNearestLocalInstall(startPath: string): Promise<PackageLocation | null> {
  let current = path.resolve(startPath);

  while (true) {
    const packagePath = path.join(current, "node_modules", packageName, packageFileName);
    if (await pathExists(packagePath)) {
      const packageJson = await readPackageJson(packagePath);
      if (packageJson) {
        return {
          path: path.dirname(packagePath),
          packageJson
        };
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function executionPath(): Promise<string | null> {
  const argvPath = process.argv[1];
  if (!argvPath) {
    return null;
  }

  try {
    return await realpath(argvPath);
  } catch {
    return path.resolve(argvPath);
  }
}

function isInsidePath(childPath: string | null, parentPath: string | null): boolean {
  if (!childPath || !parentPath) {
    return false;
  }

  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function display(value: string | undefined | null): string {
  return value || "unknown";
}

function dependencyVersion(packageJson: PackageInfo | undefined): string | undefined {
  return packageJson?.dependencies?.[packageName]
    ?? packageJson?.devDependencies?.[packageName]
    ?? packageJson?.optionalDependencies?.[packageName]
    ?? packageJson?.peerDependencies?.[packageName];
}

function firstVersion(value: string | undefined): string | undefined {
  return value?.match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/)?.[0];
}

function compareVersion(left: string | undefined, right: string | undefined): number {
  const leftVersion = firstVersion(left);
  const rightVersion = firstVersion(right);
  if (!leftVersion || !rightVersion) {
    return 0;
  }

  const leftParts = leftVersion.split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10));
  const rightParts = rightVersion.split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < 3; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export async function doctorCommand(io: CliIO, args: string[] = []): Promise<number> {
  if (args.length > 0) {
    io.stderr(usage);
    return 1;
  }

  const executable = await executionPath();
  const runningPackage = executable
    ? await findNearestPackage(executable, packageName)
    : null;
  const repoPackage = await findNearestPackage(io.cwd);
  const localInstall = await findNearestLocalInstall(io.cwd);

  const runningVersion = runningPackage?.packageJson.version;
  const repoName = repoPackage?.packageJson.name;
  const repoVersion = repoPackage?.packageJson.version;
  const declaredDependency = dependencyVersion(repoPackage?.packageJson);
  const localVersion = localInstall?.packageJson.version;
  const runningFromRepo = isInsidePath(executable, repoPackage?.path ?? null);
  const runningFromLocalInstall = isInsidePath(executable, localInstall?.path ?? null);
  const repoPackageMismatch = repoName === packageName
    && Boolean(runningVersion)
    && Boolean(repoVersion)
    && runningVersion !== repoVersion
    && !runningFromRepo;
  const localInstallNewer = compareVersion(localVersion, runningVersion) > 0 && !runningFromLocalInstall;
  const declaredDependencyNewer = compareVersion(declaredDependency, runningVersion) > 0;
  const shouldWarn = repoPackageMismatch || localInstallNewer || declaredDependencyNewer;

  const lines = [
    "repo-context-center doctor",
    "",
    `Running CLI version: ${display(runningVersion)}`,
    `Repo package version: ${repoName === packageName ? display(repoVersion) : "not repo-context-center"}`,
    `Package dependency version: ${declaredDependency ?? "not declared"}`,
    `Nearest local install version: ${display(localVersion)}`,
    `Supports work --agent: ${modernWorkAgentSupported ? "yes" : "no"}`,
    `Execution path: ${display(executable)}`,
    ""
  ];

  if (repoPackageMismatch) {
    lines.push(
      `Warning: running global RCC version ${runningVersion} while repo package version is ${repoVersion}. Use node dist/cli/index.js during local development.`
    );
  } else if (localInstallNewer) {
    lines.push(
      `Detected local ${packageName}@${localVersion} but active rcc command appears older.`,
      `Try: npx ${packageName}@${localVersion} work "<task>" --agent`
    );
  } else if (declaredDependencyNewer) {
    const targetVersion = firstVersion(declaredDependency) ?? declaredDependency;
    lines.push(
      `Detected package dependency ${packageName}@${declaredDependency} but active rcc command appears older.`,
      `Try: npx ${packageName}@${targetVersion} work "<task>" --agent`
    );
  } else if (!localInstall && declaredDependency) {
    lines.push(
      `Package declares ${packageName}@${declaredDependency}, but no local node_modules install was found.`,
      "Run your package manager install command, or use npx with the declared version."
    );
  } else if (shouldWarn) {
    lines.push("Warning: RCC binary alignment could not be confirmed.");
  } else {
    lines.push("Local package and active CLI are aligned.");
  }

  io.stdout(`${lines.join("\n")}\n`);
  return 0;
}
