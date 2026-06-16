# AGENTS.md

Read this file first.

<!-- repo-context-center:workflow:start -->
## RCC Workflow

Before coding:
- Run `rcc work "<task>"`.
- Read the focused context.
- Avoid broad repo scanning unless necessary.

After coding:
- Run relevant tests.
- Run `rcc done "<summary>" --files <files> --verify "<check>"`.
<!-- repo-context-center:workflow:end -->

- No shell: read `docs/ai-context/COMMUNICATION_MODE.md`, `docs/ai-context/TASK_ROUTING.md`, `docs/ai-context/TOKEN_BUDGET.md`, and `docs/ai-context/DO_NOT_READ.md`.
- Use `docs/ai-context/MODULE_INDEX.md` only when routing is missing or the task spans modules.
- Verify source; keep changes focused.
- Run smallest useful verification.
- Do not manually edit generated sections.
