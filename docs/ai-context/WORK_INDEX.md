# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Polish verify build alignment and translation domain calibration
- Renamed product-specific Risk Register category keys to generic messaging and frontend-api keys.
- Tightened focused-risk evidence guards and exact-word product-domain matching to prevent Risk Register leakage.
- Tightened Risk Register focused-risk evidence guards to prevent product-domain leakage and added regression coverage.
- Updated README and CHANGELOG to document metrics reuse as optional diagnostic behavior without changing core workflow positioning.
- Added architecture guard preventing metrics collector from directly calling duplicate high-level Work, Measure, Impact, and Verify builders.
- Refactored metrics collector to reuse task contexts, route-derived measure reports, impact-from-context, and verify-from-impact helpers whi...

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `src/cli/verify/buildVerify.ts` | 29 touches; Polish verify build alignment and translation domain calibration | 2026-06-30 |
| `tests/verify.test.js` | 26 touches; Polish verify build alignment and translation domain calibration | 2026-06-30 |
| `src/cli/impact/buildImpact.ts` | 26 touches; Refactored Verify to build plans from an existing ImpactAnalysis and updated metrics to reuse Impact instead of recomputing it. | 2026-06-30 |
| `tests/impact.test.js` | 25 touches; Refactored Verify to build plans from an existing ImpactAnalysis and updated metrics to reuse Impact instead of recomputing it. | 2026-06-30 |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `README.md` | 20 touches; Updated README and CHANGELOG to document metrics reuse as optional diagnostic behavior without changing core workflow positioning. | 2026-06-30 |
| `tests/work.test.js` | 20 touches; Add low-overhead routing for tiny obvious tasks | 2026-06-28 |
| `tests/outputContract.test.js` | 17 touches; Refactored Measure to build reports from an existing PublicAgentRoute while preserving normal measure behavior and JSON contract. | 2026-06-30 |
| `src/cli/index.ts` | 17 touches; Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. | 2026-06-30 |
| `src/cli/work/buildWorkBrief.ts` | 16 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| General maintenance | 42 | Polish verify build alignment and translation domain calibration |
| Work routing | 42 | Added architecture guard preventing metrics collector from directly calling duplicate high-level Work, Measure, Impact, and Verify builders. |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Repository context | 19 | Refactored Impact to build from existing TaskAnalysisResult while preserving JSON output and hidden context attachments. |
| Tests | 13 | Tightened Risk Register focused-risk evidence guards to prevent product-domain leakage and added regression coverage. |
| CLI commands | 13 | Stabilized verify output by replacing duplicated execution-plan command/path payloads with section refs and compacting domain check paths |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Measurement and benchmarks | 7 | Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. |

## Verification Patterns

- `npm run build` (110)
- `npm test` (49)
- `node --test tests/impact.test.js` (26)
- `node --test tests/verify.test.js` (26)
- `node --test tests/cli.test.js` (22)
- `node --test tests/outputContract.test.js` (18)
- `node --test tests/work.test.js` (15)
- `node --test tests/*.test.js` (13)

<!-- repo-context-center:work-index:end -->
