# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Refactor work memory artifact refresh into shared helper
- Add command architecture boundary tests
- Avoid full WORK_LOG scans during rcc work memory lookup
- Updated README with Repository Learning and learn command documentation
- Add learn command architecture guard tests
- Add explicit rcc learn command for on-demand repository learning output and writes
- Deduplicate handoff Work index memory against Last completed

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/commands/work.ts` | 13 touches; Made work command a thin wrapper by moving route helper exports and render facade calls into work modules. | 2026-06-19 |
| `tests/work.test.js` | 11 touches; Avoid full WORK_LOG scans during rcc work memory lookup | 2026-06-20 |
| `src/cli/handoff/renderAgent.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderJson.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/commands/done.ts` | 10 touches; Refactor work memory artifact refresh into shared helper | 2026-06-20 |
| `tests/done.test.js` | 10 touches; Refactor work memory artifact refresh into shared helper | 2026-06-20 |
| `src/cli/handoff/handoffConstants.ts` | 8 touches; Compact handoff currentState and repositoryLearning output | 2026-06-20 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 23 | Deduplicate handoff Work index memory against Last completed |
| Work routing | 20 | Add learning-aware work hints to rcc work |
| Repository context | 6 | Updated README with Repository Learning and learn command documentation |
| Work memory | 5 | Refactor work memory artifact refresh into shared helper |
| Agent guidance | 3 | Updated README onboarding with latest-version commands, lifecycle guidance, manual-vs-automatic behavior, and cautious token-saving expectations. |
| CLI commands | 2 | Add command architecture boundary tests |
| General maintenance | 2 | Updated README SVG image URL to use the raw GitHub link for npm rendering. |
| Measurement and benchmarks | 1 | Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries. |

## Verification Patterns

- `npm run build` (37)
- `npm test` (31)
- `node --test tests/handoff.test.js` (12)
- `node --test tests/work.test.js` (12)
- `node --test tests/*.test.js` (10)
- `node --test tests/cli.test.js` (9)
- `node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture"` (2)
- `node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture" --json` (2)

<!-- repo-context-center:work-index:end -->
