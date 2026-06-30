# ChangeLog

## [0.13.0]

Recent development since v0.12.0 extends Verification Intelligence with Repository Metrics and stronger JSON contracts.

### Repository Metrics

- Added shared `RepositoryMetrics` models for compact task-level repository intelligence.
- Added a metrics collector that reuses existing Work, Measure, Impact, Verify, and freshness outputs instead of adding a second repository analysis engine.
- Added human and JSON renderers for metrics output.
- Added the new optional diagnostic `metrics` command:
  - `rcc metrics "<task>"`
  - `rcc metrics "<task>" --json`
- Added output contract guards to keep metrics JSON compact and summary-oriented, without leaking raw Work, Impact, or Verify arrays.

### Verification Intelligence

- Added a shared DomainEngine and routed Work, Impact, and Verify through shared task/domain context.
- Improved domain precision for workflow, GitHub integration, frontend, backend, database, Redis/cache, config, auth, and context verification hints.
- Stabilized `verify --json` as a long-lived integration contract.
- Kept Verify output recommendation-focused by omitting raw Impact collections and internal scoring details.
- Improved planned, task-only, and working-tree verification boundaries.
- Added priority-aware verification recommendations and normalized targeted tests, commands, smoke checks, manual checks, and validation checklist items.
- Added fixture-backed contract snapshots for planned verification scenarios.

### Measurement And Contracts

- Refactored Measure into reusable build/render modules while preserving the public `measure --json` shape.
- Metrics now reuses shared task contexts and existing Impact/Verify/Measure builders to avoid duplicate high-level analysis work.
- Added contract coverage for Impact, Measure, Metrics, Work, Handoff, and Verify JSON outputs.
- Reinforced compact output expectations for machine-readable agent and integration payloads.

## [0.12.0]

Repo Context Center v0.12.0 adds Verification Intelligence: a dedicated verification-planning layer built from existing Impact Analysis output.

### Verify Intelligence

- Added the new `verify` command.
- Added VerificationPlan output for targeted tests, targeted test commands, build commands, smoke checks, manual checks, validation checklist items, confidence, and notes.
- Reused Impact Analysis as the source of truth for affected files, affected tests, suggested commands, confidence, docs-only notes, and context-only signals.
- Added smoke-check and validation-checklist planning for stronger review handoffs.
- Added `verify --json` and `verify --task-only --json` for a stable machine-readable JSON contract.

## [0.11.1]

Repo Context Center v0.11.1 expands RCC from task routing into practical change-impact guidance, with stronger installation diagnostics and safer agent-instruction updates.

### Impact Analysis

- Added the `impact` command.
- Added affected files detection.
- Added confidence-scored affected test recommendations.
- Added suggested verification commands.
- Added `contextChanges` separation for RCC and agent-context files.
- Added task-only mode.
- Added summary output.
- Added confidence explanation.
- Added structured affected-test metadata:
  - `score`
  - `confidence`
  - `signals`
- Added `verificationHints` placeholder for future Verify Intelligence.

### Work Improvements

- Work and Impact now share the same affected-test scoring.
- Removed unrelated fallback test recommendations.
- Work now prefers no tests over weak recommendations.
- Improved agent guidance when no strong test relationship exists.

### Measure

- Improved excluded-file reporting.
- Clarified representative ignored, unsupported, and scan-cap paths.

### Doctor

- Improved local/global installation diagnostics.
- Reduced unnecessary upgrade recommendations.
- Better distinguished a healthy active CLI from older local installs.

### Init

- Added safer `AGENTS.md` update flow.
- Added `update-agent-file` support.
- Improved AI instruction file detection without modifying third-party instruction files.

### Validation

- Validated the release on a large real-world monorepo with approximately 4,300 eligible files.
- Covered `init`, `map`, `work`, `impact`, `measure`, `doctor`, and `validate`.

## [0.9.1]

- WORK_INDEX.md compact memory file
- archive-driven work memory compaction
- compact memory generation from completed work
- handoff integration with WORK_INDEX

### Improved

- reduced dependence on full WORK_LOG reads
- improved continuation memory quality
- better archive behavior for long-running repositories

### Internal

- shared work memory parser/renderer
- archive regeneration of WORK_INDEX
- handoff compact memory fallback logic

## [0.9.0]

RCC v0.9.0 summarizes the v0.9 series shift from startup context generation toward task continuation and agent handoff workflows. The release keeps `rcc work` as the task entrypoint while adding handoff-focused outputs and structured memory for continuing work across sessions.

### Added

- Added the new `rcc handoff` command.
- Added `rcc handoff --json` for machine-readable handoff output.
- Added `rcc handoff --agent` for compact agent handoff output.
- Added agent handoff workflow support.
- Added structured handoff memory support.
- Added task-aware handoff routing.
- Added optional handoff metadata:
  - `lastSummary`
  - `filesTouched`
  - `verification`
  - `followUps`
  - `risks`

### Improved

- Improved task intent cleanup.
- Reduced noisy lookup terms.
- Improved routing keyword selection.
- Improved relevant decision matching.
- Improved handoff task routing.
- Improved handoff memory quality.

### Internal

