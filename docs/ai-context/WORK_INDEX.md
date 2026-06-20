# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Added task-size route pruning for rcc work so tiny and small briefs cap route files while preserving medium and large behavior.
- Integrated task size classification into rcc work briefs and text, JSON, and agent renderers with lightweight guidance for tiny and small t...
- Added deterministic task size classification helper for RCC work briefs with tiny/small/medium/large modes and focused unit tests.
- Add regression for work agent next spacing
- Refactor work memory artifact refresh into shared helper
- Add command architecture boundary tests
- Avoid full WORK_LOG scans during rcc work memory lookup

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `tests/work.test.js` | 11 touches; Added task-size route pruning for rcc work so tiny and small briefs cap route files while preserving medium and large behavior. | 2026-06-20 |
| `src/cli/handoff/renderAgent.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderJson.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/commands/done.ts` | 10 touches; Refactor work memory artifact refresh into shared helper | 2026-06-20 |
| `tests/done.test.js` | 10 touches; Refactor work memory artifact refresh into shared helper | 2026-06-20 |
| `src/cli/handoff/handoffConstants.ts` | 8 touches; Compact handoff currentState and repositoryLearning output | 2026-06-20 |
| `src/cli/commands/work.ts` | 8 touches; Made work command a thin wrapper by moving route helper exports and render facade calls into work modules. | 2026-06-19 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 23 | Deduplicate handoff Work index memory against Last completed |
| Work routing | 13 | Added task-size route pruning for rcc work so tiny and small briefs cap route files while preserving medium and large behavior. |
| Repository context | 6 | Updated README with Repository Learning and learn command documentation |
| Work memory | 5 | Refactor work memory artifact refresh into shared helper |
| CLI commands | 2 | Add command architecture boundary tests |
| General maintenance | 2 | Updated README SVG image URL to use the raw GitHub link for npm rendering. |
| Agent guidance | 1 | Updated README onboarding with latest-version commands, lifecycle guidance, manual-vs-automatic behavior, and cautious token-saving expectations. |
| Measurement and benchmarks | 1 | Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries. |

## Verification Patterns

- `npm run build` (30)
- `npm test` (22)
- `node --test tests/*.test.js` (12)
- `node --test tests/handoff.test.js` (12)
- `node --test tests/cli.test.js` (9)
- `node --test tests/work.test.js` (6)
- `git diff --check` (1)
- `git diff --check README.md` (1)

<!-- repo-context-center:work-index:end -->
