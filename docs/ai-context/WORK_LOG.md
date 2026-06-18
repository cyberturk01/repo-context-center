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

## 2026-06-17T14:13:41.529Z
- Summary: Updated generated AGENTS context after reviewing last 10 git commits
- Changed files: `auto`
- Verification: rcc map --check; node --test tests/map.test.js

## 2026-06-17T14:15:18.507Z
- Summary: Updated README to reflect latest rcc work and find changes from recent git history
- Changed files: `auto`
- Verification: npm run build

## 2026-06-18T20:38:37.679Z
- Summary: Implemented targeted lookup promotion for rcc work
- Changed files: `auto`
- Verification: npm test; npm run build; node --test tests/work.test.js

## 2026-06-18T20:46:59.086Z
- Summary: Hardened repository file role classification and lookup role ordering
- Changed files: `auto`
- Verification: npm test; npm run build; node --test tests/repoFileClassifier.test.js tests/repositoryUnderstanding.test.js tests/work.test.js

## 2026-06-18T20:51:12.536Z
- Summary: Added cheap-path guidance to rcc work
- Changed files: `auto`
- Verification: npm test; npm run build; node --test tests/work.test.js tests/v07-release.test.js

## 2026-06-18T21:08:49.986Z
- Summary: Investigated role-related bug possibilities in work lookup and repo file classification without code changes
- Changed files: `auto`
- Verification: node --test tests/work.test.js tests/repoFileClassifier.test.js

## 2026-06-18T21:19:28.968Z
- Summary: Fixed rcc work narrow code-investigation task prioritization
- Changed files: `auto`
- Verification: node --test tests/work.test.js; npm test; npm run build

## 2026-06-18T21:30:54.873Z
- Summary: Polished rcc work guidance to keep focused task files first, demote stale map refresh, and filter weak supporting tests
- Changed files: `auto`
- Verification: node --test tests/work.test.js; npm test; npm run build
<!-- repo-context-center:work-log:end -->
