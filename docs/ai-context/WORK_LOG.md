# Work Log

Lightweight RCC memory from completed agent work.

<!-- repo-context-center:work-log:start -->

## 2026-06-19T06:36:52.512Z
- Summary: Filtered weak semantic source matches out of workflow task files when strong workflow/config/package candidates exist
- Changed files: `auto`
- Verification: node --test tests/work.test.js; npm test; npm run build

## 2026-06-19T11:46:09.809Z
- Summary: Improve RCC self-development guidance and work output routing
- Changed files: `AGENTS.md`, `src/cli/commands/work.ts`, `tests/work.test.js`
- Verification: npm run build; node dist/cli/index.js work "Workflow-domain tasklarda weak semantic source matches'i task files listesinden çıkar"; node --test tests/work.test.js; npm test

## 2026-06-19T12:34:01.519Z
- Summary: Made work JSON compact for agent startup while preserving debug JSON
- Changed files: `src/cli/commands/work.ts`, `tests/work.test.js`
- Verification: npm run build; node --test tests/work.test.js; npm test

## 2026-06-19T12:42:59.828Z
- Summary: Added guidance and benchmark to prevent repeated RCC work calls
- Changed files: `AGENTS.md`, `package.json`, `scripts/benchmark-work-repeat.js`, `src/cli/commands/work.ts`, `tests/work.test.js`
- Verification: npm run build; npm run benchmark:work-repeat; node --test tests/work.test.js; npm test

## 2026-06-19T12:54:41.164Z
- Summary: Compacted AGENTS RCC workflow guidance
- Changed files: `AGENTS.md`
- Verification: npm run build; node --test tests/work.test.js; npm test

## 2026-06-19T13:01:46.551Z
- Summary: Added dependency-free routing benchmark script and npm alias for representative rcc work tasks
- Changed files: `AGENTS.md`, `package.json`, `scripts/benchmark-routing.js`
- Verification: npm run build; npm run benchmark:routing; npm test

## 2026-06-19T13:13:24.289Z
- Summary: Added doctor command to warn when local RCC development repo is run with a mismatched external CLI
- Changed files: `AGENTS.md`, `package.json`, `scripts/benchmark-routing.js`, `src/cli/commands/doctor.ts`, `src/cli/index.ts`, `tests/cli.test.js`
- Verification: npm run build; node dist/cli/index.js doctor; npm test

## 2026-06-19T13:24:20.904Z
- Summary: Added measure command to compare naive scan token estimates with RCC work startup estimates
- Changed files: `AGENTS.md`, `package.json`, `scripts/benchmark-routing.js`, `src/cli/commands/doctor.ts`, `src/cli/commands/measure.ts`, `src/cli/commands/work.ts`, `src/cli/index.ts`, `src/core/tokenEstimator.ts`, `tests/cli.test.js`, `tests/estimate.test.js`
- Verification: npm run build; node dist/cli/index.js measure "fix workflow bug"; node dist/cli/index.js measure "fix workflow bug" --json; npm test

## 2026-06-19T13:31:10.968Z
- Summary: Fixed routing benchmark warn and fail cases
- Changed files: `scripts/benchmark-routing.js`, `src/cli/commands/work.ts`, `tests/work.test.js`
- Verification: npm run build; npm run benchmark:routing; npm test

## 2026-06-19T13:53:11.292Z
- Summary: Updated AGENTS.md workflow and local RCC development guidance
- Changed files: `AGENTS.md`
- Verification: reviewed AGENTS.md diff (docs-only change)

## 2026-06-19T14:01:13.131Z
- Summary: Stopped repo mapper from adding generated AGENTS.md repo-map stub and cleaned legacy init handling
- Changed files: `AGENTS.md`, `src/core/repoMapper.ts`, `src/core/templateInstaller.ts`, `src/templates/generic/AGENTS.md`, `tests/agent-startup-adoption.test.js`, `tests/init.test.js`, `tests/map.test.js`, `tests/templates.test.js`
- Verification: npm run build; node --test tests/init.test.js tests/map.test.js tests/templates.test.js tests/agent-startup-adoption.test.js; npm test

## 2026-06-19T14:05:38.788Z
- Summary: Aligned generic and repo AGENTS guidance around concise RCC workflow and current local development commands
- Changed files: `AGENTS.md`, `src/core/repoMapper.ts`, `src/core/templateInstaller.ts`, `src/templates/generic/AGENTS.md`, `tests/agent-startup-adoption.test.js`, `tests/init.test.js`, `tests/map.test.js`, `tests/templates.test.js`, `tests/v07-release.test.js`
- Verification: npm run build; node --test tests/templates.test.js tests/init.test.js tests/map.test.js tests/agent-startup-adoption.test.js tests/v07-release.test.js; npm test

## 2026-06-19T14:17:44.174Z
- Summary: Recalibrated AGENTS.md for command-first RCC workflow
- Changed files: `AGENTS.md`, `src/templates/generic/AGENTS.md`, `tests/agent-startup-adoption.test.js`, `tests/init.test.js`, `tests/map.test.js`, `tests/templates.test.js`
- Verification: npm run build; npm run benchmark:routing; npm run benchmark:work-repeat; npm test

