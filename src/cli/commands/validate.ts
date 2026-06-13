import { hasConfig, readConfig } from "../../core/config";
import type { CliIO } from "../index";

export async function validateCommand(io: CliIO): Promise<number> {
  if (!(await hasConfig(io.cwd))) {
    io.stderr("Missing repo-context-center config. Run `repo-context-center init` first.\n");
    return 1;
  }

  const config = await readConfig(io.cwd);
  if (config.version !== 1 || config.createdBy !== "repo-context-center") {
    io.stderr("Invalid repo-context-center config.\n");
    return 1;
  }

  io.stdout("repo-context-center config is valid.\n");
  return 0;
}
