# RCC Workflow

## Task Routing

Try once, in order:

1. `rcc work "<task>" --agent`
2. `repo-context-center work "<task>" --agent`
3. `npx repo-context-center@latest work "<task>" --agent`

Do not enter fallback mode after only one failed command.

Use the returned:
- primaryFiles
- supportingFiles
- tests

Do not rerun `rcc work` for the same task.

## During Implementation

- Use `rcc find "<keyword>"` only if the route is insufficient.
- After meaningful changes: `rcc done --summary "<summary>" --files auto --verify "<checks>"`

Optional utilities:

- `rcc doctor`
- `rcc measure "<task>"`
- `rcc estimate --compare-naive`

## If RCC Is Unavailable

- Read:
  - `docs/ai-context/TASK_ROUTING.md`
  - `docs/ai-context/DO_NOT_READ.md`
- Read `docs/ai-context/TOKEN_BUDGET.md` only if needed.
- Read at most one additional context file.
- Inspect only:
  - 1-3 implementation files
  - 1-2 tests
- Do not perform broad repository scans.
