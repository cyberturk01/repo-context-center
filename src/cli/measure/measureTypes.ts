export interface MeasureReport {
  schemaVersion: 1;
  command: "measure";
  task: string;
  naiveTokens: number;
  rccTokens: number;
  filesCounted: number;
  filesExcluded: number;
  excludedExamples: string[];
  ignoredFiles: number;
  ignoredExamples: string[];
  unsupportedFiles: number;
  unsupportedExamples: string[];
  skippedByScanCap: number;
  scanCapExamples: string[];
  primaryFiles: number;
  supportingFiles: number;
  tests: number;
  estimatedSavingTokens: number;
  estimatedSavingPercent: number;
  warnings: string[];
}
