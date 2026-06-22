import { access, mkdir, open, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, content, "utf8");
}

export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function readTextFileTail(filePath: string, limitBytes: number): Promise<string> {
  const handle = await open(filePath, "r");

  try {
    const stats = await handle.stat();
    const length = Math.min(Math.max(0, limitBytes), stats.size);
    const buffer = Buffer.alloc(length);

    await handle.read(buffer, 0, length, Math.max(0, stats.size - length));
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function listDirectoryNames(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

export async function listFilesRecursive(dirPath: string, rootPath = dirPath): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await listFilesRecursive(fullPath, rootPath));
      } else if (entry.isFile()) {
        files.push(path.relative(rootPath, fullPath).split(path.sep).join("/"));
      }
    }

    return files.sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}
