# Work Log

Lightweight RCC memory from completed agent work.

<!-- repo-context-center:work-log:start -->

## 2026-07-14T10:38:18Z
- added WORK_LOG token budget guardrail
- files: src/cli/commands/doctor.ts, src/cli/commands/done.ts, +4
- verify: npm run build; node --test tests/doctor.test.js tests/done.test.js; node --test tests/cli.test.js

## 2026-07-14T10:32:51Z
- added automatic work log compaction
- files: src/cli/commands/archive.ts, src/cli/commands/done.ts, +5
- verify: npm run build; node --test tests/archive.test.js tests/done.test.js

## 2026-07-14T10:25:00Z
- added configurable done log formats
- files: src/cli/commands/done.ts, src/cli/index.ts, +4
- verify: npm run build; node --test tests/done.test.js tests/init.test.js

## 2026-07-14T10:21:33Z
- separated done metadata into JSONL work events
- files: src/cli/commands/done.ts, src/cli/handoff/handoffConstants.ts, +6
- verify: npm run build; node --test tests/done.test.js tests/learn.test.js

## 2026-07-14T10:16:48Z
- implemented compact work log entries
- files: src/cli/commands/done.ts, src/core/workMemory.ts, +2
- verify: npm run build; node --test tests/done.test.js; node --test tests/handoff.test.js

## 2026-07-14T10:09:47.278Z
- added routing benchmark surface coverage cases
- files: scripts/benchmark-routing.js, src/cli/work/taskFileRecommendations.ts, +3
- verify: npm run build; npm run benchmark:routing; node --test tests/scripts/benchmark-routing.test.js tests/work.test.js

## 2026-07-14T10:01:55.831Z
- documented clean done file modes
- files: README.md, docs/ai-context/RCC_WORKFLOW.md, +3
- verify: npm run build; node --test tests/init.test.js

## 2026-07-14T09:59:11.710Z
- added memory-only done mode
- files: src/cli/commands/done.ts, src/cli/index.ts, +4
- verify: npm run build; node --test tests/done.test.js; node --test tests/cli.test.js tests/v07-release.test.js

## 2026-07-14T09:52:38.454Z
- added missing surface warnings to work output
- files: src/cli/work/buildWorkBrief.ts, src/cli/work/renderAgent.ts, +5
- verify: npm run build; node --test tests/work.test.js

## 2026-07-14T09:47:18.306Z
- added multi-surface work routing coverage
- files: src/core/taskIntent.ts, src/cli/work/taskFileRecommendations.ts, +1
- verify: npm run build; node --test tests/work.test.js; node --test tests/task-analysis.test.js

## 2026-07-06T20:36:44.911Z
- Added automatic WORK_LOG compaction and archived oversized live history
- files: README.md, src/cli/commands/done.ts, +14
- verify: npm run build; node --test tests/done.test.js tests/archive.test.js tests/commandArchitecture.test.js (36 passed); npm test (704 passed, 1 pre-existing impact routing failure)

## 2026-07-06T20:31:49.706Z
- Preserve existing repository learning during map --write and init --update
- files: src/cli/work/buildWorkBrief.ts, src/cli/work/renderJson.ts, +10
- verify: npm run build; node --test tests/map.test.js tests/init.test.js tests/renderRepositoryLearning.test.js tests/learn.test.js (98 passed); targeted repository learning tests (2 passed)

## 2026-07-06T20:26:52.001Z
- Added compound filename and bounded multi-signal routing plus layer-aware test recommendation calibration that prefers same workspace/layer tests, preserves exact and paired tests, supports mixed layers, and avoids backend test fallback for frontend tasks.
- files: src/cli/work/buildWorkBrief.ts, src/cli/work/renderJson.ts, +7
- verify: npm test (703 passed); npm run benchmark:routing (10 passed); npm run build

## 2026-07-06T20:21:15.762Z
- Added normalized compound filename matching and bounded cumulative filename-signal scoring while preserving specialized routing precedence
- files: src/cli/work/buildWorkBrief.ts, src/cli/work/targetedLookup.ts, +6
- verify: npm test; npm run benchmark:routing

## 2026-07-06T19:58:09.411Z
- Added layer-aware targeted lookup ranking with bounded frontend/backend affinity, explicit exclusion handling, workspace React source classification, debug score reasons, and reservation UI routing regressions
- files: src/cli/work/buildWorkBrief.ts, src/cli/work/targetedLookup.ts, +6
- verify: npm test; npm run benchmark:routing

