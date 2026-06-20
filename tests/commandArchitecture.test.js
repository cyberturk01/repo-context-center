const assert = require("node:assert/strict");
const { readdir, readFile } = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const commandsDir = path.join(repoRoot, "src", "cli", "commands");

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

async function commandFiles() {
  const entries = await readdir(commandsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(commandsDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function commandNameForFile(filePath) {
  return `${path.basename(filePath, ".ts")}Command`;
}

function importSpecifiers(source) {
  const specs = [];
  const importPattern = /\bimport\b(?:[\s\S]*?\bfrom\s*)?["']([^"']+)["']/g;

  for (const match of source.matchAll(importPattern)) {
    specs.push(match[1]);
  }

  return specs;
}

function withoutImportDeclarations(source) {
  return source.replace(/\bimport\b[\s\S]*?(?:;\s*|\n)/g, "");
}

function normalizeImportPath(fromFile, specifier) {
  const withoutExtension = specifier.replace(/\.(ts|js)$/u, "");
  if (withoutExtension.startsWith(".")) {
    return toRepoPath(path.resolve(path.dirname(fromFile), withoutExtension));
  }

  return withoutExtension.replace(/\\/g, "/").replace(/^\.\//, "");
}

test("command handlers do not import or reference other command handlers", async () => {
  const files = await commandFiles();
  const commandNames = files.map(commandNameForFile);
  const failures = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const ownCommandName = commandNameForFile(file);
    const repoPath = toRepoPath(file);

    for (const specifier of importSpecifiers(source)) {
      const normalized = normalizeImportPath(file, specifier);
      if (normalized.startsWith("src/cli/commands/") && normalized !== repoPath.replace(/\.ts$/u, "")) {
        failures.push(`${repoPath} imports command module ${specifier}`);
      }
    }

    const body = withoutImportDeclarations(source);
    for (const commandName of commandNames) {
      if (commandName === ownCommandName) {
        continue;
      }

      if (new RegExp(`\\b${commandName}\\b`).test(body)) {
        failures.push(`${repoPath} references ${commandName}`);
      }
    }
  }

  assert.deepEqual(failures, []);
});

test("CLI index is allowed to import command handlers", async () => {
  const source = await readFile(path.join(repoRoot, "src", "cli", "index.ts"), "utf8");

  for (const file of await commandFiles()) {
    const commandName = commandNameForFile(file);
    const commandModule = `./commands/${path.basename(file, ".ts")}`;

    assert.match(source, new RegExp(`import \\{ ${commandName} \\} from "${commandModule}"`));
  }
});

test("measure uses work route helpers without importing workCommand", async () => {
  const source = await readFile(path.join(commandsDir, "measure.ts"), "utf8");

  assert.match(source, /from "\.\.\/work\/buildWorkBrief"/);
  assert.doesNotMatch(source, /\bworkCommand\b/);
});

test("handoff uses work brief helpers through handoff builders without importing workCommand", async () => {
  const commandSource = await readFile(path.join(commandsDir, "handoff.ts"), "utf8");
  const builderSource = await readFile(path.join(repoRoot, "src", "cli", "handoff", "buildHandoffBrief.ts"), "utf8");

  assert.match(commandSource, /from "\.\.\/handoff\/buildHandoffBrief"/);
  assert.match(builderSource, /from "\.\.\/work\/buildWorkBrief"/);
  assert.doesNotMatch(commandSource, /\bworkCommand\b/);
  assert.doesNotMatch(builderSource, /\bworkCommand\b/);
});

test("done and archive may use learning helpers without importing learnCommand", async () => {
  const doneSource = await readFile(path.join(commandsDir, "done.ts"), "utf8");
  const archiveSource = await readFile(path.join(commandsDir, "archive.ts"), "utf8");
  const archiverSource = await readFile(path.join(repoRoot, "src", "core", "archiver.ts"), "utf8");

  assert.match(doneSource, /workMemoryRefresh/);
  assert.match(archiveSource, /archiveContextFiles/);
  assert.match(archiverSource, /workMemoryRefresh/);
  assert.doesNotMatch(doneSource, /renderRepositoryLearning|buildRepositoryLearningModel/);
  assert.doesNotMatch(archiverSource, /renderRepositoryLearning|buildRepositoryLearningModel/);
  assert.doesNotMatch(doneSource, /\blearnCommand\b/);
  assert.doesNotMatch(archiveSource, /\blearnCommand\b/);
});
