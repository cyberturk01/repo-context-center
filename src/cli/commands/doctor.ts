import { realpath } from "node:fs/promises";
import path from "node:path";
import { pathExists, readJsonFile } from "../../core/fileSystem";
import type { CliIO } from "../index";

interface PackageInfo {
  name?: string;
  version?: string;
}

interface PackageLocation {
  path: string;
  packageJson: PackageInfo;
}

const usage = "Usage: repo-context-center doctor\n";
const packageFileName = "package.json";
const packageName = "repo-context-center";

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

  const runningVersion = runningPackage?.packageJson.version;
  const repoName = repoPackage?.packageJson.name;
  const repoVersion = repoPackage?.packageJson.version;
  const runningFromRepo = isInsidePath(executable, repoPackage?.path ?? null);
  const shouldWarn = repoName === packageName
    && Boolean(runningVersion)
    && Boolean(repoVersion)
    && runningVersion !== repoVersion
    && !runningFromRepo;

  const lines = [
    "repo-context-center doctor",
    "",
    `Running CLI version: ${display(runningVersion)}`,
    `Repo package version: ${repoName === packageName ? display(repoVersion) : "not repo-context-center"}`,
    `Execution path: ${display(executable)}`,
    ""
  ];

  if (shouldWarn) {
    lines.push(
      `Warning: running global RCC version ${runningVersion} while repo package version is ${repoVersion}. Use node dist/cli/index.js during local development.`
    );
  } else {
    lines.push("Warnings: none");
  }

  io.stdout(`${lines.join("\n")}\n`);
  return 0;
}
