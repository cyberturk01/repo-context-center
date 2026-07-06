# Project Map

- Runtime:
- Package manager:
- Build:
- Test:
- Entrypoints:
- Conventions:

<!-- repo-context-center:generated:start -->
## Generated Repo Map

### Main Purpose
Repo Context Center (RCC) is a repository intelligence layer for AI coding agents.

### Key Directories
- `src/cli` - CLI commands and command entrypoints
- `src/core` - orchestration and core business logic
- `docs` - documentation
- `templates` - templates/prompts/examples
- `examples` - examples and usage samples
- `tests` - test coverage, fixtures, and regression cases
- `scripts` - automation and maintenance scripts
- `.github/workflows` - CI and release automation
- `docs/ai-context` - generated agent context
- `.repo-context-center` - tool config

### Startup / Entrypoints
- `dist/cli/index.js`
- `src/cli/index.ts`

### Repository Understanding Quality
| Signal | Value |
| --- | --- |
| Repo understanding level | High |
| Entrypoints detected | 2 |
| Key directories detected | 10 |
| Modules detected | 4 |
| Dependency hints mode | Conservative |
| Generated/noise filtering | Active (5 ignored/noise areas separated) |

### Main Execution Flow
- CLI starts in `src/cli/index.ts`
- Commands delegate to `src/core/archiver.ts`, `src/core/config.ts`, `src/core/contextFiles.ts`, `src/core/contextReader.ts`
- Behavior is checked by `tests/agent-startup-adoption.test.js`, `tests/archive.test.js`, `tests/benchmark-scripts.test.js`, `tests/cli.test.js`

### Config
- `src/core/config.ts`
- `guardian.config.json`
- `package.json`
- `src/cli/commands/validate.ts`
- `src/core/validator.ts`

### Tests
- `tests/agent-startup-adoption.test.js`
- `tests/archive.test.js`
- `tests/benchmark-scripts.test.js`
- `tests/cli.test.js`
- `tests/commandArchitecture.test.js`
- `tests/decision.test.js`
- `tests/domainEngine.test.js`
- `tests/done.test.js`

### Generated / Ignored Areas
- `__snapshots__/`
- `.git/`
- `.next/`
- `.repo-context-center/config.json/`
- `build/`
- `coverage/`
- `dist/`
- `docs/ai-context/archive/`
- `docs/assets/`
- `fixtures/`
- `fixtures/github-integration/`
- `fixtures/github-integration/docs/ai-context/`
- `fixtures/github-integration/src/api/`
- `fixtures/github-integration/tests/api/`
- `fixtures/monorepo-large/`
- `fixtures/monorepo-large/docs/ai-context/`
- `fixtures/monorepo-large/packages/api/src/auth/`
- `fixtures/monorepo-large/packages/api/tests/auth/`
- `fixtures/monorepo-large/packages/web/src/profile/`
- `fixtures/monorepo-large/packages/web/tests/profile/`
- `fixtures/monorepo-large/packages/worker/tests/cache/`
- `fixtures/redis-cache/`
- `fixtures/redis-cache/docs/ai-context/`
- `fixtures/redis-cache/src/cache/`
- `fixtures/redis-cache/tests/api/`
- `fixtures/redis-cache/tests/cache/`
- `fixtures/simple-auth/`
- `fixtures/simple-auth/docs/ai-context/`
- `fixtures/simple-auth/src/auth/`
- `fixtures/simple-auth/tests/auth/`
- `fixtures/simple-auth/tests/cache/`
- `fixtures/translations/`
- `fixtures/translations/docs/ai-context/`
- `fixtures/translations/src/i18n/`
- `fixtures/translations/tests/api/`
- `fixtures/translations/tests/cache/`
- `fixtures/translations/tests/queue/`
- `fixtures/workflow-yaml/`
- `fixtures/workflow-yaml/.github/workflows/`
- `fixtures/workflow-yaml/docs/ai-context/`
- `node_modules/`
- `package-lock.json/`
- `repo-context-center-0.12.0.tgz/`
- `repo-context-center-0.13.0.tgz/`
- `repo-context-center-0.13.1.tgz/`
- `snapshots/`
- `target/`
- `tests/fixtures/`

### Production-Critical Flows
| Flow | Why critical | First check |
| --- | --- | --- |
| CLI: `src/cli/commands/archive.ts`, `src/cli/commands/decision.ts`, `src/cli/commands/doctor.ts` | CLI behavior changes can break scripts, help text, JSON output, or exit codes. | npm run build |
| Configuration: `guardian.config.json`, `package-lock.json`, `package.json` | Config mistakes can misroute agent work or break validation. | npm run build |
| Analyzers / Risk Rules: `src/core/task-analysis/scoreRelationships.ts`, `src/core/validator.ts` | Risk guidance affects what agents inspect before changes. | npm run build |
| Renderers / Reports: `src/cli/commands/archive.ts`, `src/cli/commands/estimate.ts`, `src/cli/commands/map.ts` | Report rendering changes can break generated markdown, JSON consumers, or marker preservation. | npm run build |
| Repository scanning: `src/cli/commands/scan.ts`, `src/core/contextFiles.ts`, `src/core/fileSystem.ts` | File classification changes can cause future agents to read too much or miss important files. | npm run build |
| Templates: `src/core/templateInstaller.ts`, `src/templates/generic/AGENTS.md`, `src/templates/generic/docs/ai-context/CHANGE_LOG.md` | Template changes can propagate stale or oversized context into new repos. | npm run build |
| Tests/fixtures: `fixtures/github-integration/AGENTS.md`, `fixtures/github-integration/docs/ai-context/TASK_ROUTING.md`, `fixtures/github-integration/expected.json` | Fixture changes can make tests pass while real map output gets worse. | npm run build |
| Context docs: `.project-brain/architecture.md`, `.project-brain/deployment-rules.md`, `.project-brain/known-bugs.md` | Context doc changes affect future agent routing and token use. | npm run build |
| Release/deploy workflow: `.github/workflows/ai-project-guardian.yml`, `.github/workflows/ci.yml`, `scripts/release-check.js` | Workflow changes can block releases or deploy broken builds. | npm run build |
| Fixture/snapshot drift: `fixtures/github-integration/AGENTS.md`, `fixtures/github-integration/docs/ai-context/TASK_ROUTING.md`, `fixtures/github-integration/expected.json` | Fixtures and expected output can drift from generated map behavior. | npm run build |

_Generated by repo-context-center. Edit outside this section._
<!-- repo-context-center:generated:end -->
