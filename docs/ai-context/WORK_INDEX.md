# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Compacted handoff memory to five prioritized continuation entries while preserving handoff schema fields.
- Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory.
- Updated README onboarding with latest-version commands, lifecycle guidance, manual-vs-automatic behavior, and cautious token-saving expecta...
- Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries.
- Updated README SVG image URL to use the raw GitHub link for npm rendering.
- Updated README.md for RCC v0.9.3 Agent Handover capabilities and refreshed the workflow diagram.
- Updated CHANGELOG.md for the upcoming RCC v0.9.3 release with v0.9.x handoff and routing improvements.

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 18 touches; Compacted handoff memory to five prioritized continuation entries while preserving handoff schema fields. | 2026-06-20 |
| `src/cli/commands/work.ts` | 16 touches; Made work command a thin wrapper by moving route helper exports and render facade calls into work modules. | 2026-06-19 |
| `src/cli/handoff/buildHandoffBrief.ts` | 11 touches; Compacted handoff memory to five prioritized continuation entries while preserving handoff schema fields. | 2026-06-20 |
| `src/cli/handoff/handoffTypes.ts` | 11 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |
| `AGENTS.md` | 10 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |
| `tests/work.test.js` | 10 touches; Implemented v0.9.1 relevant decision matching for work and handoff using normalized task, file, basename, and module terms with quiet fallback beha... | 2026-06-19 |
| `src/cli/handoff/renderAgent.ts` | 9 touches; Fixed compact handoff output whitespace normalization and added exact regression tests for currentState and nextActions strings. | 2026-06-19 |
| `src/cli/handoff/renderJson.ts` | 9 touches; Fixed compact handoff output whitespace normalization and added exact regression tests for currentState and nextActions strings. | 2026-06-19 |
| `src/cli/handoff/handoffConstants.ts` | 7 touches; Compacted handoff memory to five prioritized continuation entries while preserving handoff schema fields. | 2026-06-20 |
| `src/cli/handoff/handoffSources.ts` | 7 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 23 | Made work command a thin wrapper by moving route helper exports and render facade calls into work modules. |
| Handoff | 19 | Compacted handoff memory to five prioritized continuation entries while preserving handoff schema fields. |
| Agent guidance | 3 | Updated README onboarding with latest-version commands, lifecycle guidance, manual-vs-automatic behavior, and cautious token-saving expectations. |
| General maintenance | 2 | Updated README SVG image URL to use the raw GitHub link for npm rendering. |
| Measurement and benchmarks | 1 | Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries. |
| Tests | 1 | Implemented task intent cleanup so generic task verbs are filtered from lookup terms when meaningful domain terms are present, with generic-only fallback cover... |
| Work memory | 1 | Extracted RCC work memory and log readers into memorySignals module |
| CLI commands | 1 | Added doctor command to warn when local RCC development repo is run with a mismatched external CLI |

## Verification Patterns

- `npm run build` (33)
- `npm test` (30)
- `node --test tests/work.test.js` (14)
- `node --test tests/handoff.test.js` (11)
- `node --test tests/cli.test.js` (9)
- `npm run benchmark:routing` (3)
- `node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture"` (2)
- `node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture" --json` (2)

<!-- repo-context-center:work-index:end -->
