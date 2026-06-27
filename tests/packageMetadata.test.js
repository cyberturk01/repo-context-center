const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm, stat } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const packageName = "repo-context-center";
const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const packageLockPath = path.join(repoRoot, "package-lock.json");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function withTempNpmCache(callback) {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-npm-cache-"));
  try {
    return await callback(cacheDir);
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
}

function assertNoSelfDependency(dependencies, label) {
  if (Array.isArray(dependencies)) {
    assert.equal(dependencies.includes(packageName), false, `${label} must not bundle ${packageName}`);
    return;
  }

  assert.equal(
    Object.prototype.hasOwnProperty.call(dependencies ?? {}, packageName),
    false,
    `${label} must not list ${packageName}`
  );
}

async function packDryRunJson() {
  return await withTempNpmCache(async (cacheDir) => {
    const result = spawnSync(npmCommand(), ["pack", "--dry-run", "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_cache: cacheDir
      }
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed), "npm pack --dry-run --json should return a package array");
    assert.equal(parsed.length, 1, "npm pack --dry-run should describe one package");

    return parsed[0];
  });
}

test("package metadata prevents self-dependency and keeps CLI bin valid", async () => {
  const packageJson = await readJson(packageJsonPath);

  assert.equal(packageJson.name, packageName);
  assert.match(packageJson.version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/, "package version must be valid semver-like text");

  for (const dependencyField of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
    "bundledDependencies",
    "bundleDependencies"
  ]) {
    assertNoSelfDependency(packageJson[dependencyField], dependencyField);
  }

  assert.equal(packageJson.bin?.rcc, "dist/cli/index.js");
  assert.equal(packageJson.bin?.[packageName], "dist/cli/index.js");
  assert.equal((await stat(path.join(repoRoot, packageJson.bin.rcc))).isFile(), true, "bin.rcc target must exist after build");

  assert.ok(Array.isArray(packageJson.files), "package files allowlist should be explicit");
  for (const requiredEntry of [
    "dist",
    "README.md",
    "LICENSE",
    "docs/assets/repo-context-center-diagram.svg"
  ]) {
    assert.ok(packageJson.files.includes(requiredEntry), `package files must include ${requiredEntry}`);
  }
});

test("package lock root metadata matches package.json without self-dependency", async () => {
  const packageJson = await readJson(packageJsonPath);
  const packageLock = await readJson(packageLockPath);
  const rootPackage = packageLock.packages?.[""];

  assert.equal(packageLock.name, packageJson.name);
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(rootPackage?.name, packageJson.name);
  assert.equal(rootPackage?.version, packageJson.version);

  for (const dependencyField of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
    "bundledDependencies",
    "bundleDependencies"
  ]) {
    assertNoSelfDependency(rootPackage?.[dependencyField], `package-lock root ${dependencyField}`);
  }

  assert.equal(
    Object.prototype.hasOwnProperty.call(packageLock.packages ?? {}, `node_modules/${packageName}`),
    false,
    "package-lock must not contain node_modules/repo-context-center"
  );
});

test("npm pack dry-run contains runtime files and excludes local development files", async () => {
  const packed = await packDryRunJson();
  const packedPaths = new Set(packed.files.map((file) => file.path));

  assert.equal(packed.name, packageName);
  assert.match(packed.version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);

  for (const requiredPath of [
    "package.json",
    "README.md",
    "LICENSE",
    "dist/cli/index.js",
    "dist/cli/work/renderAgent.js",
    "dist/cli/work/renderJson.js",
    "dist/cli/work/buildWorkBrief.js",
    "dist/core/repoMapper.js",
    "dist/core/suggester.js",
    "dist/templates/generic/index.js",
    "dist/templates/generic/AGENTS.md",
    "dist/templates/generic/docs/ai-context/RCC_WORKFLOW.md",
    "dist/templates/generic/docs/ai-context/TASK_ROUTING.md",
    "dist/templates/github/context-check.yml",
    "docs/assets/repo-context-center-diagram.svg"
  ]) {
    assert.ok(packedPaths.has(requiredPath), `packed package must include ${requiredPath}`);
  }

  for (const packedPath of packedPaths) {
    assert.equal(packedPath.startsWith(".git/"), false, `packed package must not include ${packedPath}`);
    assert.equal(packedPath.startsWith("tests/"), false, `packed package must not include ${packedPath}`);
    assert.equal(packedPath.startsWith("scripts/"), false, `packed package must not include ${packedPath}`);
    assert.equal(packedPath.startsWith("src/"), false, `packed package must not include ${packedPath}`);
    assert.equal(packedPath.startsWith("docs/ai-context/"), false, `packed package must not include ${packedPath}`);
    assert.doesNotMatch(packedPath, /(?:^|\/)(?:npm-debug|yarn-error|pnpm-debug)\.log$/);
    assert.doesNotMatch(packedPath, /(?:^|\/)(?:\.DS_Store|.*\.tmp|.*\.local)$/);
  }
});
