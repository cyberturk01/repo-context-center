# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Added RepositoryMetrics collector that summarizes existing Work, Impact, Verify, and Measure builder outputs without direct repository scan...
- Added shared RepositoryMetrics type model for future metrics collector outputs.
- Refactored measure report building into reusable build/render modules while preserving CLI JSON contract.
- Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of red...
- Extended TaskAnalysisResult into the internal TaskContext and projected it through Work, Impact, and Verify without changing public CLI con...
- Added shared DomainEngine and moved Verify domain detection to it while preserving verify output
- Freeze verify JSON public contract for v0.12.x

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `src/cli/verify/buildVerify.ts` | 27 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |
| `src/cli/impact/buildImpact.ts` | 24 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |
| `tests/verify.test.js` | 24 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |
| `tests/impact.test.js` | 23 touches; refined impact confidence calculation | 2026-06-28 |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 20 touches; Add low-overhead routing for tiny obvious tasks | 2026-06-28 |
| `README.md` | 17 touches; Freeze verify JSON public contract for v0.12.x | 2026-06-29 |
| `src/cli/work/buildWorkBrief.ts` | 16 touches; Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscoveri... | 2026-06-30 |
| `src/cli/index.ts` | 15 touches; Add planned verification mode for rcc verify | 2026-06-29 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 38 | Added RepositoryMetrics collector that summarizes existing Work, Impact, Verify, and Measure builder outputs without direct repository scanning. |
| General maintenance | 36 | Added shared DomainEngine and moved Verify domain detection to it while preserving verify output |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| Repository context | 16 | Added shared RepositoryMetrics type model for future metrics collector outputs. |
| CLI commands | 13 | Stabilized verify output by replacing duplicated execution-plan command/path payloads with section refs and compacting domain check paths |
| Tests | 12 | Hardened verify JSON output contract coverage for agent-safe parseable plans |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| Measurement and benchmarks | 6 | Refactored measure report building into reusable build/render modules while preserving CLI JSON contract. |

## Verification Patterns

- `npm run build` (97)
- `npm test` (49)
- `node --test tests/impact.test.js` (26)
- `node --test tests/verify.test.js` (25)
- `node --test tests/cli.test.js` (22)
- `node --test tests/outputContract.test.js` (17)
- `node --test tests/work.test.js` (15)
- `node --test tests/*.test.js` (13)

<!-- repo-context-center:work-index:end -->
