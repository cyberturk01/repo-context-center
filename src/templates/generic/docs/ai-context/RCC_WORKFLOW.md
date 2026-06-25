# RCC Workflow

For coding tasks, try RCC in this order:

1. `rcc work "<task>" --agent`
2. `repo-context-center work "<task>" --agent`
3. `npx repo-context-center@latest work "<task>" --agent`

Do not enter fallback mode after only one failed command.

Then:
- Inspect the returned primaryFiles, tests, and supportingFiles before reading or searching broadly.
- Do not repeatedly run `rcc work` for the same task.
- Use `rcc find "<keyword>"` only if the route is insufficient.
- Do not ask the human to run RCC commands.
- After meaningful changes, run tests and record:
  `rcc done --summary "<summary>" --files auto --verify "<checks>"`

Read `docs/ai-context/HANDOFF.md` if present.

Read `docs/ai-context/WORK_INDEX.md` if task/history context is unclear; do not read full `WORK_LOG.md` by default.

Use `rcc doctor` for local/global RCC confusion.

For task-first route savings, use `rcc measure "<task>"`.

For broader context-cost estimates, use `rcc estimate --compare-naive`, `rcc estimate --task "<task>"`, or `rcc estimate --json`.

## If RCC commands are unavailable

- Do not ask the human to run RCC commands.
- Read only:
  - `docs/ai-context/TASK_ROUTING.md`
  - `docs/ai-context/DO_NOT_READ.md`
- Use `docs/ai-context/TOKEN_BUDGET.md` only if budget guidance is needed.
- Do not read all context files.
- Do not read these by default:
  - `PROJECT_MAP.md`
  - `MODULE_INDEX.md`
  - `HOTSPOTS.md`
  - `RISK_REGISTER.md`
  - `DEPENDENCY_MAP.md`
  - `SYMBOL_MAP.md`
- If the route is still unclear, read at most one additional context file.
- Then inspect only:
  - 1-3 likely implementation files
  - 1-2 likely test files
- Do not perform broad repository scans.
- Prefer targeted file/path searches over broad scans.

Keep changes focused. Avoid unnecessary repository scanning.
