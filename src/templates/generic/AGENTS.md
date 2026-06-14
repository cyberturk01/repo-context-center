# AGENTS.md

Repo Context Center startup.

## Startup

Read:
1. `docs/ai-context/COMMUNICATION_MODE.md`
2. `docs/ai-context/TASK_ROUTING.md`
3. `docs/ai-context/TOKEN_BUDGET.md`
4. `docs/ai-context/DO_NOT_READ.md`

Use `TASK_ROUTING.md` before opening repo files.

## Modes

Default: Compact

Investigation:
- security/auth
- production/release
- migrations
- high-risk bugs

Detailed: explicit request only.

On demand:
- `MODULE_INDEX.md`
- `PROJECT_MAP.md`
- `DEPENDENCY_MAP.md`
- `RISK_REGISTER.md`
- `HOTSPOTS.md`
- `SYMBOL_MAP.md`
- `LESSONS_LEARNED.md`

## Skip

- `docs/ai-context/archive/*`
- paths in `DO_NOT_READ.md`
- `.repo-context-center/config.json` unless debugging install

## Rules

- Code is source of truth.
- Context guides navigation.
- Verify before behavior changes.
- Keep changes small.
- Run smallest useful check.
- Update context only for durable repo knowledge.
