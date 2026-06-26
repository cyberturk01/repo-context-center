# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Relaxed weak semantic impact assertion for dirty working-tree files
- Improved Measure excluded-file reporting with separate ignored, unsupported, and scan-cap buckets
- Fixed suggested command path spacing for concatenated test paths
- Added confidence-based affected test scoring to Impact analysis
- Ignored generic action words in Impact task parsing while preserving technical terms
- Added Impact contextChanges support and separated RCC/setup paths from affected files
- Added hard root AGENTS.md path guard for update-agent-file and identical CLAUDE content regression coverage

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 14 touches; Calibrated cross-repo routing for Guardian-style release hardening output-contract tasks | 2026-06-24 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `tests/init.test.js` | 13 touches; Added hard root AGENTS.md path guard for update-agent-file and identical CLAUDE content regression coverage | 2026-06-26 |
| `tests/done.test.js` | 13 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `tests/impact.test.js` | 12 touches; Relaxed weak semantic impact assertion for dirty working-tree files | 2026-06-26 |
| `src/cli/impact/buildImpact.ts` | 11 touches; Fixed suggested command path spacing for concatenated test paths | 2026-06-26 |
| `README.md` | 11 touches; Added confidence-based affected test scoring to Impact analysis | 2026-06-26 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Work routing | 22 | Updated remaining map and v0.7 release tests for simplified RCC workflow guidance |
| General maintenance | 12 | Relaxed weak semantic impact assertion for dirty working-tree files |
| Repository context | 10 | Added Impact contextChanges support and separated RCC/setup paths from affected files |
| Agent guidance | 8 | Added hard root AGENTS.md path guard for update-agent-file and identical CLAUDE content regression coverage |
| CLI commands | 6 | Fixed suggested command path spacing for concatenated test paths |
| Tests | 5 | Added confidence-based affected test scoring to Impact analysis |
| Work memory | 5 | Implemented learning quality guards for repository memory |

## Verification Patterns

- `npm run build` (61)
- `npm test` (42)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/cli.test.js` (12)
- `npm run benchmark:routing` (11)
- `npm run release:check` (10)
- `node --test tests/init.test.js` (6)

<!-- repo-context-center:work-index:end -->
