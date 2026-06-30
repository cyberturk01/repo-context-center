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
}

export interface EcosystemDetectionReport {
  primary: EcosystemDetection | null;
  detections: EcosystemDetection[];
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
  confidence: EcosystemConfidence
): void {
  if (matchedSignals.length === 0) {
    return;
  }

  detections.push({
    id,
    confidence,
    matchedSignals,
    rootPath
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

  addDetection(detections, "node", root.rootPath, nodeSignals, nodeSignals.includes(signalPath(root.rootPath, "package.json")) ? "high" : "medium");
  addDetection(detections, "maven", root.rootPath, mavenSignals, "high");
  addDetection(detections, "gradle", root.rootPath, gradleSignals, gradleSignals.length >= 2 ? "high" : "medium");
  addDetection(detections, "python", root.rootPath, pythonSignals, pythonSignals.some((signal) => /(?:^|\/)(pyproject\.toml|setup\.py)$/.test(signal)) ? "high" : "medium");
  addDetection(detections, "go", root.rootPath, goSignals, "high");
  addDetection(detections, "dotnet", root.rootPath, dotnetSignals, "high");

  return detections;
}

async function packageJsonWorkspaceSignals(cwd: string): Promise<string[]> {
  const content = await safeReadText(path.join(cwd, "package.json"));
  if (!content) {
    return [];
  }

  try {
    const parsed = JSON.parse(content) as { workspaces?: unknown };
    if (Array.isArray(parsed.workspaces) || Boolean((parsed.workspaces as { packages?: unknown } | undefined)?.packages)) {
      return ["package.json#workspaces"];
    }
  } catch {
    return [];
  }

  return [];
}

async function detectMonorepo(cwd: string, topLevelDirs: string[], ecosystemRoots: string[]): Promise<EcosystemDetection | null> {
  const directorySignals = workspaceDirectorySignals
    .filter((directory) => topLevelDirs.includes(directory))
    .map((directory) => `${directory}/`);
  const workspaceSignals = await packageJsonWorkspaceSignals(cwd);
  const matchedSignals = [...workspaceSignals, ...directorySignals];

  if (matchedSignals.length === 0 && new Set(ecosystemRoots.filter((rootPath) => rootPath !== ".")).size < 2) {
    return null;
  }

  const confidence: EcosystemConfidence = workspaceSignals.length > 0
    ? "high"
    : matchedSignals.length >= 2 || new Set(ecosystemRoots.filter((rootPath) => rootPath !== ".")).size >= 2
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
  const monorepo = await detectMonorepo(cwd, topLevelDirs, ecosystemDetections.map((detection) => detection.rootPath));
  const detections = sortDetections(monorepo ? [...ecosystemDetections, monorepo] : ecosystemDetections);

  return {
    primary: detections.find((detection) => detection.id !== "monorepo") ?? detections[0] ?? null,
    detections
  };
}
