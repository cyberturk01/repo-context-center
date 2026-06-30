# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Added architecture guard preventing metrics collector from directly calling duplicate high-level Work, Measure, Impact, and Verify builders.
- Refactored metrics collector to reuse task contexts, route-derived measure reports, impact-from-context, and verify-from-impact helpers whi...
- Refactored Measure to build reports from an existing PublicAgentRoute while preserving normal measure behavior and JSON contract.
- Refactored Verify to build plans from an existing ImpactAnalysis and updated metrics to reuse Impact instead of recomputing it.
- Refactored Impact to build from existing TaskAnalysisResult while preserving JSON output and hidden context attachments.
- Repositioned metrics as optional diagnostic insight instead of a core workflow step.
- Updated README and CHANGELOG for recent metrics and verify contract work.

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `src/cli/verify/buildVerify.ts` | 28 touches; Refactored Verify to build plans from an existing ImpactAnalysis and updated metrics to reuse Impact instead of recomputing it. | 2026-06-30 |
| `src/cli/impact/buildImpact.ts` | 26 touches; Refactored Verify to build plans from an existing ImpactAnalysis and updated metrics to reuse Impact instead of recomputing it. | 2026-06-30 |
| `tests/impact.test.js` | 25 touches; Refactored Verify to build plans from an existing ImpactAnalysis and updated metrics to reuse Impact instead of recomputing it. | 2026-06-30 |
| `tests/verify.test.js` | 25 touches; Refactored Verify to build plans from an existing ImpactAnalysis and updated metrics to reuse Impact instead of recomputing it. | 2026-06-30 |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 20 touches; Add low-overhead routing for tiny obvious tasks | 2026-06-28 |
| `README.md` | 19 touches; Repositioned metrics as optional diagnostic insight instead of a core workflow step. | 2026-06-30 |
| `tests/outputContract.test.js` | 17 touches; Refactored Measure to build reports from an existing PublicAgentRoute while preserving normal measure behavior and JSON contract. | 2026-06-30 |
| `src/cli/index.ts` | 17 touches; Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. | 2026-06-30 |
| `src/cli/work/buildWorkBrief.ts` | 16 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 42 | Added architecture guard preventing metrics collector from directly calling duplicate high-level Work, Measure, Impact, and Verify builders. |
| General maintenance | 38 | Refactored Verify to build plans from an existing ImpactAnalysis and updated metrics to reuse Impact instead of recomputing it. |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Repository context | 19 | Refactored Impact to build from existing TaskAnalysisResult while preserving JSON output and hidden context attachments. |
| CLI commands | 13 | Stabilized verify output by replacing duplicated execution-plan command/path payloads with section refs and compacting domain check paths |
| Tests | 12 | Hardened verify JSON output contract coverage for agent-safe parseable plans |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Measurement and benchmarks | 7 | Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. |

## Verification Patterns

- `npm run build` (106)
- `npm test` (49)
- `node --test tests/impact.test.js` (26)
- `node --test tests/verify.test.js` (25)
- `node --test tests/cli.test.js` (22)
- `node --test tests/outputContract.test.js` (17)
- `node --test tests/work.test.js` (15)
- `node --test tests/*.test.js` (13)

<!-- repo-context-center:work-index:end -->
