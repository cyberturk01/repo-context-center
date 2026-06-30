# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Repositioned metrics as optional diagnostic insight instead of a core workflow step.
- Updated README and CHANGELOG for recent metrics and verify contract work.
- Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes.
- Added rcc metrics command as a thin wrapper over repository metrics collector and renderer.
- Added RepositoryMetrics human and JSON renderers with focused renderer contract tests.
- Added RepositoryMetrics collector that summarizes existing Work, Impact, Verify, and Measure builder outputs without direct repository scan...
- Added shared RepositoryMetrics type model for future metrics collector outputs.

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `src/cli/verify/buildVerify.ts` | 27 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |
| `src/cli/impact/buildImpact.ts` | 24 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |
| `tests/verify.test.js` | 24 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |
| `tests/impact.test.js` | 23 touches; refined impact confidence calculation | 2026-06-28 |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 20 touches; Add low-overhead routing for tiny obvious tasks | 2026-06-28 |
| `README.md` | 19 touches; Repositioned metrics as optional diagnostic insight instead of a core workflow step. | 2026-06-30 |
| `src/cli/index.ts` | 17 touches; Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. | 2026-06-30 |
| `src/cli/work/buildWorkBrief.ts` | 16 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |
| `tests/cli.test.js` | 15 touches; Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. | 2026-06-30 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 39 | Updated README and CHANGELOG for recent metrics and verify contract work. |
| General maintenance | 37 | Repositioned metrics as optional diagnostic insight instead of a core workflow step. |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Repository context | 18 | Added rcc metrics command as a thin wrapper over repository metrics collector and renderer. |
| CLI commands | 13 | Stabilized verify output by replacing duplicated execution-plan command/path payloads with section refs and compacting domain check paths |
| Tests | 12 | Hardened verify JSON output contract coverage for agent-safe parseable plans |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Measurement and benchmarks | 7 | Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes. |

## Verification Patterns

- `npm run build` (101)
- `npm test` (49)
- `node --test tests/impact.test.js` (26)
- `node --test tests/verify.test.js` (25)
- `node --test tests/cli.test.js` (22)
- `node --test tests/outputContract.test.js` (17)
- `node --test tests/work.test.js` (15)
- `node --test tests/*.test.js` (13)

<!-- repo-context-center:work-index:end -->
