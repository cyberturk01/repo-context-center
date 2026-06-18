export type RepoFileRole =
  | "source"
  | "test"
  | "workflow"
  | "config"
  | "docs"
  | "package"
  | "generated"
  | "fixture"
  | "snapshot"
  | "asset"
  | "unknown";

export interface RepoFileInfo {
  path: string;
  role: RepoFileRole;
  isNoise: boolean;
  isLikelyEntrypoint: boolean;
  language?: string;
  packageScope?: string;
  reasons: string[];
}

const generatedDirs = new Set([
  ".cache",
  ".mypy_cache",
  ".next",
  ".parcel-cache",
  ".pytest_cache",
  ".turbo",
  ".venv",
  "build",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "out",
  "target",
  "vendor"
]);
const fixtureDirs = new Set(["fixtures", "__fixtures__", "test-fixtures"]);
const snapshotDirs = new Set(["__snapshots__"]);
const sourceRoots = new Set(["src", "app", "lib"]);
const testRoots = new Set(["tests", "test", "__tests__", "cypress", "e2e"]);
const packageFileNames = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "pyproject.toml",
  "cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle"
]);
const exactConfigFiles = new Set(["tsconfig.json", "docker-compose.yml", "dockerfile"]);
const assetExtensions = new Set([
  ".avif",
  ".bmp",
  ".css",
  ".eot",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".less",
  ".m4v",
  ".mov",
  ".mp3",
  ".mp4",
  ".otf",
  ".png",
  ".scss",
  ".svg",
  ".ttf",
  ".wav",
  ".woff",
  ".woff2",
  ".webp"
]);

export function isGeneratedRepoDirectoryName(name: string): boolean {
  return generatedDirs.has(name.toLowerCase());
}

export function classifyRepoFile(filePath: string): RepoFileInfo {
  const normalizedPath = normalizeRepoPath(filePath);
  const parts = normalizedPath.split("/").filter(Boolean);
  const lowerParts = parts.map((part) => part.toLowerCase());
  const basename = parts[parts.length - 1] ?? normalizedPath;
  const lowerPath = normalizedPath.toLowerCase();
  const lowerBase = basename.toLowerCase();
  const reasons: string[] = [];
  const packageScope = detectPackageScope(parts, lowerParts);
  const language = detectLanguage(basename);

  let role: RepoFileRole = "unknown";

  if (lowerParts.some((part) => generatedDirs.has(part))) {
    role = "generated";
    reasons.push("path is under a generated, dependency, or build output directory");
  } else if (lowerParts.some((part) => snapshotDirs.has(part)) || lowerBase.endsWith(".snap")) {
    role = "snapshot";
    reasons.push("path is a snapshot file or under a snapshot directory");
  } else if (lowerParts.some((part) => fixtureDirs.has(part))) {
    role = "fixture";
    reasons.push("path is under a fixture directory");
  } else if (isWorkflowPath(lowerPath, lowerBase)) {
    role = "workflow";
    reasons.push("path is a CI or workflow file");
  } else if (packageFileNames.has(lowerBase)) {
    role = "package";
    reasons.push("path is package or dependency metadata");
  } else if (isConfigPath(lowerBase)) {
    role = "config";
    reasons.push("path is a common project configuration file");
  } else if (assetExtensions.has(extensionOf(lowerBase))) {
    role = "asset";
    reasons.push("path has a common asset extension");
  } else if (isDocsPath(lowerPath, lowerBase)) {
    role = "docs";
    reasons.push("path is documentation");
  } else if (isTestPath(lowerParts, lowerBase, lowerPath)) {
    role = "test";
    reasons.push("path matches common test layout or test filename pattern");
  } else if (isSourcePath(lowerParts)) {
    role = "source";
    reasons.push("path is under a common source root");
  }

  const info: RepoFileInfo = {
    path: normalizedPath,
    role,
    isNoise: role === "generated" || role === "fixture" || role === "snapshot",
    isLikelyEntrypoint: isLikelyEntrypoint(lowerParts, lowerBase, role),
    reasons
  };

  if (language) {
    info.language = language;
  }
  if (packageScope) {
    info.packageScope = packageScope;
  }

  return info;
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/g, "");
}

function detectPackageScope(parts: string[], lowerParts: string[]): string | undefined {
  if ((lowerParts[0] === "packages" || lowerParts[0] === "libs") && parts[1]) {
    return `${parts[0]}/${parts[1]}`;
  }

  return undefined;
}

function detectLanguage(basename: string): string | undefined {
  const lowerBase = basename.toLowerCase();
  const extension = extensionOf(lowerBase);

  switch (extension) {
    case ".ts":
      return "typescript";
    case ".tsx":
      return "typescriptreact";
    case ".js":
      return "javascript";
    case ".jsx":
      return "javascriptreact";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".rs":
      return "rust";
    case ".java":
      return "java";
    case ".rb":
      return "ruby";
    case ".md":
      return "markdown";
    case ".json":
      return "json";
    case ".yml":
    case ".yaml":
      return "yaml";
    default:
      return undefined;
  }
}

function extensionOf(basename: string): string {
  const index = basename.lastIndexOf(".");
  return index >= 0 ? basename.slice(index) : "";
}

function isWorkflowPath(filePath: string, basename: string): boolean {
  return filePath.startsWith(".github/workflows/")
    || basename === ".gitlab-ci.yml"
    || basename === "jenkinsfile";
}

function isConfigPath(basename: string): boolean {
  if (exactConfigFiles.has(basename)) {
    return true;
  }

  return /(^|\.)(eslint|prettier|vite|webpack|rollup)\.config\.[cm]?[jt]s$/i.test(basename)
    || /^\.?(eslintrc|prettierrc)(\.[a-z0-9]+)?$/i.test(basename);
}

function isDocsPath(filePath: string, basename: string): boolean {
  return basename === "readme.md"
    || filePath.startsWith("docs/")
    || basename.endsWith(".md");
}

function isTestPath(parts: string[], basename: string, lowerPath: string): boolean {
  if (parts.some((part) => testRoots.has(part))) {
    return true;
  }

  if ((parts[0] === "packages" || parts[0] === "libs") && parts[1] && (parts[2] === "tests" || parts[2] === "test")) {
    return true;
  }

  return /\.(test|spec)\.[^.]+$/i.test(basename)
    || /(^|\/)test_[^/]+\.py$/i.test(lowerPath)
    || /(^|\/)[^/]+_test\.py$/i.test(lowerPath);
}

function isSourcePath(parts: string[]): boolean {
  if (parts.length === 0) {
    return false;
  }

  if (sourceRoots.has(parts[0])) {
    return true;
  }

  return (parts[0] === "packages" || parts[0] === "libs") && parts[1] !== undefined && parts[2] === "src";
}

function isLikelyEntrypoint(parts: string[], basename: string, role: RepoFileRole): boolean {
  if (role !== "source" && role !== "package") {
    return false;
  }

  if (packageFileNames.has(basename)) {
    return true;
  }

  return /^(index|main|server|app)\.[cm]?[jt]sx?$/i.test(basename)
    || /^__init__\.py$/i.test(basename)
    || (parts[0] === "src" && parts[1] === "cli" && /^index\.[cm]?[jt]s$/i.test(basename));
}
