import { realpath } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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

type ShellCommandStatus = "ok" | "missing" | "stale" | "capability mismatch";

interface CommandRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ShellCommandCheck {
  command: string;
  resolvedPath?: string;
  versionOutput?: string;
  supportsWorkAgent: boolean;
  status: ShellCommandStatus;
  note?: string;
}

const usage = "Usage: repo-context-center doctor\n";
const packageFileName = "package.json";
const packageName = "repo-context-center";
const modernWorkAgentSupported = true;
const execFileAsync = promisify(execFile);

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

function displayInstall(location: PackageLocation | null): string {
  if (!location) {
    return "unknown";
  }

  return `${display(location.packageJson.version)} (${location.path})`;
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

function pathEntries(): string[] {
  return (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
}

async function resolveShellCommand(command: string): Promise<string | undefined> {
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];

  for (const dir of pathEntries()) {
    for (const extension of extensions) {
      const candidate = path.join(dir, process.platform === "win32" ? `${command}${extension}` : command);
      if (await pathExists(candidate)) {
        try {
          return await realpath(candidate);
        } catch {
          return candidate;
        }
      }
    }
  }

  return undefined;
}

async function runCommand(commandPath: string, args: string[], cwd: string): Promise<CommandRunResult> {
  try {
    const result = await execFileAsync(commandPath, args, {
      cwd,
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error: unknown) {
    const failed = error as { code?: number | string; stdout?: string; stderr?: string };
    return {
      exitCode: typeof failed.code === "number" ? failed.code : 1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? ""
    };
  }
}

function firstOutputLine(output: string): string | undefined {
  return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
}

function supportsWorkAgent(result: CommandRunResult): boolean {
  if (result.exitCode !== 0) {
    return false;
  }

  try {
    const parsed = JSON.parse(result.stdout) as { task?: unknown; mode?: unknown };
    return typeof parsed === "object" && parsed !== null && (parsed.mode === "agent" || typeof parsed.task === "string");
  } catch {
    return false;
  }
}

async function checkActiveCli(executable: string | null, cwd: string): Promise<boolean> {
  if (!executable) {
    return modernWorkAgentSupported;
  }

  const result = await runCommand(process.execPath, [executable, "work", "doctor capability check", "--agent"], cwd);
  return supportsWorkAgent(result);
}

async function inspectShellCommand(command: string, cwd: string, activeVersion: string | undefined, activeSupportsAgent: boolean): Promise<ShellCommandCheck> {
  const resolvedPath = await resolveShellCommand(command);
  if (!resolvedPath) {
    return {
      command,
      supportsWorkAgent: false,
      status: "missing",
      note: "Command was not found on PATH."
    };
  }

  const versionResult = await runCommand(resolvedPath, ["--version"], cwd);
  const versionOutput = firstOutputLine(versionResult.stdout) ?? firstOutputLine(versionResult.stderr) ?? "unknown";
  const capabilityResult = await runCommand(resolvedPath, ["work", "doctor capability check", "--agent"], cwd);
  const commandSupportsAgent = supportsWorkAgent(capabilityResult);
  const commandVersion = firstVersion(versionOutput);
  const runningVersion = firstVersion(activeVersion);

  if (activeSupportsAgent && !commandSupportsAgent) {
    const note = commandVersion && runningVersion && commandVersion === runningVersion
      ? `Capability mismatch: command reports ${commandVersion} but does not support work --agent.`
      : "Capability mismatch: command does not support work --agent.";
    return {
      command,
      resolvedPath,
      versionOutput,
      supportsWorkAgent: false,
      status: "capability mismatch",
      note
    };
  }

  if (commandVersion && runningVersion && compareVersion(commandVersion, runningVersion) < 0) {
    return {
      command,
      resolvedPath,
      versionOutput,
      supportsWorkAgent: commandSupportsAgent,
      status: "stale",
      note: `Stale command: reports ${commandVersion}, active CLI reports ${runningVersion}.`
    };
  }

  return {
    command,
    resolvedPath,
    versionOutput,
    supportsWorkAgent: commandSupportsAgent,
    status: "ok"
  };
}

function formatShellCommandCheck(check: ShellCommandCheck): string[] {
  return [
    `${check.command}: ${check.status}`,
    `  Resolved path: ${display(check.resolvedPath)}`,
    `  Version output: ${display(check.versionOutput)}`,
    `  Supports work --agent: ${check.supportsWorkAgent ? "yes" : "no"}`,
    ...(check.note ? [`  ${check.note}`] : [])
  ];
}

function suggestedFixes(): string[] {
  return [
    "Suggested fixes:",
    "- npm uninstall -g repo-context-center",
    "- npm install -g repo-context-center@latest",
    "- hash -r",
    "- Get-Command rcc",
    "- Get-Command repo-context-center",
    "- which rcc",
    "- which repo-context-center"
  ];
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
  const activeSupportsAgent = await checkActiveCli(executable, io.cwd);
  const shellChecks = await Promise.all([
    inspectShellCommand("rcc", io.cwd, runningVersion, activeSupportsAgent),
    inspectShellCommand("repo-context-center", io.cwd, runningVersion, activeSupportsAgent)
  ]);
  const runningFromRepo = isInsidePath(executable, repoPackage?.path ?? null);
  const runningFromLocalInstall = isInsidePath(executable, localInstall?.path ?? null);
  const repoPackageMismatch = repoName === packageName
    && Boolean(runningVersion)
    && Boolean(repoVersion)
    && runningVersion !== repoVersion
    && !runningFromRepo;
  const localInstallNewer = compareVersion(localVersion, runningVersion) > 0 && !runningFromLocalInstall;
  const localInstallOlder = compareVersion(localVersion, runningVersion) < 0 && Boolean(localVersion);
  const declaredDependencyNewer = compareVersion(declaredDependency, runningVersion) > 0;
  const shellProblems = shellChecks.filter((check) => check.status !== "ok");
  const shellPathDiffers = shellChecks.some((check) =>
    check.status === "ok" && check.resolvedPath !== undefined && executable !== null && check.resolvedPath !== executable
  );
  const shouldWarn = repoPackageMismatch || localInstallNewer || localInstallOlder || declaredDependencyNewer || shellProblems.length > 0 || shellPathDiffers;

  const lines = [
    "repo-context-center doctor",
    "",
    `Running CLI version: ${display(runningVersion)}`,
    `Running CLI supports work --agent: ${activeSupportsAgent ? "yes" : "no"}`,
    `Repo package version: ${repoName === packageName ? display(repoVersion) : "not repo-context-center"}`,
    `Package dependency version: ${declaredDependency ?? "not declared"}`,
    `Nearest local install: ${displayInstall(localInstall)}`,
    `Execution path: ${display(executable)}`,
    "",
    "Shell commands:",
    ...shellChecks.flatMap(formatShellCommandCheck),
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
  } else if (localInstallOlder) {
    lines.push(
      `Detected local ${packageName}@${localVersion} but active CLI is ${runningVersion}.`,
      "Local package and active CLI are not aligned."
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
  } else if (shellPathDiffers) {
    lines.push("Shell command paths differ from the active CLI execution path; command capabilities were checked above.");
  } else if (!shouldWarn) {
    lines.push("Local package and active CLI are aligned.");
  }

  if (shellProblems.length > 0 || localInstallOlder || localInstallNewer || declaredDependencyNewer) {
    lines.push("", ...suggestedFixes());
  }

  io.stdout(`${lines.join("\n")}\n`);
  return 0;
}