## 2026-07-06T19:51:45.598Z
- Added additive frontend/backend intent, excluded application-layer scopes, named UI surface extraction, and focused intent tests
- files: src/core/taskIntent.ts, tests/taskIntent.test.js, +1
- verify: npm run build; node --test tests/taskIntent.test.js (22 passed); npm test (689 passed, 2 pre-existing reservation routing regressions still fail pending layer-aware ranking)

## 2026-07-06T19:46:30.764Z
- Added red regression coverage for frontend reservation routing across dashboard, API, and shared-types monorepo fixtures
- files: tests/work.test.js
- verify: npm run build passes; node --test tests/work.test.js tests/taskIntent.test.js: 134 pass, 2 expected new routing regressions fail

## 2026-06-30T23:04:50.648Z
- Hardened RC command docs, estimate JSON contract, and handoff verification spacing
- files: README.md, src/core/tokenEstimator.ts, +7
- verify: npm run build; npm test; node --test tests/outputContract.test.js; node --test tests/verify.test.js; node --test tests/estimate.test.js; node --test tests/handoff.test.js; node --test tests/init.test.js tests/validate.test.js; node dist/cli/index.js validate

## 2026-06-30T15:05:01.464Z
- Add v0.14.4 monorepo intelligence
- files: docs/ecosystems/monorepo.md, README.md, +14
- verify: npm run build; node --test tests/ecosystemDetector.test.js tests/work.test.js tests/impact.test.js tests/verify.test.js tests/metricsCollector.test.js tests/outputContract.test.js; npm test

## 2026-06-30T14:48:20.681Z
- Polish Go ecosystem adoption docs and regression coverage
- files: docs/ecosystems/go.md, examples/go-monorepo/README.md, +10
- verify: npm run build; node --test tests/ecosystemDetector.test.js tests/verify.test.js tests/outputContract.test.js; npm test

## 2026-06-30T14:43:38.949Z
- Polish Python ecosystem adoption docs and regressions
- files: docs/ecosystems/python.md, examples/fastapi/app/main.py, +15
- verify: npm run build; node --test tests/ecosystemDetector.test.js tests/verify.test.js tests/outputContract.test.js; npm test

## 2026-06-30T14:37:34.114Z
- Polish Java ecosystem adoption docs and verify regressions
- files: docs/ecosystems/java.md, examples/java-gradle/build.gradle.kts, +15
- verify: npm run build; node --test tests/ecosystemDetector.test.js tests/verify.test.js tests/outputContract.test.js; npm test

## 2026-06-30T14:24:11.738Z
- Add ecosystem-aware verify defaults and adoption docs
- files: docs/ecosystems/go.md, docs/ecosystems/java.md, +13
- verify: npm run build; node --test tests/ecosystemDetector.test.js tests/verify.test.js tests/metricsCollector.test.js tests/metricsRenderer.test.js tests/outputContract.test.js; npm test

## 2026-06-30T14:12:59.567Z
- Add compact ecosystem detection foundation
- files: src/analytics/metricsCollector.ts, src/analytics/metricsTypes.ts, +6
- verify: npm run build; node --test tests/ecosystemDetector.test.js tests/metricsCollector.test.js tests/metricsRenderer.test.js tests/outputContract.test.js tests/verify.test.js

## 2026-06-30T14:03:19.257Z
- Tighten auth middleware routing, context-only impact confidence, and verify domain reasons
- files: src/cli/verify/buildVerify.ts, src/cli/work/targetedLookup.ts, +5
- verify: npm run build; node --test tests/impact.test.js; node --test tests/verify.test.js; node --test tests/work.test.js; node --test tests/outputContract.test.js; node --test tests/metricsCollector.test.js tests/metricsRenderer.test.js

## 2026-06-30T13:49:51.607Z
- Polish verify build alignment and translation domain calibration
- files: src/cli/verify/buildVerify.ts, src/core/domainEngine.ts, +1
- verify: npm run build; node --test tests/verify.test.js; node --test tests/outputContract.test.js; node --test tests/metricsCollector.test.js tests/metricsRenderer.test.js

## 2026-06-30T13:18:18.123Z
- Renamed product-specific Risk Register category keys to generic messaging and frontend-api keys.
- files: src/core/repoMapper.ts, tests/map.test.js
- verify: npm run build; node --test tests/map.test.js

