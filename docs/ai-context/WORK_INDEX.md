# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Improved work agent no-test guidance
- Added task-only mode to impact analysis
- Add structured affected-test metadata to impact JSON
- Tightened affected-test confidence thresholds
- Keep work affected-test scoring from broad test discovery
- Shared affected-test scoring between impact and work
- Added empty verificationHints field to impact analysis model

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/impact/buildImpact.ts` | 19 touches; Added task-only mode to impact analysis | 2026-06-26 |
| `tests/impact.test.js` | 19 touches; Added task-only mode to impact analysis | 2026-06-26 |
| `tests/work.test.js` | 18 touches; Improved work agent no-test guidance | 2026-06-26 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `tests/init.test.js` | 13 touches; Added hard root AGENTS.md path guard for update-agent-file and identical CLAUDE content regression coverage | 2026-06-26 |
| `tests/done.test.js` | 13 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `README.md` | 12 touches; Added task-only mode to impact analysis | 2026-06-26 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 25 | Improved work agent no-test guidance |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| General maintenance | 16 | Added task-only mode to impact analysis |
| Repository context | 10 | Added Impact contextChanges support and separated RCC/setup paths from affected files |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Tests | 8 | Add structured affected-test metadata to impact JSON |
| CLI commands | 6 | Fixed suggested command path spacing for concatenated test paths |
| Work memory | 5 | Implemented learning quality guards for repository memory |

## Verification Patterns

- `npm run build` (67)
- `npm test` (42)
- `node --test tests/*.test.js` (13)
- `node --test tests/cli.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/impact.test.js` (13)
- `npm run benchmark:routing` (11)
- `npm run release:check` (10)

<!-- repo-context-center:work-index:end -->
