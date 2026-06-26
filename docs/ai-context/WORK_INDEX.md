# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Keep work affected-test scoring from broad test discovery
- Shared affected-test scoring between impact and work
- Added empty verificationHints field to impact analysis model
- Added compact count summary to rcc impact JSON output
- Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy
- Clarified measure excluded-path wording in human output
- Added confidence explanation evidence to rcc impact JSON and text output

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/impact/buildImpact.ts` | 17 touches; Keep work affected-test scoring from broad test discovery | 2026-06-26 |
| `tests/work.test.js` | 16 touches; Keep work affected-test scoring from broad test discovery | 2026-06-26 |
| `tests/impact.test.js` | 16 touches; Added empty verificationHints field to impact analysis model | 2026-06-26 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `tests/init.test.js` | 13 touches; Added hard root AGENTS.md path guard for update-agent-file and identical CLAUDE content regression coverage | 2026-06-26 |
| `tests/done.test.js` | 13 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `README.md` | 11 touches; Added confidence-based affected test scoring to Impact analysis | 2026-06-26 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 24 | Keep work affected-test scoring from broad test discovery |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| General maintenance | 15 | Added empty verificationHints field to impact analysis model |
| Repository context | 10 | Added Impact contextChanges support and separated RCC/setup paths from affected files |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Tests | 6 | Tightened rcc impact affected test scoring and capped noisy recommendations |
| CLI commands | 6 | Fixed suggested command path spacing for concatenated test paths |
| Work memory | 5 | Implemented learning quality guards for repository memory |

## Verification Patterns

- `npm run build` (67)
- `npm test` (42)
- `node --test tests/*.test.js` (13)
- `node --test tests/cli.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `npm run benchmark:routing` (11)
- `node --test tests/impact.test.js` (10)
- `npm run release:check` (10)

<!-- repo-context-center:work-index:end -->
