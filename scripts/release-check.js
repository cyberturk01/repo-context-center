#!/usr/bin/env node

const { mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function run(label, command, args, options = {}) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
    env: options.env ?? process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const cacheDir = mkdtempSync(path.join(os.tmpdir(), "repo-context-center-release-npm-cache-"));
const env = {
  ...process.env,
  npm_config_cache: cacheDir
};

try {
  run("npm run build", npmCommand(), ["run", "build"], { env });
  run("npm test", npmCommand(), ["test"], { env });
  run("npm run benchmark:routing", npmCommand(), ["run", "benchmark:routing"], { env });
  run("npm pack --dry-run", npmCommand(), ["pack", "--dry-run"], { env });
  run("npm run smoke:pack-install", npmCommand(), ["run", "smoke:pack-install"], { env });
} finally {
  rmSync(cacheDir, { recursive: true, force: true });
}