## 2026-06-30T12:37:20.924Z
- Tightened focused-risk evidence guards and exact-word product-domain matching to prevent Risk Register leakage.
- files: src/core/repoMapper.ts, tests/map.test.js
- verify: npm run build; node --test tests/riskRegister.test.js tests/learningQuality.test.js tests/domainEngine.test.js tests/outputContract.test.js; node --test tests/map.test.js

## 2026-06-30T12:36:10.460Z
- Tightened Risk Register focused-risk evidence guards to prevent product-domain leakage and added regression coverage.
- files: src/core/repoMapper.ts, tests/map.test.js
- verify: npm run build; node --test tests/riskRegister.test.js tests/learningQuality.test.js tests/domainEngine.test.js tests/outputContract.test.js; node --test tests/map.test.js

## 2026-06-30T10:19:51.509Z
- Updated README and CHANGELOG to document metrics reuse as optional diagnostic behavior without changing core workflow positioning.
- files: CHANGELOG.md, README.md
- verify: node --test tests/estimate.test.js tests/outputContract.test.js tests/cli.test.js

## 2026-06-30T10:16:17.448Z
- Added architecture guard preventing metrics collector from directly calling duplicate high-level Work, Measure, Impact, and Verify builders.
- files: src/analytics/metricsCollector.ts, tests/commandArchitecture.test.js, +1
- verify: npm run build; node --test tests/metricsCollector.test.js tests/commandArchitecture.test.js

## 2026-06-30T10:14:34.337Z
- Refactored metrics collector to reuse task contexts, route-derived measure reports, impact-from-context, and verify-from-impact helpers while preserving compact metrics output.
- files: src/analytics/metricsCollector.ts, tests/metricsCollector.test.js
- verify: npm run build; node --test tests/metricsCollector.test.js tests/metricsRenderer.test.js tests/cli.test.js tests/outputContract.test.js

## 2026-06-30T10:09:41.091Z
- Refactored Measure to build reports from an existing PublicAgentRoute while preserving normal measure behavior and JSON contract.
- files: src/cli/measure/buildMeasure.ts, tests/estimate.test.js, +1
- verify: npm run build; node --test tests/estimate.test.js tests/outputContract.test.js

## 2026-06-30T10:07:24.030Z
- Refactored Verify to build plans from an existing ImpactAnalysis and updated metrics to reuse Impact instead of recomputing it.
- files: src/analytics/metricsCollector.ts, src/cli/impact/buildImpact.ts, +5
- verify: npm run build; node --test tests/verify.test.js tests/outputContract.test.js; node --test tests/metricsCollector.test.js

## 2026-06-30T10:04:22.277Z
- Refactored Impact to build from existing TaskAnalysisResult while preserving JSON output and hidden context attachments.
- files: src/cli/impact/buildImpact.ts, tests/impact.test.js, +1
- verify: npm run build; node --test tests/impact.test.js tests/outputContract.test.js

## 2026-06-30T09:55:57.586Z
- Repositioned metrics as optional diagnostic insight instead of a core workflow step.
- files: README.md, CHANGELOG.md
- verify: node --test tests/estimate.test.js tests/outputContract.test.js tests/cli.test.js

## 2026-06-30T09:52:22.583Z
- Updated README and CHANGELOG for recent metrics and verify contract work.
- files: README.md, CHANGELOG.md
- verify: npm run build; node --test tests/cli.test.js tests/outputContract.test.js tests/estimate.test.js tests/metricsCollector.test.js tests/metricsRenderer.test.js tests/packageMetadata.test.js

## 2026-06-30T09:48:36.357Z
- Added output contract guards for metrics JSON and reinforced impact/measure JSON shapes.
- files: src/cli/commands/metrics.ts, src/cli/index.ts, +2
- verify: npm run build; node --test tests/outputContract.test.js tests/metricsRenderer.test.js tests/metricsCollector.test.js tests/cli.test.js tests/estimate.test.js tests/impact.test.js tests/verify.test.js

## 2026-06-30T09:45:22.322Z
- Added rcc metrics command as a thin wrapper over repository metrics collector and renderer.
- files: src/cli/commands/metrics.ts, src/cli/index.ts, +1
- verify: npm run build; node --test tests/cli.test.js tests/commandArchitecture.test.js tests/metricsCollector.test.js tests/metricsRenderer.test.js

