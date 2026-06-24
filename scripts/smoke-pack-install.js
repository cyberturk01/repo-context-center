#!/usr/bin/env node

const { mkdirSync, mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env
  });

  if (result.status !== 0) {
    throw new Error([
      `${command} ${args.join(" ")} failed with status ${result.status}`,
      result.stderr.trim(),
      result.stdout.trim()
    ].filter(Boolean).join("\n"));
  }

  return result;
}

function parsePackOutput(stdout) {
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0].filename) {
    throw new Error("npm pack --json did not return a single package filename");
  }
  return parsed[0];
}

function validateInstalledWorkRoute(route) {
  if (!Array.isArray(route.primaryFiles) || typeof route.briefTokens !== "number") {
    throw new Error("installed CLI work --agent output did not match compact JSON shape");
  }
}

function main() {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "repo-context-center-pack-install-"));
  const cacheDir = path.join(tempRoot, "npm-cache");
  const installDir = path.join(tempRoot, "install");
  const env = {
    ...process.env,
    npm_config_cache: cacheDir
  };

  try {
    mkdirSync(installDir, { recursive: true });

    const packed = parsePackOutput(run(npmCommand(), ["pack", "--json", "--pack-destination", tempRoot], { env }).stdout);
    const tarballPath = path.join(tempRoot, packed.filename);

    run(npmCommand(), ["install", tarballPath, "--no-audit", "--no-fund", "--ignore-scripts"], {
      cwd: tempRoot,
      env
    });

    const cliPath = path.join(tempRoot, "node_modules", "repo-context-center", "dist", "cli", "index.js");
    const help = run(process.execPath, [cliPath, "--help"], { cwd: installDir, env });
    if (!/^repo-context-center/m.test(help.stdout)) {
      throw new Error("installed CLI help did not identify repo-context-center");
    }

    const version = run(process.execPath, [cliPath, "--version"], { cwd: installDir, env });
    if (version.stdout.trim() !== packed.version) {
      throw new Error(`installed CLI version ${version.stdout.trim()} did not match packed version ${packed.version}`);
    }

    const routeResult = run(process.execPath, [cliPath, "work", "fix typo in renderAgent output", "--agent"], {
      cwd: installDir,
      env
    });
    validateInstalledWorkRoute(JSON.parse(routeResult.stdout));

    console.log(`Pack install smoke passed for ${packed.name}@${packed.version}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parsePackOutput,
  validateInstalledWorkRoute
};
