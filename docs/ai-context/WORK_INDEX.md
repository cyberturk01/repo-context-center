# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Implemented cross-repo AGENTS upgrade reliability with init --update and map --write stale warnings
- Added negative coverage for done handoff file path injection and verbose agent JSON boundaries
- Added Guardian coverage tests for scripts and security-sensitive agent/done output
- Implemented learning quality guards for repository memory
- Added routing evaluation matrix for route quality and compactness
- Added release and install reliability guards
- Added JSON and agent output contract stability tests

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `tests/done.test.js` | 13 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `tests/work.test.js` | 13 touches; Added JSON and agent output contract stability tests | 2026-06-22 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderAgent.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderJson.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/work/renderAgent.ts` | 9 touches; Added JSON and agent output contract stability tests | 2026-06-22 |
| `src/cli/work/buildWorkBrief.ts` | 8 touches; Added done learning controls for tiny typo tasks | 2026-06-22 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Work routing | 15 | Added routing evaluation matrix for route quality and compactness |
| Repository context | 7 | Implemented cross-repo AGENTS upgrade reliability with init --update and map --write stale warnings |
| General maintenance | 6 | Added release and install reliability guards |
| Work memory | 5 | Implemented learning quality guards for repository memory |
| Tests | 2 | Added Guardian coverage tests for scripts and security-sensitive agent/done output |
| Agent guidance | 2 | Fixed tiny task guidance spacing regressions by aligning tiny text guidance and adding agent output regression coverage for joined words. |
| CLI commands | 2 | Add command architecture boundary tests |

## Verification Patterns

- `npm run build` (39)
- `npm test` (27)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/cli.test.js` (9)
- `npm run benchmark:routing` (9)
- `node --test tests/work.test.js` (5)
- `npm run release:check` (4)

<!-- repo-context-center:work-index:end -->
