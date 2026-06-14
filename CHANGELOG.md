# ChangeLog

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
