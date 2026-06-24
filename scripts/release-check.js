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

function releaseSteps(npmExecutable = npmCommand()) {
  return [
    ["npm run build", npmExecutable, ["run", "build"]],
    ["npm test", npmExecutable, ["test"]],
    ["npm run benchmark:routing", npmExecutable, ["run", "benchmark:routing"]],
    ["npm pack --dry-run", npmExecutable, ["pack", "--dry-run"]],
    ["npm run smoke:pack-install", npmExecutable, ["run", "smoke:pack-install"]]
  ];
}

function main() {
  const cacheDir = mkdtempSync(path.join(os.tmpdir(), "repo-context-center-release-npm-cache-"));
  const env = {
    ...process.env,
    npm_config_cache: cacheDir
  };

  try {
    for (const [label, command, args] of releaseSteps()) {
      run(label, command, args, { env });
    }
  } finally {
    rmSync(cacheDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  npmCommand,
  releaseSteps
};