## 2026-06-30T09:40:06.536Z
- Added RepositoryMetrics human and JSON renderers with focused renderer contract tests.
- files: src/analytics/renderMetrics.ts, tests/metricsRenderer.test.js
- verify: npm run build; node --test tests/metricsRenderer.test.js tests/metricsCollector.test.js

## 2026-06-30T09:36:53.736Z
- Added RepositoryMetrics collector that summarizes existing Work, Impact, Verify, and Measure builder outputs without direct repository scanning.
- files: src/analytics/metricsCollector.ts, tests/metricsCollector.test.js
- verify: npm run build; node --test tests/metricsCollector.test.js tests/estimate.test.js tests/impact.test.js tests/verify.test.js tests/work.test.js

## 2026-06-30T09:32:28.924Z
- Added shared RepositoryMetrics type model for future metrics collector outputs.
- files: src/analytics/metricsTypes.ts
- verify: npm run build

## 2026-06-30T09:28:29.678Z
- Refactored measure report building into reusable build/render modules while preserving CLI JSON contract.
- files: src/cli/commands/measure.ts, src/cli/measure/buildMeasure.ts, +4
- verify: npm run build; node --test tests/estimate.test.js tests/commandArchitecture.test.js tests/outputContract.test.js

## 2026-06-30T08:36:27.462Z
- Refactored Verify into a thin VerificationGenerator over ImpactAnalysis by consuming Impact-provided domain/context metadata instead of rediscovering domains
- files: src/cli/impact/buildImpact.ts, src/cli/impact/impactTypes.ts, +8
- verify: npm run build; node --test tests/verify.test.js; node --test tests/outputContract.test.js; node --test tests/impact.test.js; node dist/cli/index.js verify "fix login bug" --planned --json; node dist/cli/index.js verify "add redis cache" --planned --json; node dist/cli/index.js verify "update github...

## 2026-06-30T08:32:07.801Z
- Extended TaskAnalysisResult into the internal TaskContext and projected it through Work, Impact, and Verify without changing public CLI contracts
- files: src/cli/impact/buildImpact.ts, src/cli/impact/impactTypes.ts, +7
- verify: npm run build; node --test tests/work.test.js; node --test tests/impact.test.js; node --test tests/verify.test.js; node --test tests/outputContract.test.js

## 2026-06-30T08:27:26.853Z
- Added shared DomainEngine and moved Verify domain detection to it while preserving verify output
- files: src/cli/verify/buildVerify.ts, src/core/domainEngine.ts, +1
- verify: npm run build; node --test tests/domainEngine.test.js; node --test tests/verify.test.js; node --test tests/outputContract.test.js

## 2026-06-29T21:44:59.947Z
- Freeze verify JSON public contract for v0.12.x
- files: fixtures/github-integration/AGENTS.md, fixtures/github-integration/docs/ai-context/TASK_ROUTING.md, +11
- verify: npm test

## 2026-06-29T21:39:07.016Z
- Calibrate rcc verify domain detection for workflow GitHub frontend backend and database suggestions
- files: src/cli/verify/buildVerify.ts, tests/verify.test.js
- verify: npm test

## 2026-06-29T21:35:03.012Z
- Finalize verify planned vs working-tree context boundaries
- files: src/cli/verify/buildVerify.ts, tests/verify.test.js
- verify: npm test

## 2026-06-29T14:54:22.664Z
- Stabilized verify output by removing generic affected-file manual checks, compacting targeted test and confidence reasons, and gating context-routing checks on actual context changes.
- files: src/cli/verify/buildVerify.ts, tests/fixtures/verify-json-contract-snapshots.json, +2
- verify: npm test

## 2026-07-14T10:48:18Z
- improved done memory churn ergonomics
- files: src/cli/commands/done.ts, src/templates/generic/docs/ai-context/RCC_WORKFLOW.md, +3
- verify: npm run build; node --test tests/done.test.js tests/init.test.js; node --test tests/templates.test.js

## 2026-07-14T11:02:57Z
- fixed stale release test expectations
- files: tests/learningQuality.test.js, tests/v07-release.test.js
- verify: npm test

## 2026-07-14T11:29:54Z
- aligned guardian required checks with CI gate
- files: guardian.config.json
- verify: node -e JSON.parse(require('fs').readFileSync('guardian.config.json','utf8')); node --test tests/archive.test.js
<!-- repo-context-center:work-log:end -->
