import { requiredContextFiles } from "../../core/contextFiles";
import type { RepoFileRole } from "../../core/repoFileClassifier";

export const decisionsPath = "docs/ai-context/DECISIONS.md";
export const workLogPath = "docs/ai-context/WORK_LOG.md";
export const workIndexPath = "docs/ai-context/WORK_INDEX.md";
export const repositoryLearningPath = "docs/ai-context/REPOSITORY_LEARNING.md";
export const lessonsPath = "docs/ai-context/LESSONS_LEARNED.md";
export const changeLogPath = "docs/ai-context/CHANGE_LOG.md";
export const compactMemoryFiles = [
  workIndexPath,
  repositoryLearningPath,
  decisionsPath,
  changeLogPath,
  lessonsPath
] as const;
export const logLimit = 3;
export const workLogTailReadLimitBytes = 64 * 1024;
export const workLogTailLineLimit = 240;
export const decisionLimit = 3;
export const targetedLookupLimit = 5;
export const targetedContentReadLimit = 64 * 1024;
export const strongLookupScoreThreshold = 70;
export const usage = 'Usage: rcc work "<task>" [--json|--agent] [--verbose] [--debug] [--context-budget minimal|balanced|deep] [--max-files <number>]';
export const nextCommand = 'rcc done --summary "<summary>" --files auto --verify "<check>"';
export const freshnessAffectedFileLimit = 5;
export const freshnessImportantRoles = new Set(["source", "test", "workflow", "config", "package"]);
export const defaultLookupRoleOrder: RepoFileRole[] = [
  "source",
  "test",
  "workflow",
  "config",
  "package",
  "docs",
  "fixture",
  "snapshot",
  "asset",
  "generated",
  "unknown"
];
export const packageTaskLookupRoleOrder: RepoFileRole[] = [
  "source",
  "test",
  "package",
  "workflow",
  "config",
  "docs",
  "fixture",
  "snapshot",
  "asset",
  "generated",
  "unknown"
];
export const workflowTaskLookupRoleOrder: RepoFileRole[] = [
  "workflow",
  "config",
  "package",
  "source",
  "test",
  "docs",
  "fixture",
  "snapshot",
  "asset",
  "generated",
  "unknown"
];
export const documentationTaskLookupRoleOrder: RepoFileRole[] = [
  "docs",
  "source",
  "test",
  "workflow",
  "config",
  "package",
  "fixture",
  "snapshot",
  "asset",
  "generated",
  "unknown"
];
export const contextFiles = requiredContextFiles;
export const workOutputAssemblyPatterns = [
  /\btask\s+files?\b/i,
  /\brecommended\s+files?\b/i,
  /\blookup\s+hints?\b/i,
  /\btargeted\s+lookup(?:\s+hints?)?\b/i,
  /\bpromoted\s+lookup\b/i,
  /\bweak\s+semantic\s+match(?:es)?\b/i,
  /\bsemantic\s+source\s+match(?:es)?\b/i,
  /\bwork\s+brief\b/i,
  /\bhuman\s+output\b/i,
  /\boutput\s+categorization\b/i,
  /\bagent\s+rules?\b/i,
  /\bcontext\s+docs?\b/i,
  /\bcheapest\s+path\b/i
];
export const workOutputAssemblyRoutes = [
  "src/cli/commands/work.ts",
  "tests/work.test.js"
];
export const routingImplementationRoutes = [
  "src/cli/work/taskFileRecommendations.ts",
  "src/core/taskIntent.ts",
  "src/cli/work/taskSize.ts",
  "tests/taskIntent.test.js",
  "tests/work.test.js"
];
export const tokenMeasurementRoutes = [
  "src/cli/commands/measure.ts",
  "src/core/tokenEstimator.ts",
  "tests/estimate.test.js"
];
export const releaseTaskRoutes = [
  "package.json",
  "CHANGELOG.md"
];
export const localGlobalDoctorRoutes = [
  "src/cli/commands/doctor.ts",
  "src/cli/index.ts",
  "tests/cli.test.js"
];
