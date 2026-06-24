# repo-context-center

![npm](https://img.shields.io/npm/dm/repo-context-center)
![npm](https://img.shields.io/npm/v/repo-context-center)

Repo Context Center (RCC) is a lightweight context-routing layer for AI coding agents.

Instead of broadly scanning repositories, RCC identifies the most relevant files, tests, and supporting context for a task and provides a compact agent route. RCC can also estimate the difference between a naive repository scan and the RCC route.

RCC works with Codex, Claude Code, Cursor, Copilot-style agents, and other coding assistants that can read repository instructions or call local CLI tools. It is not an AI coding agent, code generator, code reviewer, or security scanner.

## Local-First

- No API keys.
- No AI service.
- No model costs.
- No background process.
- Works entirely on local repository metadata and Markdown files.

Core capabilities:

- Repository Understanding
- Task Routing
- Startup Context
- Decision Memory
- Work Tracking
- Repository Learning
- Agent Handover

![Repo Context Center workflow](https://raw.githubusercontent.com/cyberturk01/repo-context-center/main/docs/assets/repo-context-center-diagram.svg)

## Quick Start

Initialize RCC and generate the repository map:

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
```

Then ask RCC for the smallest useful route for an agent task:

```sh
npx repo-context-center@latest work "fix workflow risk detection" --agent
```

Example output:

```json
{
  "task": "fix workflow risk detection",
  "primaryFiles": [
    ".github/workflows/ai-project-guardian.yml",
    ".github/workflows/ci.yml",
    "package.json"
  ],
  "supportingFiles": [],
  "tests": [
    "tests/decision.test.js"
  ],
  "readFirst": [
    "AGENTS.md"
  ],
  "next": "Start with primaryFiles. Do not rerun work for this task. Use rcc find \"workflow\" only if needed.",
  "briefTokens": 87
}
```

- `primaryFiles` are the files to inspect first.
- `tests` are the most likely checks to validate changes.
- `supportingFiles` are optional follow-up files when the route is not enough.
- `readFirst` contains repository rules the agent should read before editing.

Preview installation without writing files:

```sh
npx repo-context-center init --dry-run
```

Overwrite existing context templates:

```sh
npx repo-context-center init --force
```

Refresh older RCC agent instructions while preserving manual AGENTS.md sections:

```sh
npx repo-context-center@latest init --update
```

## Use the Latest Version

Recommended first-run commands:

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
npx repo-context-center@latest work "fix workflow risk detection" --agent
```

`npx repo-context-center@latest` runs the latest published version. After global or local installation, use either `rcc` or `repo-context-center`.

If an existing repository has an older local RCC install, `npx repo-context-center ...` may run that local binary instead of the latest published package. Use `npx repo-context-center@latest init --update` or upgrade the local dependency before refreshing `AGENTS.md`.

For release validation, check:

```sh
npm run release:check
```

## Complete Usage Guide

Recommended workflow:

```text
init -> map --write -> work -> edit/verify -> done -> handoff
```

| Step | Command | When to run it | What it produces | Who uses the output |
| --- | --- | --- | --- | --- |
| `init` | `npx repo-context-center@latest init` | Once per repository, or when installing missing RCC context files | `AGENTS.md`, `docs/ai-context/*`, and `.repo-context-center/config.json` | Humans and agents |
| `init --update` | `npx repo-context-center@latest init --update` | When an existing repo has older RCC-generated `AGENTS.md` guidance | Refreshed RCC agent workflow while preserving manual AGENTS.md content | Humans and agents |
| `map --write` | `npx repo-context-center@latest map --write` | After init and after meaningful repo structure changes | Refreshed generated sections in context files | Agents, reviewers, and CI |
| `work` | `rcc work "implement feature" --agent` | Once at task start | Compact route with primary files, tests, supporting files, and read-first rules | The active coding agent |
| `edit/verify` | Use your editor and project checks, such as `npm test` | During implementation | Source changes and verification evidence | Humans, agents, and reviewers |
| `done` | `rcc done --summary "implemented feature" --files auto --verify "npm test"` | After meaningful completed work | Lightweight work memory in `docs/ai-context/WORK_LOG.md` and learned repository patterns in `docs/ai-context/REPOSITORY_LEARNING.md` | Future agents and humans |
| `learn` | `rcc learn --write` | When repository learning should be regenerated on demand | Refreshed learned focus areas, file relationships, verification patterns, and repository habits | Agents, humans, and routing commands |
| `handoff` | `rcc handoff` or `rcc handoff --agent` | When work continues in another session or agent | Continuation brief from recent work, decisions, and task-aware files | The next agent or human |

Agent guidance:

- Run `rcc work "<task>" --agent` once at task start.
- Inspect `primaryFiles`, `tests`, and `supportingFiles` before broader search.
- Do not repeatedly rerun the same task route.
- Use `rcc find "<keyword>"` only if the route is insufficient.
- Use `rcc done` after meaningful work.
- Use `rcc learn --write` when learned repository patterns need to be regenerated manually.
- Use `rcc handoff` when another session or agent needs to continue.
- When developing RCC itself, run `node dist/cli/index.js <command>` after `npm run build` so an older global `rcc` does not shadow the repo build. If `rcc doctor` or `rcc work "<task>" --agent` is unknown, update or relink the global install.

Agents should treat RCC output as navigation guidance, not proof. Source code remains the source of truth, and agents should verify source before editing.

## Manual vs Automatic

RCC does not run in the background, automatically edit source code, or automatically verify correctness. It gives deterministic context, routes, and memory so humans and agents can work with less discovery overhead.

| Area | Manual action | Automatic RCC behavior |
| --- | --- | --- |
| `init` | Run the command when adopting RCC or adding the default CI workflow | Creates missing RCC templates and config; preserves existing manual content |
| `map --write` | Run after structural changes | Refreshes generated sections in `docs/ai-context/*` and warns if `AGENTS.md` needs `init --update` |
| `work` | Run once at task start and follow the route | Reads context and repo metadata to produce a compact task route |
| `find` | Run only when the route is insufficient | Returns focused fallback file candidates with reasons |
| `done` | Record summary, changed files, and verification after meaningful work | Appends lightweight work memory for future handoff and routing |
| `learn` | Regenerate learned repository patterns on demand | Reads work memory, work index, and decisions to refresh `REPOSITORY_LEARNING.md` |
| `handoff` | Run when another session or agent needs to continue | Builds a continuation brief from recent work, decisions, and task route signals |
| `decision add` | Record durable project decisions intentionally | Stores decision memory in `docs/ai-context/DECISIONS.md` |
| `map --check` | Run locally or in CI to detect stale context | Exits non-zero when generated context needs refresh |
| CI workflow | Install with `init --github-action` and commit it | Runs RCC freshness checks during pull requests |
| Generated context files | Commit refreshed generated sections when useful | Rebuilds generated sections between RCC markers |
| Manual notes / decisions | Keep project knowledge in manual sections or decision memory | Preserves manual sections while generated sections can be refreshed |

## What RCC Does Not Do

RCC is not an AI coding agent, code generator, security scanner, replacement for tests or review, or background service.

## Agent Handover

Agents often restart without knowing what was completed, which files were touched, which decisions were made, or what should happen next. RCC can generate a continuation brief from repository memory.

Print a human-readable handoff brief:

```sh
rcc handoff
```

Print machine-readable handoff JSON:

```sh
rcc handoff --json
```

Route the handoff around a specific continuation task:

```sh
rcc handoff "continue workflow validation"
```

Print a compact agent handoff payload:

```sh
rcc handoff --agent
```

The handoff brief can include recent work summaries, touched files, verification notes, follow-ups, risks, relevant decisions, and task-aware next files.

## When to Use Handoff

Use `rcc handoff` for:

- long-running tasks
- switching between Codex sessions
- switching between AI agents
- resuming work the next day

## Token Saving Expectations

RCC is designed to reduce initial repository discovery context. In measured examples, RCC can reduce startup discovery context by roughly 70-99%, depending on repository size and task specificity. Full-task savings are usually lower because the agent still needs to read source files, make changes, and verify behavior.

Measured examples can show large reductions, sometimes from hundreds of thousands of estimated naive-scan tokens to compact routes under a few hundred tokens. Actual savings depend on repository size, task wording, and whether the agent follows the route.

## Measurement

Measure the difference between a naive repository scan and the RCC route for a task:

```sh
rcc measure "fix workflow risk detection"
```

Example output:

```text
RCC measurement

Task:
fix workflow risk detection

Naive scan estimate:
195,623 tokens

RCC agent route:
87 tokens

Primary files:
3

Supporting files:
0

Tests:
1

Estimated saving:
195,536 tokens (99.9%)
```

The naive scan estimate is an approximation. Savings are estimates, not guarantees.

JSON output is available for integrations:

```sh
rcc measure "fix workflow risk detection" --json
```

## Why RCC

Without RCC, an agent often scans many files before finding the relevant code, tests, workflows, configuration, and repository rules.

With RCC, the agent starts with:

- `primaryFiles`
- `tests`
- `supportingFiles`
- `readFirst`

and avoids broad repository exploration until necessary.

That saves context, time, and attention while still leaving the agent in control of source verification.

## Supporting Commands

The primary workflow is:

```text
init -> map --write -> work -> edit/verify -> done -> handoff
```

The commands below support that workflow.

### Refresh Repository Maps

`map --write` analyzes real files with deterministic heuristics and updates generated sections in `docs/ai-context/*`. If `AGENTS.md` appears to contain older RCC guidance, it prints a warning instead of rewriting it automatically; run `npx repo-context-center@latest init --update` to refresh agent instructions safely.

```sh
npx repo-context-center map --write --max-files 300
```

Example output:

```text
repo-context-center map

Files scanned: 500
Mode: write

Updated files:
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

`find "<query>"` returns focused file candidates with short deterministic reasons. It prefers task-routing, filename, path, paired-test, and lightweight content signals while filtering noisy generated, fixture, snapshot, archive, and internal context paths.

### Validate Installation

Validate installed context files:

```sh
npx repo-context-center validate
npx repo-context-center validate --strict
```

### Record Completed Work

Use `done` after meaningful agent work:

```sh
npx repo-context-center done --summary "fixed auth routing" --files auto --verify "npm test"
```

`done` also refreshes repository learning so future `work` and `handoff` output can include learned file relationships, likely tests, verification patterns, and repository habits.

### Regenerate Repository Learning

Use `learn` when you want to inspect or refresh learned repository patterns without recording new completed work:

```sh
npx repo-context-center learn
npx repo-context-center learn --write
npx repo-context-center learn --json
npx repo-context-center learn --debug
```

`learn --write` updates `docs/ai-context/REPOSITORY_LEARNING.md`. `learn --json` returns the same learned model for integrations, and `learn --debug` shows source counts and ignored entries.

### Prepare Agent Handover

Use `handoff` when work needs to continue in another session or with another agent:

```sh
npx repo-context-center handoff
npx repo-context-center handoff --json
npx repo-context-center handoff "continue workflow validation"
npx repo-context-center handoff --agent
```

### Estimate Broader Context Costs

`measure` is the task-first command for the v0.9 workflow. `estimate` remains available for evaluating installed context files and broader token-cost scenarios:

```sh
npx repo-context-center estimate --compare-naive
npx repo-context-center estimate --task "fix login bug"
npx repo-context-center estimate --json
```

### Integrations And JSON

Use `work --agent` for the compact route:

```sh
npx repo-context-center work "improve package scripts" --agent
```

Use `work --json` when an agent or tool needs the full work brief in a stable machine-readable shape:

```sh
npx repo-context-center work "improve package scripts" --json
npx repo-context-center work "improve package scripts" --json --context-budget minimal
```

Use `handoff --json` or `handoff --agent` when a tool needs continuation context:

```sh
npx repo-context-center handoff --json
npx repo-context-center handoff --agent
```

Use `suggest --json` when integrating RCC recommendations into another tool:

```sh
npx repo-context-center suggest "fix auth login bug" --json
```

Use `scan --json` to inspect only repository layout and lightweight context suggestions:

```sh
npx repo-context-center scan --json
```

### Archive And Decisions

Archive older long-running notes:

```sh
npx repo-context-center archive --keep 50
```

Archiving keeps work memory compact and refreshes repository learning from the remaining indexed history.

Preserve durable project decisions:

```sh
npx repo-context-center decision add "Keep AGENTS.md compact" --reason "Reduce startup token overhead" --files AGENTS.md
npx repo-context-center decision list
npx repo-context-center decision search "agents"
```

### Lower-Level Commands

`start` and `log` remain available for lower-level workflows:

```sh
npx repo-context-center start "fix auth bug"
npx repo-context-center log "Fixed auth routing" --files src/auth.ts,tests/auth.test.ts
```

Prefer `rcc work`, `rcc done`, and `rcc handoff` for new agent workflows.

## Command Reference

```sh
repo-context-center --help
repo-context-center --version
repo-context-center doctor
repo-context-center init [--dry-run] [--force] [--github-action]
repo-context-center work "<task>" [--agent] [--json] [--context-budget minimal|balanced|deep] [--max-files <number>]
repo-context-center measure "<task>" [--json]
repo-context-center done --summary "<summary>" [--files auto|none|"<path,path>"] [--verify "<command/result>"] [--dry-run]
repo-context-center learn [--json] [--write] [--debug]
repo-context-center handoff [task] [--json|--agent] [--debug] [--write]
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
| `init` | install RCC repository instructions and context templates | once per repo |
| `map --write` | refresh generated repo maps | after structure changes |
| `work --agent` | print the compact agent route | once at task start |
| `find` | locate focused candidate files | only if the route is insufficient |
| `measure` | estimate route savings for a task | when evaluating routing efficiency |
| `done` | save completed-work memory | after meaningful agent work |
| `learn` | regenerate repository learning | after memory edits, archive maintenance, or before release checks |
| `handoff` | prepare a continuation brief | when work continues in another session or agent |
| `validate` | check required context files | setup and CI |
| `map --check` | detect stale generated maps | CI / PRs |
| `archive` | keep long-running notes compact | periodic maintenance |
| `estimate` | estimate broader context/token costs | evaluation and debugging |
| `decision` | record durable project decisions | architecture/workflow decisions |
| `suggest` | get recommendations or JSON | tooling and integrations |
| `scan` | inspect repo layout | diagnostics |
| `start` | print a lower-level startup prompt | specialized workflows |
| `log` | add a lower-level change log entry | specialized workflows |

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

Then commit the updated `docs/ai-context/*` files.

If the output says `AGENTS.md appears outdated`, refresh it separately:

```sh
npx repo-context-center@latest init --update
```

Commit `AGENTS.md` too when `init --update` changes it.

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
- `docs/ai-context/REPOSITORY_LEARNING.md`
- `docs/ai-context/CHANGE_LOG.md`
- `docs/ai-context/archive/`

It also creates `.repo-context-center/config.json`.

`repo-context-center map --write` may update generated sections in:

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

Use `repo-context-center init --update` to refresh RCC-managed agent workflow guidance in `AGENTS.md` while preserving manual sections.

`repo-context-center done`, `repo-context-center archive`, and `repo-context-center learn --write` may update:

- `docs/ai-context/WORK_LOG.md`
- `docs/ai-context/WORK_INDEX.md`
- `docs/ai-context/REPOSITORY_LEARNING.md`

With `--github-action`, init also creates:

- `.github/workflows/repo-context-check.yml`

## Roadmap

| Capability | Status |
| --- | --- |
| Generic context installation | Available |
| Agent work route | Available |
| Repository understanding | Available |
| Task routing | Available |
| Task measurement | Available |
| Startup context | Available |
| Decision memory | Available |
| Work tracking | Available |
| Repository learning | Available |
| Agent handover | Available |
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

## Development

```sh
npm install
npm run build
npm test
```

## Manual Release

This package is prepared for manual npm publishing.

```sh
npm run release:check
npm publish
```

The package publishes the compiled `dist/` output, including the generic context templates copied during build. `prepublishOnly` runs build and tests before a manual `npm publish`.
