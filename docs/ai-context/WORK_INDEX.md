# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory.
- Updated README onboarding with latest-version commands, lifecycle guidance, manual-vs-automatic behavior, and cautious token-saving expecta...
- Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries.
- Updated README SVG image URL to use the raw GitHub link for npm rendering.
- Updated README.md for RCC v0.9.3 Agent Handover capabilities and refreshed the workflow diagram.
- Updated CHANGELOG.md for the upcoming RCC v0.9.3 release with v0.9.x handoff and routing improvements.
- smoke test structured handoff memory

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `src/cli/commands/work.ts` | 18 touches; Made work command a thin wrapper by moving route helper exports and render facade calls into work modules. | 2026-06-19 |
| `tests/handoff.test.js` | 17 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |
| `tests/work.test.js` | 12 touches; Implemented v0.9.1 relevant decision matching for work and handoff using normalized task, file, basename, and module terms with quiet fallback beha... | 2026-06-19 |
| `AGENTS.md` | 11 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |
| `src/cli/handoff/handoffTypes.ts` | 11 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 10 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |
| `src/cli/handoff/renderAgent.ts` | 9 touches; Fixed compact handoff output whitespace normalization and added exact regression tests for currentState and nextActions strings. | 2026-06-19 |
| `src/cli/handoff/renderJson.ts` | 9 touches; Fixed compact handoff output whitespace normalization and added exact regression tests for currentState and nextActions strings. | 2026-06-19 |
| `src/cli/handoff/handoffSources.ts` | 7 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |
| `src/cli/handoff/handoffConstants.ts` | 6 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 25 | Made work command a thin wrapper by moving route helper exports and render facade calls into work modules. |
| Handoff | 18 | Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. |
| Agent guidance | 3 | Updated README onboarding with latest-version commands, lifecycle guidance, manual-vs-automatic behavior, and cautious token-saving expectations. |
| General maintenance | 3 | Updated README SVG image URL to use the raw GitHub link for npm rendering. |
| Measurement and benchmarks | 1 | Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries. |
| Tests | 1 | Implemented task intent cleanup so generic task verbs are filtered from lookup terms when meaningful domain terms are present, with generic-only fallback cover... |
| Work memory | 1 | Extracted RCC work memory and log readers into memorySignals module |
| CLI commands | 1 | Added doctor command to warn when local RCC development repo is run with a mismatched external CLI |

## Verification Patterns

- `npm run build` (36)
- `npm test` (32)
- `node --test tests/work.test.js` (17)
- `node --test tests/handoff.test.js` (11)
- `node --test tests/cli.test.js` (9)
- `npm run benchmark:routing` (3)
- `node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture"` (2)
- `node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture" --json` (2)

<!-- repo-context-center:work-index:end -->
