const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "dist", "cli", "index.js");

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8"
  });
}

async function withSymbolRepo(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "repo-context-center-symbols-"));

  try {
    await mkdir(path.join(tempDir, "src", "auth"), { recursive: true });
    await mkdir(path.join(tempDir, "tests", "auth"), { recursive: true });
    await writeFile(
      path.join(tempDir, "src", "auth", "authService.ts"),
      [
        "export interface LoginInput { email: string }",
        "export type LoginResult = { ok: boolean }",
        "export async function login(input: LoginInput): Promise<LoginResult> { return { ok: true }; }",
        "export function refreshToken(value: string): string { return value; }",
        "export class AuthService {}",
        "export const validateRefreshToken = (value: string) => Boolean(value);",
        "function privateHelper() {}"
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(tempDir, "tests", "auth", "authService.test.ts"),
      "import { login } from '../../src/auth/authService';\n",
      "utf8"
    );

    return await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("scan extracts exported JavaScript and TypeScript symbols", async () => {
  await withSymbolRepo(async (tempDir) => {
    const result = runCli(["scan", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);
    const authFile = report.detected.sourceFiles.find((file) => file.path === "src/auth/authService.ts");

    assert.equal(result.status, 0);
    assert.deepEqual(new Set(authFile.symbols.map((symbol) => symbol.name)), new Set([
      "AuthService",
      "LoginInput",
      "LoginResult",
      "login",
      "refreshToken",
      "validateRefreshToken"
    ]));
    assert.equal(authFile.symbols.find((symbol) => symbol.name === "AuthService").kind, "class");
    assert.equal(authFile.symbols.find((symbol) => symbol.name === "LoginInput").kind, "interface");
    assert.equal(authFile.symbols.find((symbol) => symbol.name === "LoginResult").kind, "type");
    assert.equal(authFile.symbols.find((symbol) => symbol.name === "login").kind, "function");
  });
});

test("scan maps source files to common tests in symbol map suggestions", async () => {
  await withSymbolRepo(async (tempDir) => {
    const result = runCli(["scan", "--json"], { cwd: tempDir });
    const report = JSON.parse(result.stdout);
    const symbolMap = report.suggestions["SYMBOL_MAP.md"].join("\n");

    assert.equal(result.status, 0);
    assert.match(symbolMap, /## src\/auth\/authService\.ts/);
    assert.match(symbolMap, /- refreshToken/);
    assert.match(symbolMap, /- tests\/auth\/authService\.test\.ts/);
  });
});
