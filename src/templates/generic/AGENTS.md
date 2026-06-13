# AGENTS.md

Repository Context Center startup guide for AI coding agents.

Start here:
- Read `docs/ai-context/COMMUNICATION_MODE.md`.
- Read `docs/ai-context/TASK_ROUTING.md`.
- Read `docs/ai-context/TOKEN_BUDGET.md`.
- Read `docs/ai-context/DO_NOT_READ.md`.
- Use `TASK_ROUTING.md` before scanning the repo.

Context loading:
- Default to Compact Mode.
- Use Investigation Mode for security, auth, production, migration, release, or high-risk bug tasks.
- Use Detailed Mode only when explicitly requested.
- Load these only on demand: `MODULE_INDEX.md`, `PROJECT_MAP.md`, `DEPENDENCY_MAP.md`, `RISK_REGISTER.md`, `HOTSPOTS.md`, `SYMBOL_MAP.md`, `LESSONS_LEARNED.md`.

Do not read by default:
- `docs/ai-context/archive/*`.
- Generated folders listed in `docs/ai-context/DO_NOT_READ.md`.
- `.repo-context-center/config.json` unless debugging repo-context-center installation.

Work rules:
- Verify source code before changing behavior.
- Treat context files as guidance, not source of truth.
- Trust source code when context and code disagree.
- Keep changes focused.
- Run the smallest useful verification.
- Avoid unnecessary repository-wide scans.
- Update context files only when the task creates durable repo knowledge.
