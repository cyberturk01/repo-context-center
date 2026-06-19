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

## Local RCC Development

- In this repo, use `node dist/cli/index.js <command>`; run `npm run build` first if source changed.
- Use `doctor` for local/global version doubts.
- Use `measure` for token-saving estimates.
- Use `npx repo-context-center@latest` only for published-package smoke tests.
- Use `npm run benchmark:routing` and `npm run benchmark:work-repeat` for routing/repeat checks.

- If RCC commands are unavailable, read `docs/ai-context/TASK_ROUTING.md` and `docs/ai-context/TOKEN_BUDGET.md`.

Keep changes focused. Run the smallest useful verification. Do not edit generated context files manually.
