# AGENTS.md

Repo Context Center startup.

Before a task:
- Shell: `npx repo-context-center start "<task>"`.
- Use output for docs, files, tests, risk, instructions.
- No shell: read `docs/ai-context/TASK_ROUTING.md`, `docs/ai-context/MODULE_INDEX.md`, `docs/ai-context/TOKEN_BUDGET.md`, `docs/ai-context/DO_NOT_READ.md`.
- Verify source before editing.
- After meaningful changes: `npx repo-context-center log "<summary>" --files <paths>`.

Read:
1. `docs/ai-context/COMMUNICATION_MODE.md`
2. `docs/ai-context/TASK_ROUTING.md`
3. `docs/ai-context/TOKEN_BUDGET.md`
4. `docs/ai-context/DO_NOT_READ.md`

Use `TASK_ROUTING.md` before opening repo files.

Modes:
- Compact (default)
- Investigation (security/auth, release, migrations, high-risk bugs)
- Detailed (explicit request only)

On demand:
- `MODULE_INDEX.md`
- `PROJECT_MAP.md`
- `DEPENDENCY_MAP.md`
- `RISK_REGISTER.md`
- `HOTSPOTS.md`
- `SYMBOL_MAP.md`
- `LESSONS_LEARNED.md`

Skip:
- `docs/ai-context/archive/*`
- paths in `DO_NOT_READ.md`
- `.repo-context-center/config.json` unless debugging install

Code is source of truth.
