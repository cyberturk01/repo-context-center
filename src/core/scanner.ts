import path from "node:path";
import { listDirectoryNames } from "./fileSystem";

export interface ScannedModule {
  name: string;
  path: string;
  sourceRoot: string;
}

export interface ScanReport {
  root: string;
  detected: {
    sourceFolders: string[];
    testFolders: string[];
    generatedFolders: string[];
    modules: ScannedModule[];
  };
  suggestions: {
    "MODULE_INDEX.md": string[];
    "DO_NOT_READ.md": string[];
    "TASK_ROUTING.md": string[];
  };
}

const sourceFolderNames = ["src", "app", "lib", "packages"];
const testFolderNames = ["tests", "test", "__tests__", "cypress", "e2e"];
const generatedFolderNames = ["node_modules", "dist", "build", "coverage", ".next", "target"];
const ignoredModuleNames = new Set([...generatedFolderNames, ...testFolderNames]);

function intersectSorted(names: string[], candidates: string[]): string[] {
  const nameSet = new Set(names);
  return candidates.filter((candidate) => nameSet.has(candidate));
}

function toRelativePath(...parts: string[]): string {
  return parts.join("/");
}

async function detectModules(cwd: string, sourceFolders: string[]): Promise<ScannedModule[]> {
  const modules: ScannedModule[] = [];

  for (const sourceRoot of sourceFolders) {
    const childDirs = await listDirectoryNames(path.join(cwd, sourceRoot));

    for (const childDir of childDirs) {
      if (ignoredModuleNames.has(childDir)) {
        continue;
      }

      modules.push({
        name: childDir,
        path: toRelativePath(sourceRoot, childDir),
        sourceRoot
      });
    }
  }

  return modules.sort((left, right) => left.path.localeCompare(right.path));
}

function buildModuleSuggestions(report: Pick<ScanReport["detected"], "sourceFolders" | "modules">): string[] {
  const lines = [
    "Suggested MODULE_INDEX.md entries:",
    "",
    "| Path | Owns | Read When |",
    "| --- | --- | --- |"
  ];

  if (report.modules.length > 0) {
    for (const module of report.modules) {
      lines.push(`| \`${module.path}\` | ${module.name} module | Work touches this area |`);
    }
  } else if (report.sourceFolders.length > 0) {
    for (const sourceFolder of report.sourceFolders) {
      lines.push(`| \`${sourceFolder}\` | Source root | Work touches source code |`);
    }
  } else {
    lines.push("| _none detected_ | Add source folders manually | Repository layout is empty or custom |");
  }

  return lines;
}

function buildDoNotReadSuggestions(generatedFolders: string[]): string[] {
  const folders = generatedFolders.length > 0 ? generatedFolders : generatedFolderNames;
  return [
    "Suggested DO_NOT_READ.md entries:",
    "",
    ...folders.map((folder) => `- \`${folder}/\``)
  ];
}

function buildTaskRoutingSuggestions(detected: ScanReport["detected"]): string[] {
  const sourceText = detected.sourceFolders.length > 0
    ? detected.sourceFolders.map((folder) => `\`${folder}/\``).join(", ")
    : "source files";
  const testText = detected.testFolders.length > 0
    ? detected.testFolders.map((folder) => `\`${folder}/\``).join(", ")
    : "nearby tests";

  return [
    "Suggested TASK_ROUTING.md notes:",
    "",
    `- Feature or bug work: start with ${sourceText}.`,
    `- Test updates: check ${testText}.`,
    "- Context updates: keep MODULE_INDEX.md and DO_NOT_READ.md aligned with layout changes."
  ];
}

export async function scanRepository(cwd: string): Promise<ScanReport> {
  const topLevelDirs = await listDirectoryNames(cwd);
  const sourceFolders = intersectSorted(topLevelDirs, sourceFolderNames);
  const testFolders = intersectSorted(topLevelDirs, testFolderNames);
  const generatedFolders = intersectSorted(topLevelDirs, generatedFolderNames);
  const modules = await detectModules(cwd, sourceFolders);
  const detected = { sourceFolders, testFolders, generatedFolders, modules };

  return {
    root: cwd,
    detected,
    suggestions: {
      "MODULE_INDEX.md": buildModuleSuggestions(detected),
      "DO_NOT_READ.md": buildDoNotReadSuggestions(generatedFolders),
      "TASK_ROUTING.md": buildTaskRoutingSuggestions(detected)
    }
  };
}
