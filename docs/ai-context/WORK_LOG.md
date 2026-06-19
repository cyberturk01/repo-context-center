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
<!-- repo-context-center:work-log:end -->
