import {
  buildRepositoryLearningModel,
  readRepositoryLearningSources,
  type RepositoryLearningModel,
  type RepositoryLearningSources
} from "../../core/repositoryLearning";
import { parseWorkMemoryEntries } from "../../core/workMemory";

export interface LearnDebugInfo {
  sourceCounts: {
    decisions: number;
    workIndexLines: number;
    workLogEntries: number;
  };
  ignoredEntries: string[];
}

export interface LearnResult {
  debug: LearnDebugInfo;
  model: RepositoryLearningModel;
  sources: RepositoryLearningSources;
}

function sourceLineCount(content: string | undefined): number {
  return content ? content.split(/\r?\n/).filter((line) => line.trim()).length : 0;
}

function ignoredSources(sources: RepositoryLearningSources): string[] {
  const ignored: string[] = [];

  if (!sources.workLog) {
    ignored.push("docs/ai-context/WORK_LOG.md missing");
  }
  if (!sources.workIndex) {
    ignored.push("docs/ai-context/WORK_INDEX.md missing");
  }
  if (!sources.decisions) {
    ignored.push("docs/ai-context/DECISIONS.md missing");
  }

  return ignored;
}

export async function buildLearnResult(cwd: string): Promise<LearnResult> {
  const sources = await readRepositoryLearningSources(cwd);
  const model = buildRepositoryLearningModel(sources);

  return {
    debug: {
      sourceCounts: {
        decisions: sourceLineCount(sources.decisions),
        workIndexLines: sourceLineCount(sources.workIndex),
        workLogEntries: sources.workLog ? parseWorkMemoryEntries(sources.workLog).length : 0
      },
      ignoredEntries: ignoredSources(sources)
    },
    model,
    sources
  };
}
