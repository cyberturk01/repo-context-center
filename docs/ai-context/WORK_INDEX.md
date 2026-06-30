# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Polish Java ecosystem adoption docs and verify regressions
- Add ecosystem-aware verify defaults and adoption docs
- Add compact ecosystem detection foundation
- Tighten auth middleware routing, context-only impact confidence, and verify domain reasons
- Polish verify build alignment and translation domain calibration
- Renamed product-specific Risk Register category keys to generic messaging and frontend-api keys.
- Tightened focused-risk evidence guards and exact-word product-domain matching to prevent Risk Register leakage.

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `src/cli/verify/buildVerify.ts` | 31 touches; Add ecosystem-aware verify defaults and adoption docs | 2026-06-30 |
| `tests/verify.test.js` | 29 touches; Polish Java ecosystem adoption docs and verify regressions | 2026-06-30 |
| `tests/impact.test.js` | 26 touches; Tighten auth middleware routing, context-only impact confidence, and verify domain reasons | 2026-06-30 |
| `src/cli/impact/buildImpact.ts` | 26 touches; Refactored Verify to build plans from an existing ImpactAnalysis and updated metrics to reuse Impact instead of recomputing it. | 2026-06-30 |
| `README.md` | 22 touches; Polish Java ecosystem adoption docs and verify regressions | 2026-06-30 |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 21 touches; Tighten auth middleware routing, context-only impact confidence, and verify domain reasons | 2026-06-30 |
| `tests/outputContract.test.js` | 19 touches; Add ecosystem-aware verify defaults and adoption docs | 2026-06-30 |
| `src/cli/index.ts` | 17 touches; Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. | 2026-06-30 |
| `src/cli/work/buildWorkBrief.ts` | 16 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| General maintenance | 45 | Polish Java ecosystem adoption docs and verify regressions |
| Work routing | 43 | Tighten auth middleware routing, context-only impact confidence, and verify domain reasons |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Repository context | 19 | Refactored Impact to build from existing TaskAnalysisResult while preserving JSON output and hidden context attachments. |
| Tests | 13 | Tightened Risk Register focused-risk evidence guards to prevent product-domain leakage and added regression coverage. |
| CLI commands | 13 | Stabilized verify output by replacing duplicated execution-plan command/path payloads with section refs and compacting domain check paths |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Measurement and benchmarks | 7 | Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. |

## Verification Patterns

- `npm run build` (114)
- `npm test` (51)
- `node --test tests/impact.test.js` (27)
- `node --test tests/verify.test.js` (27)
- `node --test tests/cli.test.js` (22)
- `node --test tests/outputContract.test.js` (19)
- `node --test tests/work.test.js` (16)
- `node --test tests/*.test.js` (13)

<!-- repo-context-center:work-index:end -->
