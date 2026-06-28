# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Added safe manual smoke check heuristics to VerificationPlan generation
- Added rcc verify CLI backed by ImpactAnalysis recommendations
- Updated CLI help test to keep verify hidden until CLI command is implemented
- Built VerificationPlan generation from ImpactAnalysis with focused adapter tests
- Implemented shared VerificationPlan model and focused construction tests without exposing verify CLI
- Add low-overhead routing for tiny obvious tasks
- updated changelog for v0.11.1

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/impact.test.js` | 23 touches; refined impact confidence calculation | 2026-06-28 |
| `src/cli/impact/buildImpact.ts` | 22 touches; ranked impact affected files by confidence | 2026-06-28 |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 20 touches; Add low-overhead routing for tiny obvious tasks | 2026-06-28 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/index.ts` | 14 touches; Added rcc verify CLI backed by ImpactAnalysis recommendations | 2026-06-28 |
| `src/cli/work/buildWorkBrief.ts` | 14 touches; Add low-overhead routing for tiny obvious tasks | 2026-06-28 |
| `tests/init.test.js` | 14 touches; Fix RCC agent-file update mode for AGENTS and CLAUDE | 2026-06-28 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `README.md` | 13 touches; updated README for latest RCC workflow and impact changes | 2026-06-27 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 35 | Add low-overhead routing for tiny obvious tasks |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| General maintenance | 23 | Added safe manual smoke check heuristics to VerificationPlan generation |
| Tests | 11 | Add evidence-based TaskAnalysis test eligibility |
| CLI commands | 10 | Added rcc verify CLI backed by ImpactAnalysis recommendations |
| Repository context | 10 | Added Impact contextChanges support and separated RCC/setup paths from affected files |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Measurement and benchmarks | 5 | Fixed start focus signal selection so camelCase filenames like fileSystem.ts retain strong non-generic token matches. |

## Verification Patterns

- `npm run build` (79)
- `npm test` (43)
- `node --test tests/impact.test.js` (24)
- `node --test tests/cli.test.js` (15)
- `node --test tests/work.test.js` (14)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `npm run benchmark:routing` (11)

<!-- repo-context-center:work-index:end -->
