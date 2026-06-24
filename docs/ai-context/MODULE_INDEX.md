# Module Index

Reference stable repository ownership and responsibilities.

<!-- repo-context-center:generated:start -->
## Generated Repo Map

## CLI
- Purpose: Command parsing and user-facing output.
- Primary files: `src/cli/commands/archive.ts`, `src/cli/commands/decision.ts`, `src/cli/commands/doctor.ts`, `src/cli/commands/done.ts`.
- Common tasks: add flags, adjust help text, change stdout/stderr, set exit codes.
- Related tests: `tests/archive.test.js`, `tests/cli.test.js`, `tests/decision.test.js`, `tests/done.test.js`.
- Dependency hints: src/cli/commands/archive.ts, src/core/archiver.ts, src/core/config.ts.
- Risks: exit code regressions, help text drift, stdout/stderr compatibility.

## Configuration
- Purpose: Project configuration and setup rules.
- Primary files: `src/core/config.ts`, `guardian.config.json`, `package.json`, `src/cli/commands/validate.ts`.
- Common tasks: change defaults, validate config, install templates, update setup rules.
- Related tests: `tests/init.test.js`, `tests/validate.test.js`.
- Dependency hints: src/core/config.ts, src/core/templateInstaller.ts, src/core/validator.ts.
- Risks: default config drift, unsafe overwrite behavior.

## Analyzers / Risk Rules
- Purpose: Analysis, validation, risk scoring, and hotspot guidance.
- Primary files: `src/core/validator.ts`.
- Common tasks: change analyzers, adjust risk rows, score context quality, validate rules.
- Related tests: `tests/validate.test.js`.
- Dependency hints: src/core/validator.ts, tests/*.
- Risks: over-broad warnings, under-reported risky areas.

## Renderers / Reports
- Purpose: Generated CLI reports and markdown output.
- Primary files: `src/core/repoMapper.ts`, `src/cli/commands/archive.ts`, `src/cli/commands/estimate.ts`, `src/cli/commands/map.ts`.
- Common tasks: format markdown, format JSON, preserve generated markers, summarize report output.
- Related tests: `tests/archive.test.js`, `tests/estimate.test.js`, `tests/map.test.js`, `tests/suggest.test.js`.
- Dependency hints: src/core/archiver.ts, src/core/repoMapper.ts, tests/*.
- Risks: broken generated markers, unstable markdown ordering.

## Core / Orchestration
- Purpose: Core coordination and shared command behavior.
- Primary files: `src/core/archiver.ts`, `src/core/config.ts`, `src/core/contextFiles.ts`, `src/core/contextReader.ts`.
- Common tasks: coordinate commands, connect scanner and renderers, share common services.
- Related tests: none detected.
- Dependency hints: src/cli/commands/archive.ts, src/core/archiver.ts, tests/*.
- Risks: cross-command regression, shared behavior drift.

## Repository scanning
- Purpose: Repo inspection and lightweight analysis.
- Primary files: `src/cli/commands/scan.ts`, `src/core/scanner.ts`, `src/core/contextFiles.ts`, `src/core/fileSystem.ts`.
- Common tasks: classify files, ignore generated areas, detect symbols, match tests.
- Related tests: `tests/scan.test.js`.
- Dependency hints: src/core/contextFiles.ts, src/core/fileSystem.ts, tests/*.
- Risks: generated files included, real source files missed.

## Templates
- Purpose: Generated templates and starter context content.
- Primary files: `src/templates/generic/AGENTS.md`, `src/templates/generic/docs/ai-context/CHANGE_LOG.md`, `src/templates/generic/docs/ai-context/COMMUNICATION_MODE.md`, `src/templates/generic/docs/ai-context/DEPENDENCY_MAP.md`.
- Common tasks: update templates, change generated defaults, adjust starter docs.
- Related tests: none detected.
- Dependency hints: docs/ai-context/*, src/core/templateInstaller.ts, src/templates/*, templates/*.
- Risks: stale generated defaults, template/context mismatch.

## Tests / Fixtures
- Purpose: Test data, temp repos, and fixtures.
- Primary files: `tests/fixtures/learning-cases.json`, `tests/fixtures/routing-cases.json`.
- Common tasks: update temp repo setup, change fixtures, refresh expected docs.
- Related tests: none detected.
- Dependency hints: tests/*.
- Risks: fixture/snapshot drift.

## Staff/POS/public flows
- Purpose: Public, staff, owner, POS, and QR flows.
- Primary files: `src/core/renderRepositoryLearning.ts`, `src/core/repositoryLearning.ts`, `src/core/repositoryLearningRouting.ts`, `src/core/repositoryUnderstanding.ts`.
- Common tasks: public UI, staff workflow, POS.
- Related tests: `tests/renderRepositoryLearning.test.js`, `tests/repositoryLearning.test.js`, `tests/repositoryUnderstanding.test.js`.
- Dependency hints: none.
- Risks: review real callers before editing.

## Context docs
- Purpose: Agent routing, context maps, and workflow notes.
- Primary files: `AGENTS.md`, `docs/ai-context/TASK_ROUTING.md`, `docs/ai-context/MODULE_INDEX.md`, `docs/ai-context/PROJECT_MAP.md`, `.repo-context-center/config.json`.
- Common tasks: update routing, refresh maps, preserve manual notes.
- Related tests: `tests/map.test.js`, `tests/validate.test.js`.
- Dependency hints: docs/ai-context/*, src/core/repoMapper.ts, src/templates/generic/*.
- Risks: future agents misrouted, manual content overwritten.

## Release workflow
- Purpose: CI, deployment, and release configuration.
- Primary files: `.github/workflows/ai-project-guardian.yml`, `.github/workflows/ci.yml`, `scripts/release-check.js`.
- Common tasks: CI, deployment, release.
- Related tests: `tests/scripts/release-check.test.js`, `tests/v07-release.test.js`.
- Dependency hints: .github/workflows/*, package.json.
- Risks: CI blocked, release validation skipped.

_Generated by repo-context-center. Edit outside this section._
<!-- repo-context-center:generated:end -->
