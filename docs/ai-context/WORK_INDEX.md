# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Removed package self-dependency that broke npm ci
- Added done learning controls for tiny typo tasks
- Compact medium work supporting files with optional boundary tier
- Fixed Turkish workflow routing tasks to prefer RCC routing implementation
- Fixed renderAgent guidance typo to refer to rcc work explicitly.
- Fixed tiny task guidance spacing regressions by aligning tiny text guidance and adding agent output regression coverage for joined words.
- Added task-size route pruning for rcc work so tiny and small briefs cap route files while preserving medium and large behavior.

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `tests/work.test.js` | 12 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |
| `src/cli/commands/done.ts` | 11 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |
| `tests/done.test.js` | 11 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |
| `src/cli/handoff/renderAgent.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderJson.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/work/buildWorkBrief.ts` | 8 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |
| `src/cli/work/renderAgent.ts` | 8 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 23 | Deduplicate handoff Work index memory against Last completed |
| Work routing | 13 | Compact medium work supporting files with optional boundary tier |
| Repository context | 6 | Updated README with Repository Learning and learn command documentation |
| General maintenance | 4 | Removed package self-dependency that broke npm ci |
| Work memory | 4 | Refactor work memory artifact refresh into shared helper |
| Agent guidance | 2 | Fixed tiny task guidance spacing regressions by aligning tiny text guidance and adding agent output regression coverage for joined words. |
| CLI commands | 2 | Add command architecture boundary tests |
| Measurement and benchmarks | 1 | Added lightweight tests for benchmark script presence, package script targets, and developer-only runtime packaging boundaries. |

## Verification Patterns

- `npm run build` (32)
- `npm test` (21)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/cli.test.js` (9)
- `node --test tests/work.test.js` (4)
- `npm run benchmark:routing` (2)
- `git diff --check` (1)

<!-- repo-context-center:work-index:end -->
