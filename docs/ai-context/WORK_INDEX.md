# Work Index

Compact memory derived from completed work. Designed for agents to read; not a raw chronological log.

<!-- repo-context-center:work-index:start -->

## Recent Focus

- Align workflow routing regression with strict affected-test evidence policy
- Tightened affected-test evidence exact policy so generic import/module/routing signals no longer recommend unrelated tests; added Budibase-...
- Make impact/work test output evidence-first and add CLI regression for auth middleware excluding Redis/queue tests
- Add evidence-based TaskAnalysis test eligibility
- Updated routing regression fixture caps to match TaskAnalysis-backed Work test candidates and verified full npm test.
- Cleaned work renderer so work routes render tests from TaskAnalysisResult.testCandidates and cannot leak Work-only routed tests.
- Implemented verify command as a renderer over TaskAnalysisResult with JSON and text reports.

## Hot Files

| File | Reason | Last touched |
| ---- | ------ | ------------ |
| `tests/handoff.test.js` | 22 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `tests/impact.test.js` | 21 touches; Tightened affected-test evidence exact policy so generic import/module/routing signals no longer recommend unrelated tests; added Budibase-shaped a... | 2026-06-28 |
| `src/cli/impact/buildImpact.ts` | 21 touches; Completed impact migration to TaskAnalysisResult renderer while preserving Impact JSON/output schema. | 2026-06-28 |
| `tests/work.test.js` | 19 touches; Cleaned work renderer so work routes render tests from TaskAnalysisResult.testCandidates and cannot leak Work-only routed tests. | 2026-06-28 |
| `src/cli/handoff/buildHandoffBrief.ts` | 15 touches; Deduplicate handoff Work index memory against Last completed | 2026-06-20 |
| `src/cli/commands/done.ts` | 14 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |
| `src/cli/work/buildWorkBrief.ts` | 13 touches; Cleaned work renderer so work routes render tests from TaskAnalysisResult.testCandidates and cannot leak Work-only routed tests. | 2026-06-28 |
| `README.md` | 13 touches; updated README for latest RCC workflow and impact changes | 2026-06-27 |
| `tests/init.test.js` | 13 touches; Added hard root AGENTS.md path guard for update-agent-file and identical CLAUDE content regression coverage | 2026-06-26 |
| `tests/done.test.js` | 13 touches; Added negative coverage for done handoff file path injection and verbose agent JSON boundaries | 2026-06-24 |

## Completed Work Themes

| Theme | Count | Recent summary |
| ----- | ----: | -------------- |
| Work routing | 34 | Align workflow routing regression with strict affected-test evidence policy |
| Handoff | 24 | Added negative coverage for done handoff file path injection and verbose agent JSON boundaries |
| General maintenance | 17 | Completed impact migration to TaskAnalysisResult renderer while preserving Impact JSON/output schema. |
| Tests | 11 | Add evidence-based TaskAnalysis test eligibility |
| Repository context | 10 | Added Impact contextChanges support and separated RCC/setup paths from affected files |
| Agent guidance | 9 | Softened rcc doctor stale local install guidance when active CLI and shell commands are healthy |
| CLI commands | 7 | Implemented verify command as a renderer over TaskAnalysisResult with JSON and text reports. |
| Measurement and benchmarks | 5 | Fixed start focus signal selection so camelCase filenames like fileSystem.ts retain strong non-generic token matches. |

## Verification Patterns

- `npm run build` (78)
- `npm test` (43)
- `node --test tests/impact.test.js` (21)
- `node --test tests/cli.test.js` (14)
- `node --test tests/*.test.js` (13)
- `node --test tests/handoff.test.js` (13)
- `node --test tests/work.test.js` (13)
- `npm run benchmark:routing` (11)

<!-- repo-context-center:work-index:end -->
