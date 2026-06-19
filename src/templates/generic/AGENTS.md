# AGENTS.md

Read this first.

<!-- repo-context-center:workflow:start -->
## RCC Workflow

For coding tasks, first run once:

`rcc work "<task>"`

Then:
- Follow the brief before reading files or searching broadly.
- Use `rcc find "<keyword>"` for follow-up lookup.
- Do not rerun `rcc work` unless the task/context changes or the brief is insufficient.
- Do not ask the human to run RCC commands.
- After meaningful changes, run tests and record:
  `rcc done --summary "<summary>" --files auto --verify "<checks>"`
<!-- repo-context-center:workflow:end -->

- If shell commands are unavailable, fallback to reading `docs/ai-context/COMMUNICATION_MODE.md`, `docs/ai-context/TASK_ROUTING.md`, `docs/ai-context/TOKEN_BUDGET.md`, and `docs/ai-context/DO_NOT_READ.md`.
- Use `docs/ai-context/MODULE_INDEX.md` only when routing is missing or the task spans modules.
- Verify source; keep changes focused.
- Run smallest useful verification.
- Do not edit generated context files manually.
