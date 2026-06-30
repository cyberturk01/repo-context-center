import { readFile, readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

export type EcosystemId = "node" | "maven" | "gradle" | "python" | "go" | "dotnet" | "monorepo";
export type EcosystemConfidence = "low" | "medium" | "high";

export interface EcosystemDetection {
  id: EcosystemId;
  confidence: EcosystemConfidence;
  matchedSignals: string[];
  rootPath: string;
  packageName?: string;
}

export type WorkspaceType = "directory" | "npm" | "pnpm" | "yarn" | "turborepo" | "nx" | "lerna" | "mixed";

export interface WorkspacePackage {
  rootPath: string;
  name: string;
  ecosystemIds: EcosystemId[];
}

export interface WorkspaceDetection {
  detected: boolean;
  type: WorkspaceType | "none";
  rootPath: string;
  packageCount: number;
  packages: WorkspacePackage[];
  matchedSignals: string[];
}

export interface EcosystemDetectionReport {
  primary: EcosystemDetection | null;
  detections: EcosystemDetection[];
  workspace: WorkspaceDetection;
}

interface CandidateRoot {
  rootPath: string;
  fileNames: string[];
}

const workspaceDirectorySignals = ["apps", "packages", "services", "libs", "modules"];

function repoPath(...parts: string[]): string {
  const joined = path.posix.join(...parts.filter(Boolean));
  return joined === "." ? "" : joined;
}

function signalPath(rootPath: string, signal: string): string {
  return rootPath === "." ? signal : repoPath(rootPath, signal);
}

function confidenceRank(confidence: EcosystemConfidence): number {
  return confidence === "high" ? 2 : confidence === "medium" ? 1 : 0;
}

function ecosystemRank(id: EcosystemId): number {
  return id === "monorepo" ? 0 : 1;
}

function sortDetections(detections: EcosystemDetection[]): EcosystemDetection[] {
  return detections.sort((left, right) => {
    const confidenceDelta = confidenceRank(right.confidence) - confidenceRank(left.confidence);
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    const ecosystemDelta = ecosystemRank(right.id) - ecosystemRank(left.id);
    if (ecosystemDelta !== 0) {
      return ecosystemDelta;
    }

    if (left.rootPath !== right.rootPath) {
      if (left.rootPath === ".") {
        return -1;
      }
      if (right.rootPath === ".") {
        return 1;
      }
    }

    const signalDelta = right.matchedSignals.length - left.matchedSignals.length;
    if (signalDelta !== 0) {
      return signalDelta;
    }

    return `${left.id}:${left.rootPath}`.localeCompare(`${right.id}:${right.rootPath}`);
  });
}

async function safeReadDir(dirPath: string): Promise<Dirent[]> {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function safeReadText(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function packageName(cwd: string, rootPath: string): Promise<string | undefined> {
  const packagePath = path.join(cwd, rootPath === "." ? "" : rootPath, "package.json");
  const content = await safeReadText(packagePath);
  if (!content) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(content) as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function candidateRoots(cwd: string): Promise<{ roots: CandidateRoot[]; topLevelDirs: string[] }> {
  const rootEntries = await safeReadDir(cwd);
  const topLevelDirs = rootEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const roots: CandidateRoot[] = [{
    rootPath: ".",
    fileNames: rootEntries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  }];

  for (const directory of workspaceDirectorySignals) {
    if (!topLevelDirs.includes(directory)) {
      continue;
    }

    const entries = await safeReadDir(path.join(cwd, directory));
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const childRoot = repoPath(directory, entry.name);
      const childEntries = await safeReadDir(path.join(cwd, childRoot));
      roots.push({
        rootPath: childRoot,
        fileNames: childEntries.filter((child) => child.isFile()).map((child) => child.name)
      });
    }
  }

  return { roots, topLevelDirs };
}

function exactSignals(root: CandidateRoot, names: string[]): string[] {
  const files = new Set(root.fileNames);
  return names
    .filter((name) => files.has(name))
    .map((name) => signalPath(root.rootPath, name));
}

function suffixSignals(root: CandidateRoot, suffixes: string[]): string[] {
  return root.fileNames
    .filter((name) => suffixes.some((suffix) => name.endsWith(suffix)))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => signalPath(root.rootPath, name));
}

function addDetection(
  detections: EcosystemDetection[],
  id: EcosystemId,
  rootPath: string,
  matchedSignals: string[],
  confidence: EcosystemConfidence,
  packageNameValue?: string
): void {
  if (matchedSignals.length === 0) {
    return;
  }

  detections.push({
    id,
    confidence,
    matchedSignals,
    rootPath,
    ...(packageNameValue ? { packageName: packageNameValue } : {})
  });
}

async function pythonPytestSignals(cwd: string, root: CandidateRoot): Promise<string[]> {
  const files = new Set(root.fileNames);
  const rootDir = root.rootPath === "." ? cwd : path.join(cwd, root.rootPath);
  const signals: string[] = [];

  for (const fileName of ["pyproject.toml", "requirements.txt", "setup.py"]) {
    if (!files.has(fileName)) {
      continue;
    }

    const content = await safeReadText(path.join(rootDir, fileName));
    if (/\bpytest\b/i.test(content) || /\[tool\.pytest\b/i.test(content)) {
      signals.push(`${signalPath(root.rootPath, fileName)}#pytest`);
    }
  }

  return signals;
}

async function detectRootEcosystems(cwd: string, root: CandidateRoot): Promise<EcosystemDetection[]> {
  const detections: EcosystemDetection[] = [];
  const packageNameValue = await packageName(cwd, root.rootPath);
  const nodeSignals = exactSignals(root, ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json"]);
  const mavenSignals = exactSignals(root, ["pom.xml"]);
  const gradleSignals = exactSignals(root, ["build.gradle", "build.gradle.kts", "gradlew"]);
  const pythonSignals = [
    ...exactSignals(root, ["pyproject.toml", "requirements.txt", "setup.py", "pytest.ini"]),
    ...await pythonPytestSignals(cwd, root)
  ];
  const goSignals = exactSignals(root, ["go.mod"]);
  const dotnetSignals = [
    ...suffixSignals(root, [".csproj"]),
    ...suffixSignals(root, [".sln"])
  ];

  addDetection(detections, "node", root.rootPath, nodeSignals, nodeSignals.includes(signalPath(root.rootPath, "package.json")) ? "high" : "medium", packageNameValue);
  addDetection(detections, "maven", root.rootPath, mavenSignals, "high", path.posix.basename(root.rootPath));
  addDetection(detections, "gradle", root.rootPath, gradleSignals, gradleSignals.length >= 2 ? "high" : "medium", path.posix.basename(root.rootPath));
  addDetection(detections, "python", root.rootPath, pythonSignals, pythonSignals.some((signal) => /(?:^|\/)(pyproject\.toml|setup\.py)$/.test(signal)) ? "high" : "medium", packageNameValue ?? path.posix.basename(root.rootPath));
  addDetection(detections, "go", root.rootPath, goSignals, "high", path.posix.basename(root.rootPath));
  addDetection(detections, "dotnet", root.rootPath, dotnetSignals, "high", path.posix.basename(root.rootPath));

  return detections;
}

async function packageJsonWorkspaceSignals(cwd: string): Promise<{ signals: string[]; type: WorkspaceType | null }> {
  const content = await safeReadText(path.join(cwd, "package.json"));
  if (!content) {
    return { signals: [], type: null };
  }

  try {
    const parsed = JSON.parse(content) as { workspaces?: unknown; packageManager?: unknown; devDependencies?: Record<string, unknown>; dependencies?: Record<string, unknown> };
    const dependencies = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) };
    const signals: string[] = [];
    let type: WorkspaceType | null = null;
    if (Array.isArray(parsed.workspaces) || Boolean((parsed.workspaces as { packages?: unknown } | undefined)?.packages)) {
      signals.push("package.json#workspaces");
      type = typeof parsed.packageManager === "string" && parsed.packageManager.startsWith("yarn@") ? "yarn" : "npm";
    }
    if ("turbo" in dependencies) {
      signals.push("package.json#turbo");
      type = combineWorkspaceType(type, "turborepo");
    }
    if ("nx" in dependencies || "@nx/workspace" in dependencies) {
      signals.push("package.json#nx");
      type = combineWorkspaceType(type, "nx");
    }
    if ("lerna" in dependencies) {
      signals.push("package.json#lerna");
      type = combineWorkspaceType(type, "lerna");
    }
    return { signals, type };
  } catch {
    return { signals: [], type: null };
  }
}

function combineWorkspaceType(current: WorkspaceType | null, next: WorkspaceType): WorkspaceType {
  return current === null || current === next ? next : "mixed";
}

async function workspaceFileSignals(cwd: string, topLevelDirs: string[]): Promise<{ signals: string[]; type: WorkspaceType | null }> {
  const rootFiles = new Set((await safeReadDir(cwd)).filter((entry) => entry.isFile()).map((entry) => entry.name));
  const signals: string[] = [];
  let type: WorkspaceType | null = null;

  if (rootFiles.has("pnpm-workspace.yaml")) {
    signals.push("pnpm-workspace.yaml");
    type = "pnpm";
  }
  if (rootFiles.has("turbo.json")) {
    signals.push("turbo.json");
    type = combineWorkspaceType(type, "turborepo");
  }
  if (rootFiles.has("nx.json")) {
    signals.push("nx.json");
    type = combineWorkspaceType(type, "nx");
  }
  if (rootFiles.has("lerna.json")) {
    signals.push("lerna.json");
    type = combineWorkspaceType(type, "lerna");
  }
  if (rootFiles.has("yarn.lock") && topLevelDirs.some((dir) => workspaceDirectorySignals.includes(dir))) {
    signals.push("yarn.lock#workspaces");
    type = type ?? "yarn";
  }

  return { signals, type };
}

function mergeWorkspaceType(types: Array<WorkspaceType | null>): WorkspaceType | null {
  const unique = [...new Set(types.filter((type): type is WorkspaceType => type !== null))];
  if (unique.length === 0) {
    return null;
  }
  if (unique.length === 1) {
    return unique[0];
  }
  return "mixed";
}

function workspacePackages(detections: EcosystemDetection[]): WorkspacePackage[] {
  const byRoot = new Map<string, WorkspacePackage>();

  for (const detection of detections) {
    if (detection.id === "monorepo" || detection.rootPath === ".") {
      continue;
    }

    const existing = byRoot.get(detection.rootPath);
    const name = detection.packageName ?? path.posix.basename(detection.rootPath);
    if (existing) {
      existing.ecosystemIds = [...new Set([...existing.ecosystemIds, detection.id])];
      continue;
    }

    byRoot.set(detection.rootPath, {
      rootPath: detection.rootPath,
      name,
      ecosystemIds: [detection.id]
    });
  }

  return [...byRoot.values()].sort((left, right) => left.rootPath.localeCompare(right.rootPath));
}

async function detectWorkspace(cwd: string, topLevelDirs: string[], ecosystemDetections: EcosystemDetection[]): Promise<WorkspaceDetection> {
  const directorySignals = workspaceDirectorySignals
    .filter((directory) => topLevelDirs.includes(directory))
    .map((directory) => `${directory}/`);
  const packageJsonSignals = await packageJsonWorkspaceSignals(cwd);
  const fileSignals = await workspaceFileSignals(cwd, topLevelDirs);
  const matchedSignals = [...packageJsonSignals.signals, ...fileSignals.signals, ...directorySignals];
  const packages = workspacePackages(ecosystemDetections);
  const type = mergeWorkspaceType([packageJsonSignals.type, fileSignals.type]) ?? (directorySignals.length > 0 ? "directory" : "none");

  return {
    detected: matchedSignals.length > 0 || packages.length >= 2,
    type,
    rootPath: ".",
    packageCount: packages.length,
    packages,
    matchedSignals
  };
}

async function detectMonorepo(cwd: string, topLevelDirs: string[], workspace: WorkspaceDetection): Promise<EcosystemDetection | null> {
  const matchedSignals = workspace.matchedSignals;

  if (!workspace.detected) {
    return null;
  }

  const confidence: EcosystemConfidence = matchedSignals.some((signal) => /workspaces|pnpm-workspace|turbo|nx|lerna/i.test(signal))
    ? "high"
    : matchedSignals.length >= 2 || workspace.packageCount >= 2
      ? "medium"
      : "low";

  return {
    id: "monorepo",
    confidence,
    matchedSignals,
    rootPath: "."
  };
}

export async function detectRepositoryEcosystems(cwd: string): Promise<EcosystemDetectionReport> {
  const { roots, topLevelDirs } = await candidateRoots(cwd);
  const ecosystemDetections = (await Promise.all(roots.map((root) => detectRootEcosystems(cwd, root)))).flat();
  const workspace = await detectWorkspace(cwd, topLevelDirs, ecosystemDetections);
  const monorepo = await detectMonorepo(cwd, topLevelDirs, workspace);
  const detections = sortDetections(monorepo ? [...ecosystemDetections, monorepo] : ecosystemDetections);

  return {
    primary: detections.find((detection) => detection.id !== "monorepo") ?? detections[0] ?? null,
    detections,
    workspace
  };
}
