import path from "node:path";
import { pathExists, readTextFile, writeTextFile } from "./fileSystem";
import { upsertRepositoryLearning } from "./renderRepositoryLearning";
import { buildRepositoryLearningModel } from "./repositoryLearning";
import {
  parseWorkMemoryEntries,
  repositoryLearningPath,
  renderWorkIndex,
  workIndexPath
} from "./workMemory";

export interface RefreshWorkMemoryArtifactsOptions {
  dryRun?: boolean;
  archivedWorkLogContent?: string;
  updateRepositoryLearning?: boolean;
  workLogContent?: string;
}

async function readIfPresent(filePath: string): Promise<string | undefined> {
  return (await pathExists(filePath)) ? readTextFile(filePath) : undefined;
}

export async function refreshWorkMemoryArtifacts(
  cwd: string,
  options: RefreshWorkMemoryArtifactsOptions
): Promise<string[]> {
  if (options.dryRun) {
    return [];
  }

  const workLogContent = options.workLogContent ?? "";
  const archivedWorkLogContent = options.archivedWorkLogContent;
  const contents = [workLogContent, archivedWorkLogContent].filter((content): content is string => Boolean(content));
  const entries = contents.flatMap(parseWorkMemoryEntries);

  await writeTextFile(path.join(cwd, workIndexPath), renderWorkIndex(entries));

  if (options.updateRepositoryLearning === false) {
    return [workIndexPath];
  }

  const learningTargetPath = path.join(cwd, repositoryLearningPath);
  const existingLearning = await readIfPresent(learningTargetPath);
  await writeTextFile(learningTargetPath, upsertRepositoryLearning(
    existingLearning,
    buildRepositoryLearningModel({
      workLog: contents.join("\n\n")
    })
  ));

  return [workIndexPath, repositoryLearningPath];
}
