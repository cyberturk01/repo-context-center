const { mkdir, readdir, rm, copyFile } = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src", "templates", "generic");
const targetRoot = path.join(root, "dist", "templates", "generic");

async function copyMarkdownFiles(sourceDir, targetDir) {
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyMarkdownFiles(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function main() {
  await rm(path.join(targetRoot, "index.ts"), { force: true });
  await copyMarkdownFiles(sourceRoot, targetRoot);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
