import type { ApplicationSurface } from "../../core/taskIntent";
import { surfaceForPath } from "./taskFileRecommendations";
import type { WorkBrief, WorkRecommendation } from "./workTypes";

export interface MissingSurfaceWarning {
  surface: ApplicationSurface;
  label: string;
  message: string;
  command: string;
}

const surfaceLabels: Record<ApplicationSurface, string> = {
  "api-client": "API client",
  "backend-api": "backend API",
  "dashboard-ui": "dashboard UI",
  database: "database",
  "public-api": "public API",
  tests: "tests"
};

const lookupPrefixes: Record<ApplicationSurface, string> = {
  "api-client": "client",
  "backend-api": "backend",
  "dashboard-ui": "dashboard",
  database: "database",
  "public-api": "public",
  tests: "test"
};

function pathsFor(items: WorkRecommendation[]): string[] {
  return items.map((item) => item.path);
}

function lookupKeyword(brief: WorkBrief, surface: ApplicationSurface): string {
  const prefix = lookupPrefixes[surface];
  const nextKeyword = brief.nextCheapestCommand.match(/rcc find "([^"]+)"/)?.[1];
  if (!nextKeyword || nextKeyword === "<keyword>" || nextKeyword === prefix) {
    return prefix;
  }

  return `${prefix} ${nextKeyword}`;
}

function routeCoversSurface(surface: ApplicationSurface, routePaths: string[], testPaths: string[]): boolean {
  if (surface === "tests") {
    return testPaths.length > 0;
  }

  return routePaths.some((filePath) => surfaceForPath(filePath) === surface);
}

export function missingSurfaceWarnings(brief: WorkBrief): MissingSurfaceWarning[] {
  const routePaths = [
    ...pathsFor(brief.primaryFiles),
    ...pathsFor(brief.supportingFiles)
  ];
  const testPaths = pathsFor(brief.tests);

  return brief.detectedSurfaces
    .filter((surface) => !routeCoversSurface(surface, routePaths, testPaths))
    .map((surface) => {
      const label = surfaceLabels[surface];
      const keyword = lookupKeyword(brief, surface);
      const command = `rcc find "${keyword}"`;

      return {
        surface,
        label,
        message: `Possibly missing surface: ${label}. Try: ${command}`,
        command
      };
    });
}
