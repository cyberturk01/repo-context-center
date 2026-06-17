# Work Log

Lightweight RCC memory from completed agent work.

<!-- repo-context-center:work-log:start -->

## 2026-06-17T10:50:08.532Z
- Summary: cleaned up AGENTS RCC workflow section
- Changed files: `AGENTS.md`, `src/templates/generic/AGENTS.md`, `tests/agent-startup-adoption.test.js`, `tests/init.test.js`, `tests/map.test.js`, `tests/templates.test.js`, `tests/v07-release.test.js`
- Verification: npm run test:cli; npm test

## 2026-06-17T11:05:11.861Z
- Summary: fixed duplicate AGENTS workflow cleanup
- Changed files: `src/core/templateInstaller.ts`, `tests/init.test.js`
- Verification: npm test

## 2026-06-17T11:30:52.451Z
- Summary: Added targeted lookup hints to rcc work
- Changed files: `auto`
- Verification: npm run test:cli; npm test

## 2026-06-17T12:02:37.879Z
- Summary: Add JSON output mode to rcc work
- Changed files: `auto`
- Verification: npm run build; node --test tests/work.test.js; npm run test:cli; npm test

## 2026-06-17T12:09:51.470Z
- Summary: Improve rcc work map freshness reporting
- Changed files: `auto`
- Verification: npm run build; node --test tests/work.test.js; npm run test:cli; npm test; tests/work.test.js covers touching a source file and observing freshness change

## 2026-06-17T12:21:03.888Z
- Summary: Improve rcc work targeted lookup hint ranking
- Changed files: `auto`
- Verification: npm run build; node --test tests/work.test.js; rcc work "Improve work command lookup hints"; node dist/cli/index.js work "Improve work command lookup hints"; npm test

## 2026-06-17T12:26:59.549Z
- Summary: Add read-first pruning and context budget guidance
- Changed files: `auto`
- Verification: npm run build; node --test tests/work.test.js; npm run test:cli; npm test

## 2026-06-17T12:55:48.755Z
- Summary: Improve rcc work recommended file ranking for task-specific matches
- Changed files: `src/cli/commands/work.ts`, `src/core/suggester.ts`, `tests/work.test.js`
- Verification: npm run build; npm test; npm run test:cli; manual node dist/cli/index.js work checks for package scripts, work command, and build configuration

## 2026-06-17T13:01:59.388Z
- Summary: Improve rcc work targeted lookup hint scoring and JSON signals
- Changed files: `auto`
- Verification: npm test; npm run test:cli; node dist/cli/index.js work improve package scripts; node dist/cli/index.js work improve work command lookup hints

## 2026-06-17T13:09:59.054Z
- Summary: Add lightweight rcc find fallback search for useful project files
- Changed files: `auto`
- Verification: npm run build; node --test tests/find.test.js; npm run test:cli; npm test; manual: node dist/cli/index.js find confidence/targeted lookup/package/work command

## 2026-06-17T13:23:29.364Z
- Summary: Calibrated work risk classification to keep routine package and dependency tasks medium while preserving high for auth, deployment, and workflow signals
- Changed files: `src/core/suggester.ts`, `tests/work.test.js`
- Verification: npm test; npm run test:cli; manual node dist/cli/index.js work validations for package, dependencies, authorization, deployment workflow

## 2026-06-17T13:31:11.341Z
- Summary: Implemented stable rcc work --json output from shared work brief model
- Changed files: `auto`
- Verification: npm run build; node --test tests/work.test.js; npm run test:cli; npm test; manual dist JSON parse and option-order validation
<!-- repo-context-center:work-log:end -->
