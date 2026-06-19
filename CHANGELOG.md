# ChangeLog

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
