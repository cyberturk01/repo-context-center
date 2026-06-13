import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  agentsFile,
  contextArchiveDir,
  contextSizeLimits,
  doNotReadFile,
  generatedFolderExclusions,
  requiredContextFiles,
  requiredTokenBudgetModes,
  tokenBudgetFile,
  type RequiredContextFile
} from "./contextFiles";
import { configDirName, configFileName, getConfigPath } from "./config";
import { pathExists } from "./fileSystem";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationReport {
  missing: ValidationIssue[];
  warnings: ValidationIssue[];
}

async function getFileSize(filePath: string): Promise<number | undefined> {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile() ? fileStat.size : undefined;
  } catch {
    return undefined;
  }
}

async function readOptionalContextFile(cwd: string, file: RequiredContextFile): Promise<string | undefined> {
  try {
    return await readFile(path.join(cwd, file), "utf8");
  } catch {
    return undefined;
  }
}

function includesPhrase(content: string, phrase: string): boolean {
  return content.toLowerCase().includes(phrase.toLowerCase());
}

function includesFolderExclusion(content: string, folder: string): boolean {
  const escapedFolder = folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w.-])${escapedFolder}/?([^\\w.-]|$)`, "i").test(content);
}

async function validateRequiredFile(cwd: string, file: RequiredContextFile): Promise<ValidationIssue | undefined> {
  const targetPath = path.join(cwd, file);
  const fileStat = await getFileSize(targetPath);

  if (fileStat === undefined) {
    return {
      path: file,
      message: "Required context file is missing"
    };
  }

  return undefined;
}

async function validateSize(cwd: string, file: RequiredContextFile, maxBytes: number): Promise<ValidationIssue | undefined> {
  const targetPath = path.join(cwd, file);
  const fileSize = await getFileSize(targetPath);

  if (fileSize !== undefined && fileSize > maxBytes) {
    return {
      path: file,
      message: `Context file is large (${fileSize} bytes, limit ${maxBytes} bytes)`
    };
  }

  return undefined;
}

async function validateTokenBudgetRules(cwd: string): Promise<ValidationIssue[]> {
  const content = await readOptionalContextFile(cwd, tokenBudgetFile);
  if (content === undefined) {
    return [];
  }

  return requiredTokenBudgetModes
    .filter((mode) => !includesPhrase(content, mode))
    .map((mode) => ({
      path: tokenBudgetFile,
      message: `${mode} is not defined`
    }));
}

async function validateDoNotReadRules(cwd: string): Promise<ValidationIssue[]> {
  const content = await readOptionalContextFile(cwd, doNotReadFile);
  if (content === undefined) {
    return [];
  }

  const missingFolders = generatedFolderExclusions.filter(
    (folder) => !includesFolderExclusion(content, folder)
  );

  if (missingFolders.length === 0) {
    return [];
  }

  return [{
    path: doNotReadFile,
    message: `Missing generated folder exclusions: ${missingFolders.join(", ")}`
  }];
}

async function validateAgentsReferences(cwd: string): Promise<ValidationIssue[]> {
  const content = await readOptionalContextFile(cwd, agentsFile);
  if (content === undefined || includesPhrase(content, doNotReadFile)) {
    return [];
  }

  return [{
    path: agentsFile,
    message: `Does not mention ${doNotReadFile}`
  }];
}

export async function validateContextSetup(cwd: string): Promise<ValidationReport> {
  const missing = (await Promise.all(
    requiredContextFiles.map((file) => validateRequiredFile(cwd, file))
  )).filter((issue): issue is ValidationIssue => issue !== undefined);

  const sizeWarnings = (await Promise.all(
    Object.entries(contextSizeLimits).map(([file, maxBytes]) =>
      validateSize(cwd, file as RequiredContextFile, maxBytes)
    )
  )).filter((issue): issue is ValidationIssue => issue !== undefined);

  const tokenBudgetWarnings = await validateTokenBudgetRules(cwd);
  const doNotReadWarnings = await validateDoNotReadRules(cwd);
  const agentsWarnings = await validateAgentsReferences(cwd);

  const warnings = [
    ...sizeWarnings,
    ...tokenBudgetWarnings,
    ...doNotReadWarnings,
    ...agentsWarnings
  ];
  if (!(await pathExists(getConfigPath(cwd)))) {
    warnings.push({
      path: `${configDirName}/${configFileName}`,
      message: "Config file is missing"
    });
  }

  if (!(await pathExists(path.join(cwd, contextArchiveDir)))) {
    warnings.push({
      path: contextArchiveDir,
      message: "Archive directory is missing"
    });
  }

  return { missing, warnings };
}
