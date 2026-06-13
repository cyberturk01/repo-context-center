import path from "node:path";
import { listDirectoryNames, listFilesRecursive, readTextFile } from "./fileSystem";

export interface ScannedModule {
  name: string;
  path: string;
  sourceRoot: string;
}

export type ScannedSymbolKind = "function" | "class" | "interface" | "type" | "const" | "export";

export interface ScannedSymbol {
  name: string;
  kind: ScannedSymbolKind;
  path: string;
}

export interface ScannedSourceFile {
  path: string;
  symbols: ScannedSymbol[];
  tests: string[];
}

export interface ScanReport {
  root: string;
  detected: {
    sourceFolders: string[];
    testFolders: string[];
    generatedFolders: string[];
    modules: ScannedModule[];
    sourceFiles: ScannedSourceFile[];
  };
  suggestions: {
    "MODULE_INDEX.md": string[];
    "DO_NOT_READ.md": string[];
    "TASK_ROUTING.md": string[];
    "SYMBOL_MAP.md": string[];
  };
}

const sourceFolderNames = ["src", "app", "lib", "packages"];
const testFolderNames = ["tests", "test", "__tests__", "cypress", "e2e"];
const generatedFolderNames = ["node_modules", "dist", "build", "coverage", ".next", "target"];
const ignoredModuleNames = new Set([...generatedFolderNames, ...testFolderNames]);
const sourceFilePattern = /\.(?:ts|tsx|js|jsx)$/;
const declarationFilePattern = /\.d\.ts$/;
const testFilePattern = /(?:^|\/)(?:__tests__|tests?|e2e|cypress)\/|(?:\.test|\.spec)\.(?:ts|tsx|js|jsx)$/;
const maxSymbolReadBytes = 128 * 1024;

function intersectSorted(names: string[], candidates: string[]): string[] {
  const nameSet = new Set(names);
  return candidates.filter((candidate) => nameSet.has(candidate));
}

function toRelativePath(...parts: string[]): string {
  return parts.join("/");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
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

function isSourceFile(filePath: string): boolean {
  return sourceFilePattern.test(filePath)
    && !declarationFilePattern.test(filePath)
    && !testFilePattern.test(filePath);
}

function isTestFile(filePath: string): boolean {
  return sourceFilePattern.test(filePath) && testFilePattern.test(filePath);
}

function addRegexSymbols(
  symbols: ScannedSymbol[],
  sourcePath: string,
  content: string,
  pattern: RegExp,
  kind: ScannedSymbolKind
): void {
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    symbols.push({ name: match[1], kind, path: sourcePath });
  }
}

