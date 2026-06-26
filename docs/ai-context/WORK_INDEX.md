# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Added Impact contextChanges support and separated RCC/setup paths from affected files
- Added hard root AGENTS.md path guard for update-agent-file and identical CLAUDE content regression coverage
- Guarded init --update-agent-file so only AGENTS.md is writable and added external AI file regression coverage
- Updated remaining map and v0.7 release tests for simplified RCC workflow guidance
- Simplified RCC workflow guidance and made validate check fallback guidance through RCC_WORKFLOW pointer
- Enhanced rcc doctor to inspect active CLI capabilities, probe shell rcc/repo-context-center commands, detect stale binaries and same-versio...
- Fixed AGENTS.md RCC workflow marker detection so init updates marked blocks instead of treating them as markerless, and added regressions f...

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
| `src/cli/handoff/renderAgent.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderJson.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `README.md` | 10 touches; Added Impact contextChanges support and separated RCC/setup paths from affected files | 2026-06-26 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Work routing | 22 | Updated remaining map and v0.7 release tests for simplified RCC workflow guidance |
| Repository context | 10 | Added Impact contextChanges support and separated RCC/setup paths from affected files |
| General maintenance | 10 | Fixed impact path normalization for cross-repo local dist execution |
| Agent guidance | 8 | Added hard root AGENTS.md path guard for update-agent-file and identical CLAUDE content regression coverage |
| CLI commands | 5 | Clarified RCC local/global CLI alignment and doctor local install path |
| Work memory | 5 | Implemented learning quality guards for repository memory |
| Tests | 4 | Hardened impact focused test suggestions and README docs-only dominance |

## Verification Patterns

- `npm run build` (58)
- `npm test` (39)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/cli.test.js` (12)
- `npm run benchmark:routing` (11)
- `npm run release:check` (10)
- `node --test tests/init.test.js` (6)

<!-- repo-context-center:work-index:end -->
