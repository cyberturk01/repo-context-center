# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Updated remaining map and v0.7 release tests for simplified RCC workflow guidance
- Simplified RCC workflow guidance and made validate check fallback guidance through RCC_WORKFLOW pointer
- Enhanced rcc doctor to inspect active CLI capabilities, probe shell rcc/repo-context-center commands, detect stale binaries and same-versio...
- Fixed AGENTS.md RCC workflow marker detection so init updates marked blocks instead of treating them as markerless, and added regressions f...
- Fixed validate to accept minimal AGENTS.md pointer when docs/ai-context/RCC_WORKFLOW.md contains DO_NOT_READ guidance, preserving warnings ...
- Updated RCC workflow guidance to require a three-command retry chain before fallback and added strict bounded fallback rules for minimal co...
- Implemented safe AI instruction handling with dedicated docs/ai-context/RCC_WORKFLOW.md, minimal AGENTS pointer policy, non-RCC AI file det...

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 14 touches; Calibrated cross-repo routing for Guardian-style release hardening output-contract tasks | 2026-06-24 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `tests/done.test.js` | 13 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `src/cli/handoff/handoffTypes.ts` | 13 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `tests/init.test.js` | 11 touches; Simplified RCC workflow guidance and made validate check fallback guidance through RCC_WORKFLOW pointer | 2026-06-26 |
| `src/cli/handoff/renderAgent.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `src/cli/handoff/renderJson.ts` | 11 touches; Polished handoff repository learning hint ordering | 2026-06-20 |
| `README.md` | 9 touches; Clarified measure vs estimate usage, added helpful measure --compare-naive error, updated generated workflow guidance and README, and covered the di... | 2026-06-25 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Work routing | 22 | Updated remaining map and v0.7 release tests for simplified RCC workflow guidance |
| General maintenance | 10 | Fixed impact path normalization for cross-repo local dist execution |
| Repository context | 9 | Implemented safe AI instruction handling with dedicated docs/ai-context/RCC_WORKFLOW.md, minimal AGENTS pointer policy, non-RCC AI file detection notices, and ... |
| Agent guidance | 6 | Fixed validate to accept minimal AGENTS.md pointer when docs/ai-context/RCC_WORKFLOW.md contains DO_NOT_READ guidance, preserving warnings for custom AGENTS fi... |
| CLI commands | 5 | Clarified RCC local/global CLI alignment and doctor local install path |
| Work memory | 5 | Implemented learning quality guards for repository memory |
| Tests | 4 | Hardened impact focused test suggestions and README docs-only dominance |

## Verification Patterns

- `npm run build` (55)
- `npm test` (39)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/cli.test.js` (12)
- `npm run benchmark:routing` (11)
- `npm run release:check` (10)
- `node --test tests/init.test.js` (5)

<!-- repo-context-center:work-index:end -->
