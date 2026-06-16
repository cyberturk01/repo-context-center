# repo-context-center

![npm](https://img.shields.io/npm/dm/repo-context-center)
![npm](https://img.shields.io/npm/v/repo-context-center)

`repo-context-center` is a local-first ContextOps layer for AI coding agents.

It gives agents a compact way to understand a repository before they read broadly: task routing, startup context, decision memory, lightweight project memory, token reduction, and agent guidance. It is not an AI coding agent, code generator, code reviewer, or security scanner.

It works with Codex, Claude Code, Cursor, Copilot-style agents, and other coding assistants that read repository instructions or Markdown docs.

## Local-First

- No API keys.
- No AI service.
- No model costs.
- No background process.
- Works entirely on local repository metadata and Markdown files.

Repo Context Center installs and maintains small context files inside your repository, centered around `AGENTS.md` and `docs/ai-context/*`.

![Repo Context Center workflow](https://raw.githubusercontent.com/cyberturk01/repo-context-center/c39f583/docs/assets/repo-context-center-diagram.svg)

## Quick Start

Humans only need to initialize the repository:

```sh
npx repo-context-center init
```

That installs `AGENTS.md`, `docs/ai-context/*`, and `.repo-context-center/config.json`.

Preview installation without writing files:

```sh
npx repo-context-center init --dry-run
```

Overwrite existing context templates:

```sh
npx repo-context-center init --force
```

## Agent Workflow

The primary v0.7 workflow is intentionally small:

```sh
rcc work
rcc work "fix login bug"
```

`rcc work` prints a concise agent-focused work brief:

- task intent;
- recommended files to inspect first;
- relevant tests or test folders;
- recent decisions and memory;
- known risks;
- the suggested next command after work.

After meaningful completed work, the agent records lightweight work memory:

```sh
rcc done
```

If a durable project decision was made, record that separately with the `decision` command described in Advanced Commands.

Agents should treat RCC output as navigation guidance, not proof. Source code remains the source of truth, and agents should verify source before editing.

If shell access is unavailable, agents should read the fallback context docs listed in `AGENTS.md`, especially `COMMUNICATION_MODE.md`, `TASK_ROUTING.md`, `TOKEN_BUDGET.md`, and `DO_NOT_READ.md`.

`start` and `log` still exist for backward compatibility and lower-level workflows. New agent flows should prefer `work` and `done`.

## Why It Matters

AI coding agents often spend context rediscovering the same repository facts:

- Which files matter for this task?
- Which generated, vendored, build, or coverage paths should be skipped?
- Where are the risky shared modules?
- Which tests are likely related?
- What did a previous session already learn?
- Which project decisions should not be rediscovered?

That repeated discovery costs tokens, time, and attention. RCC gives agents a durable place to start, so each session can begin from compact repository context instead of rebuilding it from scratch.

## Token Estimate Proof

Verified estimates on this repository:

| Scenario | Estimate |
| --- | ---: |
| Naive scan | 97,917 tokens |
| Compact startup | 546 tokens |
| Estimated reduction | 99.4% |

Validated against larger public repositories with different structures:

| Repository | Files scanned | Naive scan estimate | Compact startup context | Estimated reduction |
| --- | ---: | ---: | ---: | ---: |
| FastAPI | 500 | ~936K tokens | ~862 tokens | ~99.9% |
| LangChain | 500 | ~1.18M tokens | ~4.4K tokens | ~99.6% |

Estimate whether RCC is reducing broad repo reads:

```sh
npx repo-context-center estimate --compare-naive
```

Example output excerpt from LangChain:

```text
Naive comparison:
- Estimated naive scan: 1,189,515 tokens
- Estimated compact startup: 4,752 tokens
- Estimated saving: 1,184,763 tokens
- Estimated saving: 99.6%
```

Estimates use `ceil(characters / 4)` and are intended for relative comparison only. Actual tokenizer costs vary by model. RCC aims to reduce broad rediscovery, not guarantee savings.

## Advanced Commands

Most humans should start with only:

```sh
npx repo-context-center init
```

The commands below are useful for power users, CI, debugging, and integrations.

### Refresh Repository Maps

`map --write` analyzes real files with deterministic heuristics and updates generated sections in `AGENTS.md` and `docs/ai-context/*`.

```sh
npx repo-context-center map --write --max-files 300
```

Example output:

```text
repo-context-center map

Files scanned: 500
Mode: write

Updated files:
- AGENTS.md (updated)
- docs/ai-context/TASK_ROUTING.md (updated)
- docs/ai-context/PROJECT_MAP.md (updated)
- docs/ai-context/HOTSPOTS.md (updated)

Detected:
- Task routing rows: 3
- Modules: 7
- Risks: 5
- Dependencies: 4
- Symbols: 6
- Hotspots: 7
```

Preview proposed generated context changes:

```sh
npx repo-context-center map --dry-run --max-files 300
```

Check whether generated context is stale:

```sh
npx repo-context-center map --check --max-files 300
```

Recommended `--max-files` values:

- Small and medium repos: `150`-`300`.
- Larger repos and monorepos: `500` or more, tuned to keep CI runtime acceptable.

### Find Focused Fallback Files

Use `find` when `rcc work` gives useful direction but the agent still needs a focused fallback before broad search:

```sh
npx repo-context-center find "decision command"
```

`find "<query>"` returns focused file candidates with short deterministic reasons.

### Estimate Token Savings

Use `estimate` when evaluating whether the context layer is pulling its weight:

```sh
npx repo-context-center estimate --compare-naive
npx repo-context-center estimate --task "fix login bug"
npx repo-context-center estimate --json
```

### Integrations And JSON

Use `suggest --json` when integrating RCC recommendations into another tool:

```sh
npx repo-context-center suggest "fix auth login bug" --json
```

Use `scan --json` to inspect only repository layout and lightweight context suggestions:

```sh
npx repo-context-center scan --json
```

### Validation, Archiving, And Decisions

Validate installed context files:

```sh
npx repo-context-center validate
npx repo-context-center validate --strict
```

Archive older long-running notes:

```sh
npx repo-context-center archive --keep 50
```

Preserve durable project decisions:

```sh
npx repo-context-center decision add "Keep AGENTS.md compact" --reason "Reduce startup token overhead" --files AGENTS.md
npx repo-context-center decision list
npx repo-context-center decision search "agents"
```

### Legacy Lower-Level Commands

`start` and `log` remain available for backward compatibility:

```sh
npx repo-context-center start "fix auth bug"
npx repo-context-center log "Fixed auth routing" --files src/auth.ts,tests/auth.test.ts
```

Prefer `rcc work` and `rcc done` for new agent workflows.

## Command Reference

```sh
repo-context-center --help
repo-context-center init [--dry-run] [--force] [--github-action]
repo-context-center work ["<task>"] [--max-files <number>]
repo-context-center done
repo-context-center map [--write] [--check] [--dry-run] [--json] [--max-files <number>]
repo-context-center validate [--strict]
repo-context-center archive [--keep <number>] [--dry-run]
repo-context-center estimate [--mode compact|investigation|detailed] [--task "<task>"] [--compare-naive] [--json] [--max-files <number>]
repo-context-center find "<query>" [--limit <number>]
repo-context-center decision add "<decision>" --reason "<reason>" [--status <status>] [--files <path,path>]
repo-context-center decision list
repo-context-center decision search "<query>"
repo-context-center suggest "<task>" [--json] [--symbols] [--max-files <number>]
repo-context-center scan [--json]
repo-context-center start "<task>" [--max-files <number>] [--copy]
repo-context-center log "<summary>" [--files <path,path>] [--dry-run]
```

| Command | Purpose | When to use |
| --- | --- | --- |
| `init` | install context templates | once per repo |
| `work` | print an agent work brief | before agent work |
| `done` | save completed-work memory | after meaningful agent work |
| `map --write` | refresh generated repo maps | after structure changes |
| `map --check` | detect stale generated maps | CI / PRs |
| `validate` | check required context files | setup and CI |
| `archive` | keep long-running notes compact | periodic maintenance |
| `estimate` | estimate context/token savings | evaluation and debugging |
| `find` | locate focused candidate files | fallback before broad search |
| `decision` | record durable project decisions | architecture/workflow decisions |
| `suggest` | get recommendations or JSON | tooling and integrations |
| `scan` | inspect repo layout | diagnostics |
| `start` | legacy startup prompt | backward-compatible workflows |
| `log` | legacy change log entry | backward-compatible workflows |

## CI / Keeping Context Fresh

RCC does not run in the background. Generated context changes only when commands such as `map --write` are run.

Refresh generated context after significant structure changes, such as:

- new source roots;
- renamed modules;
- new CLI entrypoints;
- changed test layout;
- updated build or config files;
- new generated-output locations;
- changed package scripts.

Use `map --check` in CI to fail pull requests when generated context files are stale:

```yaml
name: Repository Context Check

on:
  pull_request:

jobs:
  context-check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Check generated context is fresh
        run: npx repo-context-center map --check --max-files 300
```

If CI fails, refresh generated sections locally:

```sh
npx repo-context-center map --write --max-files 300
```

Then commit the updated `AGENTS.md` and `docs/ai-context/*` files.

Install the default PR validation workflow:

```sh
npx repo-context-center init --github-action
```

## Installed Files

`repo-context-center init` installs generic templates:

- `AGENTS.md`
- `docs/ai-context/COMMUNICATION_MODE.md`
- `docs/ai-context/TASK_ROUTING.md`
- `docs/ai-context/MODULE_INDEX.md`
- `docs/ai-context/PROJECT_MAP.md`
- `docs/ai-context/RISK_REGISTER.md`
- `docs/ai-context/DEPENDENCY_MAP.md`
- `docs/ai-context/SYMBOL_MAP.md`
- `docs/ai-context/TOKEN_BUDGET.md`
- `docs/ai-context/DO_NOT_READ.md`
- `docs/ai-context/HOTSPOTS.md`
- `docs/ai-context/LESSONS_LEARNED.md`
- `docs/ai-context/CHANGE_LOG.md`
- `docs/ai-context/archive/`

It also creates `.repo-context-center/config.json`.

`repo-context-center map --write` may update generated sections in:

- `AGENTS.md`
- `docs/ai-context/TASK_ROUTING.md`
- `docs/ai-context/MODULE_INDEX.md`
- `docs/ai-context/PROJECT_MAP.md`
- `docs/ai-context/RISK_REGISTER.md`
- `docs/ai-context/DEPENDENCY_MAP.md`
- `docs/ai-context/SYMBOL_MAP.md`
- `docs/ai-context/HOTSPOTS.md`
- `docs/ai-context/TOKEN_BUDGET.md`
- `docs/ai-context/DO_NOT_READ.md`
- `docs/ai-context/CHANGE_LOG.md`

With `--github-action`, init also creates:

- `.github/workflows/repo-context-check.yml`

## Roadmap

| Capability | Status |
| --- | --- |
| Generic context installation | Available |
| Agent work brief | Available |
| Repository understanding | Available |
| Task routing | Available |
| Explainable recommendation reasons | Available |
| Targeted fallback search | Available |
| Token estimation | Available |
| Stale context detection | Available |
| CI freshness check | Available |
| Durable work logs and decision memory | Available |
| Context archiving | Available |
| Richer import graph | Planned |
| Better framework detection | Planned |
| Safer merge/update UX | Planned |
| Project-specific packs | Planned |
| Context analytics | Planned |
| Agent handover improvements | Planned |

## Development

```sh
npm install
npm run build
npm test
```

## Manual Release

This package is prepared for manual npm publishing.

```sh
npm run build
npm test
npm pack
```

The package publishes the compiled `dist/` output, including the generic context templates copied during build. `prepublishOnly` runs build and tests before a manual `npm publish`.
