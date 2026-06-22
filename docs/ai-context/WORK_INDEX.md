# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Implemented learning quality guards for repository memory
- Added routing evaluation matrix for route quality and compactness
- Added release and install reliability guards
- Added JSON and agent output contract stability tests
- Added fixture-driven routing regression suite and benchmark checks
- Removed package self-dependency that broke npm ci
- Added done learning controls for tiny typo tasks

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 13 touches; Added JSON and agent output contract stability tests | 2026-06-22 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/commands/done.ts` | 12 touches; Implemented learning quality guards for repository memory | 2026-06-22 |
| `tests/done.test.js` | 11 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |
| `src/cli/handoff/renderAgent.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderJson.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/work/renderAgent.ts` | 9 touches; Added JSON and agent output contract stability tests | 2026-06-22 |
| `src/cli/work/buildWorkBrief.ts` | 8 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 23 | Deduplicate handoff Work index memory against Last completed |
| Work routing | 15 | Added routing evaluation matrix for route quality and compactness |
| General maintenance | 6 | Added release and install reliability guards |
| Repository context | 6 | Updated README with Repository Learning and learn command documentation |
| Work memory | 5 | Implemented learning quality guards for repository memory |
| Agent guidance | 2 | Fixed tiny task guidance spacing regressions by aligning tiny text guidance and adding agent output regression coverage for joined words. |
| CLI commands | 2 | Add command architecture boundary tests |
| Measurement and benchmarks | 1 | Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries. |

## Verification Patterns

- `npm run build` (37)
- `npm test` (25)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/cli.test.js` (9)
- `npm run benchmark:routing` (7)
- `node --test tests/work.test.js` (5)
- `npm run release:check` (3)

<!-- repo-context-center:work-index:end -->