## 2026-06-19T14:35:58.336Z
- Summary: Implemented primary/supporting rcc work file categorization
- Changed files: `src/cli/commands/work.ts`, `tests/v07-release.test.js`, `tests/work.test.js`
- Verification: npm run build; node dist/cli/index.js work "recalibrate AGENTS.md for current RCC architecture"; node dist/cli/index.js work "fix workflow risk detection"; node --test tests/work.test.js; npm test

## 2026-06-19T14:42:44.772Z
- Summary: Added compact agent JSON route output for rcc work
- Changed files: `src/cli/commands/work.ts`, `tests/v07-release.test.js`, `tests/work.test.js`
- Verification: npm run build; node dist/cli/index.js work "recalibrate AGENTS.md for current RCC architecture" --agent; node dist/cli/index.js work "fix workflow risk detection" --agent; node --test tests/work.test.js; npm test

## 2026-06-19T14:54:16.289Z
- Summary: Polished human rcc work output routing sections
- Changed files: `src/cli/commands/work.ts`, `tests/v07-release.test.js`, `tests/work.test.js`
- Verification: npm run build; node dist/cli/index.js work "recalibrate AGENTS.md for current RCC architecture"; node dist/cli/index.js work "fix workflow risk detection"; node --test tests/work.test.js; npm test

## 2026-06-19T15:07:58.229Z
- Summary: Implemented rcc measure MVP using work --agent route tokens and tightened naive scan exclusions
- Changed files: `auto`
- Verification: npm run build; node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture"; node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture" --json; npm test

## 2026-06-19T15:15:41.799Z
- Summary: Implemented v0.9 measurement workflow and single-use rcc work guidance
- Changed files: `auto`
- Verification: npm run build; node dist/cli/index.js work "recalibrate AGENTS.md for current RCC architecture" --agent; node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture"; node dist/cli/index.js measure "recalibrate AGENTS.md for current RCC architecture" --json; node --test tests...

## 2026-06-19T15:24:19.317Z
- Summary: updated README for v0.9 agent routing and measurement workflow
- Changed files: `README.md`
- Verification: npm test; node dist/cli/index.js measure "fix workflow risk detection"

## 2026-06-19T15:50:23.848Z
- Summary: Added baseline invalid-argument coverage for rcc work command before refactor
- Changed files: _not detected_
- Verification: node --test tests/work.test.js

## 2026-06-19T15:54:08.085Z
- Summary: Extracted RCC work command types and constants into dedicated modules
- Changed files: `src/cli/commands/work.ts`, `src/cli/work/workConstants.ts`, `src/cli/work/workTypes.ts`
- Verification: npm run build; node --test tests/work.test.js; npm test

## 2026-06-19T15:58:26.750Z
- Summary: Extracted RCC work command option parsing into workOptions module
- Changed files: `src/cli/commands/work.ts`, `src/cli/work/workConstants.ts`, `src/cli/work/workOptions.ts`, `src/cli/work/workTypes.ts`, `tests/work.test.js`
- Verification: npm run build; node --test tests/work.test.js; npm test

## 2026-06-19T16:02:00.275Z
- Summary: Extracted RCC work map freshness logic into mapFreshness module
- Changed files: `src/cli/commands/work.ts`, `src/cli/work/mapFreshness.ts`, `src/cli/work/workConstants.ts`, `src/cli/work/workOptions.ts`, `src/cli/work/workTypes.ts`, `tests/work.test.js`
- Verification: npm run build; node --test tests/work.test.js; npm test

## 2026-06-19T16:07:07.287Z
- Summary: Extracted RCC work memory and log readers into memorySignals module
- Changed files: `src/cli/commands/work.ts`, `src/cli/work/mapFreshness.ts`, `src/cli/work/memorySignals.ts`, `src/cli/work/workConstants.ts`, `src/cli/work/workOptions.ts`, `src/cli/work/workTypes.ts`, `tests/work.test.js`
- Verification: npm run build; node --test tests/work.test.js; npm test

## 2026-06-19T16:13:52.789Z
- Summary: Extracted targeted lookup scoring from work.ts into src/cli/work/targetedLookup.ts while preserving work routing behavior.
- Changed files: `src/cli/commands/work.ts`, `src/cli/work/targetedLookup.ts`
- Verification: npm run build; node --test tests/work.test.js

## 2026-06-19T16:17:29.896Z
- Summary: Extracted read-first guidance generation from work.ts into src/cli/work/readFirstGuidance.ts and added focused budget/rule-file tests.
- Changed files: `src/cli/commands/work.ts`, `src/cli/work/readFirstGuidance.ts`, `src/cli/work/targetedLookup.ts`, `tests/work.test.js`
- Verification: npm run build; node --test tests/work.test.js
<!-- repo-context-center:work-log:end -->
