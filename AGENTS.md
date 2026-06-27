# AGENTS.md

Read this first.

  `rcc done --summary "<summary>" --files auto --verify "<checks>"`

## Local RCC Development

- Use `node dist/cli/index.js <command>` in this repo; run `npm run build` first after source changes.
- For this repo, prefer `node dist/cli/index.js work "<task>" --agent` over global `rcc` while developing RCC itself.
- Use `node dist/cli/index.js doctor` for local/global RCC confusion. If global `rcc doctor` is unknown, the global install is older than the current agent workflow.
- Use `measure "<task>"` for task-first route savings; use `estimate --compare-naive` for broader context-cost comparisons.
- Use `npm run benchmark:routing` and `npm run benchmark:work-repeat` to validate RCC behavior.

<!-- repo-context-center:workflow:start -->
For the RCC repository workflow, read:

`docs/ai-context/RCC_WORKFLOW.md`
<!-- repo-context-center:workflow:end -->

- Read `docs/ai-context/HANDOFF.md` if present.
- Read `docs/ai-context/WORK_INDEX.md` if task/history context is unclear; do not read full `WORK_LOG.md` by default.
- Use `rcc doctor` for local/global RCC confusion.
- For task-first route savings, use `rcc measure "<task>"`.
- For broader context-cost estimates, use `rcc estimate --compare-naive`, `rcc estimate --task "<task>"`, or `rcc estimate --json`.
- If RCC commands are unavailable, read only `docs/ai-context/TASK_ROUTING.md` and `docs/ai-context/TOKEN_BUDGET.md`; check `docs/ai-context/DO_NOT_READ.md` before manual broad scans.

Keep changes focused. Avoid unnecessary repository scanning.
