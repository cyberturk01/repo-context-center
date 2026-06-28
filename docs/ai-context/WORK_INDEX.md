# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- updated changelog for v0.11.1
- refined impact confidence calculation
- ranked impact affected files by confidence
- Fix RCC agent-file update mode for AGENTS and CLAUDE
- Align workflow routing regression with strict affected-test evidence policy
- Tightened affected-test evidence exact policy so generic import/module/routing signals no longer recommend unrelated tests; added Budibase-...
- Make impact/work test output evidence-first and add CLI regression for auth middleware excluding Redis/queue tests

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/impact.test.js` | 23 touches; refined impact confidence calculation | 2026-06-28 |
| `src/cli/impact/buildImpact.ts` | 22 touches; ranked impact affected files by confidence | 2026-06-28 |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/work.test.js` | 19 touches; Cleaned work renderer so work routes render tests from TaskAnalysisResult.testCandidates and cannot leak Work-only routed tests. | 2026-06-28 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/init.test.js` | 14 touches; Fix RCC agent-file update mode for AGENTS and CLAUDE | 2026-06-28 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `src/cli/work/buildWorkBrief.ts` | 13 touches; Cleaned work renderer so work routes render tests from TaskAnalysisResult.testCandidates and cannot leak Work-only routed tests. | 2026-06-28 |
| `README.md` | 13 touches; updated README for latest RCC workflow and impact changes | 2026-06-27 |
| `tests/done.test.js` | 13 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 34 | Align workflow routing regression with strict affected-test evidence policy |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| General maintenance | 21 | updated changelog for v0.11.1 |
| Tests | 11 | Add evidence-based TaskAnalysis test eligibility |
| Repository context | 10 | Added Impact contextChanges support and separated RCC/setup paths from affected files |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| CLI commands | 7 | Implemented verify command as a renderer over TaskAnalysisResult with JSON and text reports. |
| Measurement and benchmarks | 5 | Fixed start focus signal selection so camelCase filenames like fileSystem.ts retain strong non-generic token matches. |

## Verification Patterns

- `npm run build` (79)
- `npm test` (43)
- `node --test tests/impact.test.js` (23)
- `node --test tests/cli.test.js` (14)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/work.test.js` (13)
- `npm run benchmark:routing` (11)

<!-- repo-context-center:work-index:end -->
