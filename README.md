# repo-context-center

![npm](https://img.shields.io/npm/dm/repo-context-center)
![npm](https://img.shields.io/npm/v/repo-context-center)

Repo Context Center (RCC) is a lightweight context-routing layer for AI coding agents.

Give AI agents the smallest useful route to the right files, then prove the estimated token savings.

Instead of broadly scanning repositories, RCC identifies the most relevant files, tests, and supporting context for a task and provides a compact agent route. RCC can also estimate the difference between a naive repository scan and the RCC route.

RCC works with Codex, Claude Code, Cursor, Copilot-style agents, and other coding assistants that can read repository instructions or call local CLI tools. It is not an AI coding agent, code generator, code reviewer, or security scanner.

## Local-First

- No API keys.
- No AI service.
- No model costs.
- No background process.
- Works entirely on local repository metadata and Markdown files.

![Repo Context Center workflow](https://raw.githubusercontent.com/cyberturk01/repo-context-center/c39f583/docs/assets/repo-context-center-diagram.svg)

## Quick Start

Initialize RCC and generate the repository map:

```sh
npx repo-context-center init
npx repo-context-center map --write
```

Then ask RCC for the smallest useful route for an agent task:

```sh
rcc work "fix workflow risk detection" --agent
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

## Agent Workflow

Recommended workflow:

```text
1. Run:
   rcc work "<task>" --agent

2. Inspect:
   primaryFiles
   tests

3. Edit code

4. Verify changes

5. Record:
   rcc done
```

Guidance:

- Run `rcc work "<task>" --agent` once at task start.
- Do not repeatedly rerun the same task route.
- Use `rcc find "<keyword>"` only if the route is insufficient.
- Use `rcc done` after meaningful work.

After completed work, record lightweight work memory:

```sh
rcc done --summary "fixed workflow risk detection" --files auto --verify "npm test"
```

Agents should treat RCC output as navigation guidance, not proof. Source code remains the source of truth, and agents should verify source before editing.

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

The naive scan estimate is an approximation. Savings are estimates, not guarantees. The goal is to show the scale of repository reduction achieved by RCC routing.

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

## Real Example

Repository-specific estimate from this repository:

```text
Task:
fix workflow risk detection

Naive scan estimate:
195,623 tokens

RCC route:
87 tokens

Estimated saving:
195,536 tokens (99.9%)
```

This is a repository-specific estimate, not a guaranteed benchmark. Actual tokenizer costs vary by model, and the exact route depends on the repository map and task wording.

## Supporting Commands

The primary workflow is:

```text
work -> edit -> verify -> done
```

The commands below support that workflow.

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

Prefer `rcc work` and `rcc done` for new agent workflows.

## Command Reference

```sh
repo-context-center --help
repo-context-center init [--dry-run] [--force] [--github-action]
repo-context-center work "<task>" [--agent] [--json] [--context-budget minimal|balanced|deep] [--max-files <number>]
repo-context-center measure "<task>" [--json]
repo-context-center done --summary "<summary>" [--files auto|none|"<path,path>"] [--verify "<command/result>"] [--dry-run]
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
| Agent work route | Available |
| Repository understanding | Available |
| Task routing | Available |
| Task measurement | Available |
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
