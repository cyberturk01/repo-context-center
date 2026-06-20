# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Integrated repository learning updates into archive lifecycle
- Added Repository Learning markdown renderer
- Built repository learning model from work memory
- Added repository learning context generation
- Compacted handoff memory to five prioritized continuation entries while preserving handoff schema fields.
- Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory.
- Updated README onboarding with latest-version commands, lifecycle guidance, manual-vs-automatic behavior, and cautious token-saving expecta...

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 18 touches; Compacted handoff memory to five prioritized continuation entries while preserving handoff schema fields. | 2026-06-20 |
| `src/cli/commands/work.ts` | 16 touches; Made work command a thin wrapper by moving route helper exports and render facade calls into work modules. | 2026-06-19 |
| `src/cli/handoff/buildHandoffBrief.ts` | 11 touches; Compacted handoff memory to five prioritized continuation entries while preserving handoff schema fields. | 2026-06-20 |
| `src/cli/handoff/handoffTypes.ts` | 11 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |
| `AGENTS.md` | 10 touches; Implemented WORK_INDEX generation from completed work, archive compaction for WORK_LOG, and handoff use of compact work memory. | 2026-06-20 |
| `tests/work.test.js` | 10 touches; Implemented v0.9.1 relevant decision matching for work and handoff using normalized task, file, basename, and module terms with quiet fallback beha... | 2026-06-19 |
| `src/cli/commands/done.ts` | 9 touches; Integrated repository learning updates into archive lifecycle | 2026-06-20 |
| `src/cli/handoff/renderAgent.ts` | 9 touches; Fixed compact handoff output whitespace normalization and added exact regression tests for currentState and nextActions strings. | 2026-06-19 |
| `src/cli/handoff/renderJson.ts` | 9 touches; Fixed compact handoff output whitespace normalization and added exact regression tests for currentState and nextActions strings. | 2026-06-19 |
| `tests/done.test.js` | 8 touches; Integrated repository learning updates into archive lifecycle | 2026-06-20 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 23 | Made work command a thin wrapper by moving route helper exports and render facade calls into work modules. |
| Handoff | 19 | Compacted handoff memory to five prioritized continuation entries while preserving handoff schema fields. |
| Work memory | 3 | Integrated repository learning updates into archive lifecycle |
| Agent guidance | 3 | Updated README onboarding with latest-version commands, lifecycle guidance, manual-vs-automatic behavior, and cautious token-saving expectations. |
| Repository context | 2 | Added Repository Learning markdown renderer |
| General maintenance | 2 | Updated README SVG image URL to use the raw GitHub link for npm rendering. |
| Measurement and benchmarks | 1 | Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries. |
| Tests | 1 | Implemented task intent cleanup so generic task verbs are filtered from lookup terms when meaningful domain terms are present, with generic-only fallback cover... |

## Verification Patterns

- `npm run build` (37)
- `npm test` (30)
- `node --test tests/work.test.js` (14)
- `node --test tests/handoff.test.js` (11)
- `node --test tests/cli.test.js` (9)
- `node --test tests/*.test.js` (4)
- `npm run benchmark:routing` (3)
- `node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture"` (2)

<!-- repo-context-center:work-index:end -->
