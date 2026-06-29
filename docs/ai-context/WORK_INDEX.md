# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Add domain-aware verification planning
- Add planned verification mode for rcc verify
- Refined context-only verify confidence
- Made rcc verify conservative for context-only working-tree changes
- Documented RCC v0.12.0 Verify Intelligence in README and CHANGELOG
- Hardened verify JSON output contract coverage for agent-safe parseable plans
- Added short validation checklist generation to RCC Verify

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/impact.test.js` | 23 touches; refined impact confidence calculation | 2026-06-28 |
| `src/cli/impact/buildImpact.ts` | 22 touches; ranked impact affected files by confidence | 2026-06-28 |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 20 touches; Add low-overhead routing for tiny obvious tasks | 2026-06-28 |
| `src/cli/index.ts` | 15 touches; Add planned verification mode for rcc verify | 2026-06-29 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `README.md` | 14 touches; Documented RCC v0.12.0 Verify Intelligence in README and CHANGELOG | 2026-06-28 |
| `src/cli/work/buildWorkBrief.ts` | 14 touches; Add low-overhead routing for tiny obvious tasks | 2026-06-28 |
| `tests/init.test.js` | 14 touches; Fix RCC agent-file update mode for AGENTS and CLAUDE | 2026-06-28 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 35 | Add low-overhead routing for tiny obvious tasks |
| General maintenance | 27 | Add domain-aware verification planning |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Repository context | 12 | Refined context-only verify confidence |
| Tests | 12 | Hardened verify JSON output contract coverage for agent-safe parseable plans |
| CLI commands | 10 | Added rcc verify CLI backed by ImpactAnalysis recommendations |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Measurement and benchmarks | 5 | Fixed start focus signal selection so camelCase filenames like fileSystem.ts retain strong non-generic token matches. |

## Verification Patterns

- `npm run build` (83)
- `npm test` (43)
- `node --test tests/impact.test.js` (24)
- `node --test tests/cli.test.js` (17)
- `node --test tests/verify.test.js` (15)
- `node --test tests/work.test.js` (14)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)

<!-- repo-context-center:work-index:end -->
