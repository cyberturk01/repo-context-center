# ChangeLog

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
