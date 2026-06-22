import path from "node:path";
import { pathExists, readTextFile, writeTextFile } from "../../core/fileSystem";
import { upsertRepositoryLearning } from "../../core/renderRepositoryLearning";
import type { RepositoryLearningModel } from "../../core/repositoryLearning";
import { repositoryLearningPath } from "../../core/workMemory";

export async function writeRepositoryLearning(cwd: string, model: RepositoryLearningModel): Promise<string> {
  const fullPath = path.join(cwd, repositoryLearningPath);
  const existing = await pathExists(fullPath) ? await readTextFile(fullPath) : undefined;

  await writeTextFile(fullPath, upsertRepositoryLearning(existing, model));
  return repositoryLearningPath;
}