- Decoupled `work` command routing concerns.
- Added handoff command architecture.
- Kept command wrappers thin.
- Added structured handoff memory blocks.
- Added architecture guard tests.
- Improved test coverage.

## 0.8.3

### Added
Improved rcc work for cheaper AI agent handoff:
- compact default output
- task files before context docs
- agent rules separated from task files
- action/domain-aware routing
- targeted lookup promotion
- workflow-domain ranking improvements

## 0.7.0

### Added
- Added `rcc work` as the primary agent workflow entrypoint.
- Added `rcc done` for lightweight work logging in `docs/ai-context/WORK_LOG.md`.
- Added `rcc` as a CLI bin alias.
- Added fallback routing to promote RCC context files when no matching source files are found.

### Improved
- Updated AGENTS guidance to prefer `rcc work` before meaningful work and `rcc done` after meaningful work.
- Updated generated AGENTS guidance from command-first startup to agent workflow usage.
- Made `done` usage explicit with `--summary`, `--files`, and `--verify`.

### Fixed
- Avoided weak `none` output when RCC context files are available for fallback routing.

## repo-context-center@0.6.0

### Added

* Decision Memory commands: `decision add`, `decision list`, `decision search`.
* Targeted fallback search command: `find "<query>"`.
* Persistent manual work logging with `log`.
* Compact AGENTS.md startup guidance.
* Decision-aware startup recommendations.

### Improved

* Reduced noisy start output.
* Better docs-only routing for README, CHANGELOG, and documentation tasks.
* Better separation between generated context and manual persistent notes.
* More focused candidate suggestions and explainable reasons.

### Fixed

* Avoided duplicate startup guidance in AGENTS.md.
* Prevented documentation-only tasks from opening unrelated source or core files.
* Preserved manual content outside generated sections.

## repo-context-center@0.4.0

### Added

* Added `start --copy` to print the generated startup prompt and copy the same content to the system clipboard when a platform clipboard command is available.
* Added compact AGENTS startup guidance that tells agents to run `repo-context-center start "<task>"` when shell access is available, with fallback docs when it is not.
* Added README and agent usage guidance for the recommended daily workflow and agent startup flow.

### Improved

* Improved `start` output for edge cases where context guidance matches but no confident source or test files are found.
* Improved workflow-aware and generic test-task startup guidance with concise recommendation reasons.
* Kept clipboard failures non-fatal: `start --copy` still exits successfully and leaves the prompt printed above.

### Fixed

* Fixed generated AGENTS wording so map output and tests agree on the shell-unavailable fallback guidance.

## repo-context-center@0.3.3

### Added

* Added `map --check` documentation for detecting stale generated context in CI.
* Added README guidance for keeping context fresh as repositories grow.
* Added GitHub Actions usage docs for check-only stale-context detection.

### Notes

* The CI flow does not auto-commit by default; pull request authors should run `map --write` and commit refreshed `AGENTS.md` and `docs/ai-context/*` files.
* The mapper remains focused on lightweight AI agent navigation and token-saving context, not full dependency or import graph analysis.

## repo-context-center@0.3.1

### Improved

* Improved Repository Understanding quality for deterministic repo metadata, test classification, ignored areas, and config discovery.
* Improved generated `TASK_ROUTING.md` guidance with clearer first files to open for common task types.

## repo-context-center@0.3.0

### Added

* Added an internal deterministic `RepositoryUnderstanding` model.
* Added model-backed tracking for package manager, package scripts, entrypoints, key directories, modules, real test files, ignored areas, and config files.
* Added focused unit coverage for RepositoryUnderstanding with an AI Project Guardian-like file list.

### Improved

* Improved entrypoint detection from `package.json` metadata, package bin targets, and conventional CLI/app files.
* Added key directory roles for CLI, core, tests, docs, workflows, templates, config, generated output, and dependency folders.
* Improved `PROJECT_MAP.md` with model-backed purpose, entrypoints, key directories, package scripts, tests, and ignored areas.
* Improved `HOTSPOTS.md` prioritization for high-impact source, command, config, workflow, and package files.
* Improved `DEPENDENCY_MAP.md` with deterministic high-level hints without fake import graph claims.
* Reduced fixture and snapshot noise by separating real tests from fixture/snapshot context.

### Notes

* No framework detection was added.
* No import graph parsing was added.
* No AI or LLM calls were added.

## repo-context-center@0.2.2

### Fixed

* Improved map classification accuracy on real repositories.
* Config mapping now prefers config source files and `guardian.config.json`.
* GitHub workflow files are now classified under release workflow instead of config.
* Related tests now exclude fixtures and snapshots.
* Context docs now prefer `AGENTS.md`, `docs/ai-context/**`, and `.repo-context-center/config.json`.
* `Related tests` now renders `none detected` when no real tests are found.

### Improved

* Better task routing generation.
* Better module classification.
* Improved context document prioritization.
* Reduced fixture and snapshot noise in generated context.

### Tests

* Added AI Project Guardian-style regression coverage.
* 87 tests passing.
* Validated against a real repository (AI Project Guardian).

### Notes

This release focuses on improving map quality and generated context accuracy before introducing framework detection or import graph support.
