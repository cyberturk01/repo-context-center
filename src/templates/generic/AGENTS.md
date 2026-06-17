# AGENTS.md

Read this file first.

<!-- repo-context-center:workflow:start -->
## RCC Workflow

For any coding task, the first shell command must be:

`rcc work "<task>"`

- Do not begin repository exploration, manual file reading, or broad searching before running `rcc work`.
- Follow the read-first files from the work brief.
- For targeted lookup, prefer `rcc find "<keyword>"` before broad grep/search.
- Do not ask the human to run RCC commands.

After meaningful changes:
1. Run relevant tests.
2. Run `rcc done --summary "<summary>" --files auto --verify "<checks>"`.
<!-- repo-context-center:workflow:end -->

- If shell commands are unavailable, fallback to reading `docs/ai-context/COMMUNICATION_MODE.md`, `docs/ai-context/TASK_ROUTING.md`, `docs/ai-context/TOKEN_BUDGET.md`, and `docs/ai-context/DO_NOT_READ.md`.
- Use `docs/ai-context/MODULE_INDEX.md` only when routing is missing or the task spans modules.
- Verify source; keep changes focused.
- Run smallest useful verification.
- Do not manually edit generated sections.
