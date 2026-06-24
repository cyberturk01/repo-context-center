# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Added fixture-based impact quality matrix covering focused source, docs-only, package, and changed-test cases; filtered RCC scaffolding fro...
- Implemented RCC v0.11 impact analysis MVP with task/change heuristics, JSON output, suggested commands, and tests.
- Clarified RCC local/global CLI alignment and doctor local install path
- Documented init update latest usage and cleaned AGENTS upgrade leftovers
- Calibrated cross-repo routing for Guardian-style release hardening output-contract tasks
- Implemented RCC binary version alignment diagnostics in doctor with local/dependency mismatch checks and --version
- Implemented cross-repo AGENTS upgrade reliability with init --update and map --write stale warnings

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 14 touches; Calibrated cross-repo routing for Guardian-style release hardening output-contract tasks | 2026-06-24 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `tests/done.test.js` | 13 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderAgent.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderJson.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/work/renderAgent.ts` | 9 touches; Added JSON and agent output contract stability tests | 2026-06-22 |
| `src/cli/work/taskFileRecommendations.ts` | 8 touches; Calibrated cross-repo routing for Guardian-style release hardening output-contract tasks | 2026-06-24 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Work routing | 16 | Calibrated cross-repo routing for Guardian-style release hardening output-contract tasks |
| General maintenance | 7 | Implemented RCC v0.11 impact analysis MVP with task/change heuristics, JSON output, suggested commands, and tests. |
| Repository context | 7 | Implemented cross-repo AGENTS upgrade reliability with init --update and map --write stale warnings |
| CLI commands | 5 | Clarified RCC local/global CLI alignment and doctor local install path |
| Work memory | 5 | Implemented learning quality guards for repository memory |
| Tests | 3 | Added fixture-based impact quality matrix covering focused source, docs-only, package, and changed-test cases; filtered RCC scaffolding from inferred affected ... |
| Agent guidance | 2 | Fixed tiny task guidance spacing regressions by aligning tiny text guidance and adding agent output regression coverage for joined words. |

## Verification Patterns

- `npm run build` (43)
- `npm test` (32)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `npm run benchmark:routing` (11)
- `node --test tests/cli.test.js` (10)
- `npm run release:check` (7)
- `node --test tests/work.test.js` (5)

<!-- repo-context-center:work-index:end -->