export function extractExportedSymbols(sourcePath: string, content: string): ScannedSymbol[] {
  const symbols: ScannedSymbol[] = [];

  addRegexSymbols(symbols, sourcePath, content, /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g, "function");
  addRegexSymbols(symbols, sourcePath, content, /\bexport\s+class\s+([A-Za-z_$][\w$]*)/g, "class");
  addRegexSymbols(symbols, sourcePath, content, /\bexport\s+interface\s+([A-Za-z_$][\w$]*)/g, "interface");
  addRegexSymbols(symbols, sourcePath, content, /\bexport\s+type\s+([A-Za-z_$][\w$]*)/g, "type");
  addRegexSymbols(symbols, sourcePath, content, /\bexport\s+const\s+([A-Za-z_$][\w$]*)/g, "const");

  const namedExportPattern = /\bexport\s*\{([^}]+)\}/g;
  let exportMatch: RegExpExecArray | null;
  while ((exportMatch = namedExportPattern.exec(content)) !== null) {
    for (const part of exportMatch[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/i)[0]?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) {
        symbols.push({ name, kind: "export", path: sourcePath });
      }
    }
  }

  const byName = new Map<string, ScannedSymbol>();
  for (const symbol of symbols) {
    byName.set(symbol.name, symbol);
  }

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function sourceTestKey(filePath: string): string {
  return filePath
    .replace(/\.(?:test|spec)\.(?:ts|tsx|js|jsx)$/, "")
    .replace(/\.(?:ts|tsx|js|jsx)$/, "")
    .replace(/^src\//, "")
    .replace(/^app\//, "")
    .replace(/^lib\//, "")
    .replace(/^packages\//, "")
    .replace(/^tests?\//, "")
    .replace(/^__tests__\//, "");
}

function findCommonTests(sourcePath: string, testFiles: string[]): string[] {
  const sourceKey = sourceTestKey(sourcePath);
  const sourceBase = path.posix.basename(sourceKey);

  return testFiles.filter((testFile) => {
    const testKey = sourceTestKey(testFile);
    return testKey === sourceKey
      || path.posix.basename(testKey) === sourceBase
      || testKey.endsWith(`/${sourceBase}`);
  });
}

async function detectSourceFiles(cwd: string, sourceFolders: string[], testFolders: string[]): Promise<ScannedSourceFile[]> {
  const files = uniqueSorted((await Promise.all(
    [...sourceFolders, ...testFolders].map(async (folder) => {
      const folderFiles = await listFilesRecursive(path.join(cwd, folder));
      return folderFiles.map((file) => toRelativePath(folder, file));
    })
  )).flat());

  const sourceFiles = files.filter(isSourceFile);
  const testFiles = files.filter(isTestFile);
  const scanned: ScannedSourceFile[] = [];

  for (const sourceFile of sourceFiles) {
    const content = await readTextFile(path.join(cwd, sourceFile));
    const sourceText = content.length > maxSymbolReadBytes ? content.slice(0, maxSymbolReadBytes) : content;
    const symbols = extractExportedSymbols(sourceFile, sourceText);

    if (symbols.length > 0) {
      scanned.push({
        path: sourceFile,
        symbols,
        tests: findCommonTests(sourceFile, testFiles)
      });
    }
  }

  return scanned.sort((left, right) => left.path.localeCompare(right.path));
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

function buildSymbolMapSuggestions(sourceFiles: ScannedSourceFile[]): string[] {
  const lines = ["Suggested SYMBOL_MAP.md entries:", ""];

  if (sourceFiles.length === 0) {
    lines.push("_No exported symbols detected in JavaScript or TypeScript source files._");
    return lines;
  }

  for (const sourceFile of sourceFiles) {
    lines.push(`## ${sourceFile.path}`);
    lines.push("");
    lines.push("Important symbols:");
    lines.push(...sourceFile.symbols.map((symbol) => `- ${symbol.name}`));
    lines.push("");
    lines.push("Common tests:");
    if (sourceFile.tests.length > 0) {
      lines.push(...sourceFile.tests.map((testFile) => `- ${testFile}`));
    } else {
      lines.push("- _none detected_");
    }
    lines.push("");
    lines.push("Risk:");
    lines.push("unknown");
    lines.push("");
  }

  return lines;
}

export async function scanRepository(cwd: string): Promise<ScanReport> {
  const topLevelDirs = await listDirectoryNames(cwd);
  const sourceFolders = intersectSorted(topLevelDirs, sourceFolderNames);
  const testFolders = intersectSorted(topLevelDirs, testFolderNames);
  const generatedFolders = intersectSorted(topLevelDirs, generatedFolderNames);
  const modules = await detectModules(cwd, sourceFolders);
  const sourceFiles = await detectSourceFiles(cwd, sourceFolders, testFolders);
  const detected = { sourceFolders, testFolders, generatedFolders, modules, sourceFiles };

  return {
    root: cwd,
    detected,
    suggestions: {
      "MODULE_INDEX.md": buildModuleSuggestions(detected),
      "DO_NOT_READ.md": buildDoNotReadSuggestions(generatedFolders),
      "TASK_ROUTING.md": buildTaskRoutingSuggestions(detected),
      "SYMBOL_MAP.md": buildSymbolMapSuggestions(sourceFiles)
    }
  };
}
