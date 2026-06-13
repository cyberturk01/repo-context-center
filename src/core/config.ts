import path from "node:path";
import { pathExists, readJsonFile, writeJsonFile } from "./fileSystem";

export interface RepoContextConfig {
  version: 1;
  createdBy: "repo-context-center";
}

export const configDirName = ".repo-context-center";
export const configFileName = "config.json";

export function getConfigPath(cwd: string): string {
  return path.join(cwd, configDirName, configFileName);
}

export function createDefaultConfig(): RepoContextConfig {
  return {
    version: 1,
    createdBy: "repo-context-center"
  };
}

export async function hasConfig(cwd: string): Promise<boolean> {
  return pathExists(getConfigPath(cwd));
}

export async function writeDefaultConfig(cwd: string): Promise<string> {
  const configPath = getConfigPath(cwd);
  await writeJsonFile(configPath, createDefaultConfig());
  return configPath;
}

export async function readConfig(cwd: string): Promise<RepoContextConfig> {
  return readJsonFile<RepoContextConfig>(getConfigPath(cwd));
}
