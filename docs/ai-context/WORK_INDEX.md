# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Updated README with Repository Learning and learn command documentation
- Add learn command architecture guard tests
- Add explicit rcc learn command for on-demand repository learning output and writes
- Deduplicate handoff Work index memory against Last completed
- Compact handoff currentState and repositoryLearning output
- Polished handoff repository learning hint ordering
- Made handoff output include task-matched repository learning hints

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/commands/work.ts` | 13 touches; Made work command a thin wrapper by moving route helper exports and render facade calls into work modules. | 2026-06-19 |
| `src/cli/handoff/renderAgent.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderJson.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `tests/work.test.js` | 10 touches; Add learning-aware work hints to rcc work | 2026-06-20 |
| `tests/done.test.js` | 9 touches; Polished repository learning markdown output | 2026-06-20 |
| `src/cli/commands/done.ts` | 9 touches; Integrated repository learning updates into archive lifecycle | 2026-06-20 |
| `src/cli/handoff/handoffConstants.ts` | 8 touches; Compact handoff currentState and repositoryLearning output | 2026-06-20 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 23 | Deduplicate handoff Work index memory against Last completed |
| Work routing | 20 | Add learning-aware work hints to rcc work |
| Repository context | 6 | Updated README with Repository Learning and learn command documentation |
| Work memory | 3 | Integrated repository learning updates into archive lifecycle |
| Agent guidance | 3 | Updated README onboarding with latest-version commands, lifecycle guidance, manual-vs-automatic behavior, and cautious token-saving expectations. |
| General maintenance | 2 | Updated README SVG image URL to use the raw GitHub link for npm rendering. |
| CLI commands | 1 | Add learn command architecture guard tests |
| Measurement and benchmarks | 1 | Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries. |

## Verification Patterns

- `npm run build` (34)
- `npm test` (31)
- `node --test tests/handoff.test.js` (12)
- `node --test tests/work.test.js` (12)
- `node --test tests/cli.test.js` (9)
- `node --test tests/*.test.js` (7)
- `node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture"` (2)
- `node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture" --json` (2)

<!-- repo-context-center:work-index:end -->
