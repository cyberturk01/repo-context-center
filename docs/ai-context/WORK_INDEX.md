# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Simplified verify output contract to recommendation-only fields
- Documented verify JSON contract stability layers and added normalized fixture snapshot tests for stable integration fields
- Refined verify mode behavior so working-tree plans keep changed-file review separate and planned plans keep context review secondary
- Improved verify checklist quality with deterministic domain-specific validation items for Redis, workflows, Postgres, and auth
- Stabilized verify output by replacing duplicated execution-plan command/path payloads with section refs and compacting domain check paths
- Improve rcc verify domain precision for workflow, GitHub integration, Postgres, and auth checks
- Add priority and execution ordering to rcc verify

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/impact.test.js` | 23 touches; refined impact confidence calculation | 2026-06-28 |
| `src/cli/impact/buildImpact.ts` | 22 touches; ranked impact affected files by confidence | 2026-06-28 |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/verify/buildVerify.ts` | 20 touches; Simplified verify output contract to recommendation-only fields | 2026-06-29 |
| `tests/verify.test.js` | 20 touches; Simplified verify output contract to recommendation-only fields | 2026-06-29 |
| `tests/work.test.js` | 20 touches; Add low-overhead routing for tiny obvious tasks | 2026-06-28 |
| `README.md` | 16 touches; Simplified verify output contract to recommendation-only fields | 2026-06-29 |
| `src/cli/index.ts` | 15 touches; Add planned verification mode for rcc verify | 2026-06-29 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/work/buildWorkBrief.ts` | 14 touches; Add low-overhead routing for tiny obvious tasks | 2026-06-28 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 35 | Add low-overhead routing for tiny obvious tasks |
| General maintenance | 33 | Simplified verify output contract to recommendation-only fields |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Repository context | 13 | Refined verify mode behavior so working-tree plans keep changed-file review separate and planned plans keep context review secondary |
| CLI commands | 13 | Stabilized verify output by replacing duplicated execution-plan command/path payloads with section refs and compacting domain check paths |
| Tests | 12 | Hardened verify JSON output contract coverage for agent-safe parseable plans |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Measurement and benchmarks | 5 | Fixed start focus signal selection so camelCase filenames like fileSystem.ts retain strong non-generic token matches. |

## Verification Patterns

- `npm run build` (91)
- `npm test` (45)
- `node --test tests/impact.test.js` (24)
- `node --test tests/cli.test.js` (22)
- `node --test tests/verify.test.js` (22)
- `node --test tests/outputContract.test.js` (14)
- `node --test tests/work.test.js` (14)
- `node --test tests/*.test.js` (13)

<!-- repo-context-center:work-index:end -->
