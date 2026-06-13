import { stat } from "node:fs/promises";
import path from "node:path";
import {
  contextArchiveDir,
  contextSizeLimits,
  requiredContextFiles,
  type RequiredContextFile
} from "./contextFiles";
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

export async function validateContextSetup(cwd: string): Promise<ValidationReport> {
  const missing = (await Promise.all(
    requiredContextFiles.map((file) => validateRequiredFile(cwd, file))
  )).filter((issue): issue is ValidationIssue => issue !== undefined);

  const sizeWarnings = (await Promise.all(
    Object.entries(contextSizeLimits).map(([file, maxBytes]) =>
      validateSize(cwd, file as RequiredContextFile, maxBytes)
    )
  )).filter((issue): issue is ValidationIssue => issue !== undefined);

  const warnings = [...sizeWarnings];
  if (!(await pathExists(path.join(cwd, contextArchiveDir)))) {
    warnings.push({
      path: contextArchiveDir,
      message: "Archive directory is missing"
    });
  }

  return { missing, warnings };
}
