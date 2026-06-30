# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Add v0.14.4 monorepo intelligence
- Polish Go ecosystem adoption docs and regression coverage
- Polish Python ecosystem adoption docs and regressions
- Polish Java ecosystem adoption docs and verify regressions
- Add ecosystem-aware verify defaults and adoption docs
- Add compact ecosystem detection foundation
- Tighten auth middleware routing, context-only impact confidence, and verify domain reasons

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `src/cli/verify/buildVerify.ts` | 33 touches; Add v0.14.4 monorepo intelligence | 2026-06-30 |
| `tests/verify.test.js` | 32 touches; Add v0.14.4 monorepo intelligence | 2026-06-30 |
| `src/cli/impact/buildImpact.ts` | 27 touches; Add v0.14.4 monorepo intelligence | 2026-06-30 |
| `tests/impact.test.js` | 27 touches; Add v0.14.4 monorepo intelligence | 2026-06-30 |
| `README.md` | 25 touches; Add v0.14.4 monorepo intelligence | 2026-06-30 |
| `tests/work.test.js` | 22 touches; Add v0.14.4 monorepo intelligence | 2026-06-30 |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/outputContract.test.js` | 20 touches; Add v0.14.4 monorepo intelligence | 2026-06-30 |
| `src/cli/index.ts` | 17 touches; Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. | 2026-06-30 |
| `src/cli/work/buildWorkBrief.ts` | 16 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| General maintenance | 47 | Add v0.14.4 monorepo intelligence |
| Work routing | 43 | Tighten auth middleware routing, context-only impact confidence, and verify domain reasons |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Repository context | 19 | Refactored Impact to build from existing TaskAnalysisResult while preserving JSON output and hidden context attachments. |
| Tests | 14 | Polish Go ecosystem adoption docs and regression coverage |
| CLI commands | 13 | Stabilized verify output by replacing duplicated execution-plan command/path payloads with section refs and compacting domain check paths |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Measurement and benchmarks | 7 | Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. |

## Verification Patterns

- `npm run build` (117)
- `npm test` (54)
- `node --test tests/impact.test.js` (27)
- `node --test tests/verify.test.js` (27)
- `node --test tests/cli.test.js` (22)
- `node --test tests/outputContract.test.js` (19)
- `node --test tests/work.test.js` (16)
- `node --test tests/*.test.js` (13)

<!-- repo-context-center:work-index:end -->
