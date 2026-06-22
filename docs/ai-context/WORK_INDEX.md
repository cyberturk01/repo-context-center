# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Added release and install reliability guards
- Added JSON and agent output contract stability tests
- Added fixture-driven routing regression suite and benchmark checks
- Removed package self-dependency that broke npm ci
- Added done learning controls for tiny typo tasks
- Compact medium work supporting files with optional boundary tier
- Fixed Turkish workflow routing tasks to prefer RCC routing implementation

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 13 touches; Added JSON and agent output contract stability tests | 2026-06-22 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/commands/done.ts` | 11 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |
| `tests/done.test.js` | 11 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |
| `src/cli/handoff/renderAgent.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderJson.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/work/renderAgent.ts` | 9 touches; Added JSON and agent output contract stability tests | 2026-06-22 |
| `src/cli/work/buildWorkBrief.ts` | 8 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 23 | Deduplicate handoff Work index memory against Last completed |
| Work routing | 14 | Added fixture-driven routing regression suite and benchmark checks |
| General maintenance | 6 | Added release and install reliability guards |
| Repository context | 6 | Updated README with Repository Learning and learn command documentation |
| Work memory | 4 | Refactor work memory artifact refresh into shared helper |
| Agent guidance | 2 | Fixed tiny task guidance spacing regressions by aligning tiny text guidance and adding agent output regression coverage for joined words. |
| CLI commands | 2 | Add command architecture boundary tests |
| Measurement and benchmarks | 1 | Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries. |

## Verification Patterns

- `npm run build` (35)
- `npm test` (23)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/cli.test.js` (9)
- `node --test tests/work.test.js` (5)
- `npm run benchmark:routing` (5)
- `npm pack --dry-run` (2)

<!-- repo-context-center:work-index:end -->
