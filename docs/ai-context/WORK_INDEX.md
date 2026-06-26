# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Added confidence explanation evidence to rcc impact JSON and text output
- Tightened rcc impact affected test scoring and capped noisy recommendations
- Relaxed weak semantic impact assertion for dirty working-tree files
- Improved Measure excluded-file reporting with separate ignored, unsupported, and scan-cap buckets
- Fixed suggested command path spacing for concatenated test paths
- Added confidence-based affected test scoring to Impact analysis
- Ignored generic action words in Impact task parsing while preserving technical terms

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/impact.test.js` | 14 touches; Added confidence explanation evidence to rcc impact JSON and text output | 2026-06-26 |
| `tests/work.test.js` | 14 touches; Calibrated cross-repo routing for Guardian-style release hardening output-contract tasks | 2026-06-24 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `src/cli/impact/buildImpact.ts` | 13 touches; Added confidence explanation evidence to rcc impact JSON and text output | 2026-06-26 |
| `tests/init.test.js` | 13 touches; Added hard root AGENTS.md path guard for update-agent-file and identical CLAUDE content regression coverage | 2026-06-26 |
| `tests/done.test.js` | 13 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `README.md` | 11 touches; Added confidence-based affected test scoring to Impact analysis | 2026-06-26 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Work routing | 22 | Updated remaining map and v0.7 release tests for simplified RCC workflow guidance |
| General maintenance | 13 | Added confidence explanation evidence to rcc impact JSON and text output |
| Repository context | 10 | Added Impact contextChanges support and separated RCC/setup paths from affected files |
| Agent guidance | 8 | Added hard root AGENTS.md path guard for update-agent-file and identical CLAUDE content regression coverage |
| Tests | 6 | Tightened rcc impact affected test scoring and capped noisy recommendations |
| CLI commands | 6 | Fixed suggested command path spacing for concatenated test paths |
| Work memory | 5 | Implemented learning quality guards for repository memory |

## Verification Patterns

- `npm run build` (63)
- `npm test` (42)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/cli.test.js` (12)
- `npm run benchmark:routing` (11)
- `npm run release:check` (10)
- `node --test tests/impact.test.js` (6)

<!-- repo-context-center:work-index:end -->
