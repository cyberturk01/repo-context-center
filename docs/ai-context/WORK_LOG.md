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
<!-- repo-context-center:work-log:end -->
