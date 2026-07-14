# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- added WORK_LOG token budget guardrail
- added automatic work log compaction
- added configurable done log formats
- separated done metadata into JSONL work events
- implemented compact work log entries
- added routing benchmark surface coverage cases
- documented clean done file modes

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/verify.test.js` | 23 touches; Hardened RC command docs, estimate JSON contract, and handoff verification spacing | 2026-06-30 |
| `src/cli/verify/buildVerify.ts` | 23 touches; Add v0.14.4 monorepo intelligence | 2026-06-30 |
| `README.md` | 16 touches; added configurable done log formats | 2026-07-14 |
| `tests/outputContract.test.js` | 16 touches; Hardened RC command docs, estimate JSON contract, and handoff verification spacing | 2026-06-30 |
| `tests/work.test.js` | 11 touches; added missing surface warnings to work output | 2026-07-14 |
| `src/cli/work/taskFileRecommendations.ts` | 8 touches; added routing benchmark surface coverage cases | 2026-07-14 |
| `src/cli/work/buildWorkBrief.ts` | 8 touches; added missing surface warnings to work output | 2026-07-14 |
| `src/cli/commands/done.ts` | 7 touches; added WORK_LOG token budget guardrail | 2026-07-14 |
| `src/core/taskIntent.ts` | 7 touches; added multi-surface work routing coverage | 2026-07-14 |
| `src/cli/work/targetedLookup.ts` | 7 touches; Added automatic WORK_LOG compaction and archived oversized live history | 2026-07-06 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| General maintenance | 25 | added configurable done log formats |
| Work routing | 16 | separated done metadata into JSONL work events |
| Repository context | 8 | Preserve existing repository learning during map --write and init --update |
| Measurement and benchmarks | 3 | added WORK_LOG token budget guardrail |
| Work memory | 3 | added automatic work log compaction |
| CLI commands | 3 | Stabilized verify output by replacing duplicated execution-plan command/path payloads with section refs and compacting domain check paths |
| Tests | 2 | Polish Go ecosystem adoption docs and regression coverage |
| Handoff | 1 | Hardened RC command docs, estimate JSON contract, and handoff verification spacing |

## Verification Patterns

- `npm run build` (50)
- `node --test tests/verify.test.js` (14)
- `npm test` (14)
- `node --test tests/outputContract.test.js` (12)
- `node --test tests/cli.test.js` (7)
- `node --test tests/work.test.js` (4)
- `node --test tests/ecosystemDetector.test.js tests/verify.test.js tests/outputContract.test.js` (3)
- `node --test tests/impact.test.js` (3)

<!-- repo-context-center:work-index:end -->
