# AGENTS.md

Read this first.

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

## Local RCC Development

- Use `node dist/cli/index.js <command>` in this repo; run `npm run build` first after source changes.
- Use `doctor` for local/global RCC confusion.
- Use `measure` for token-saving estimates.
- Use `npm run benchmark:routing` and `npm run benchmark:work-repeat` to validate RCC behavior.
- If RCC commands are unavailable, read only `docs/ai-context/TASK_ROUTING.md` and `docs/ai-context/TOKEN_BUDGET.md`; check `docs/ai-context/DO_NOT_READ.md` before manual broad scans.

Keep changes focused. Avoid unnecessary repository scanning.
