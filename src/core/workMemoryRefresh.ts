import path from "node:path";
import { pathExists, readTextFile, writeTextFile } from "./fileSystem";
import { upsertRepositoryLearning } from "./renderRepositoryLearning";
import { buildRepositoryLearningModel } from "./repositoryLearning";
import {
  parseWorkEventEntries,
  parseWorkMemoryEntries,
  repositoryLearningPath,
  renderWorkIndex,
  workEventsPath,
  workIndexPath
} from "./workMemory";

export interface RefreshWorkMemoryArtifactsOptions {
  dryRun?: boolean;
  archivedWorkLogContent?: string;
  includeLowSignalLearning?: boolean;
  updateRepositoryLearning?: boolean;
  workEventsContent?: string;
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

  const workEventsContent = options.workEventsContent ?? await readIfPresent(path.join(cwd, workEventsPath));
  const workLogContent = options.workLogContent ?? "";
  const archivedWorkLogContent = options.archivedWorkLogContent;
  const contents = [workLogContent, archivedWorkLogContent].filter((content): content is string => Boolean(content));
  const eventEntries = workEventsContent ? parseWorkEventEntries(workEventsContent) : [];
  const entries = eventEntries.length > 0 ? eventEntries : contents.flatMap(parseWorkMemoryEntries);

  await writeTextFile(path.join(cwd, workIndexPath), renderWorkIndex(entries));

  if (options.updateRepositoryLearning === false) {
    return [workIndexPath];
  }

  const learningTargetPath = path.join(cwd, repositoryLearningPath);
  const existingLearning = await readIfPresent(learningTargetPath);
  await writeTextFile(learningTargetPath, upsertRepositoryLearning(
    existingLearning,
    buildRepositoryLearningModel({
      workLog: eventEntries.length > 0 ? workEventsContent : contents.join("\n\n")
    }, {
      includeLowSignal: options.includeLowSignalLearning
    })
  ));

  return [workIndexPath, repositoryLearningPath];
}
