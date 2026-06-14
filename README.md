# repo-context-center

A context layer for AI coding agents.

`repo-context-center` installs compact generic repository context so AI coding tools can find the right files faster and avoid rereading noisy paths. `init` creates the generic context center; `map --write` adds repo-specific generated sections from real files using lightweight heuristics.

Measure estimated context token savings before using the repo.

```sh
repo-context-center estimate --compare-naive
repo-context-center estimate --task "fix Cypress test" --mode compact
```

It is not an AI agent and does not call an AI API. It gives agents a durable place to store routing notes, module maps, risk notes, token guidance, and lessons learned.

It is designed to work with Codex, Claude Code, Cursor, Copilot-style agents, and other tools that read repository instructions.

## Real Repo Demo

Verified with:

```sh
repo-context-center estimate --compare-naive
```

```text
Estimated naive scan: 97,917 tokens
Estimated compact startup: 546 tokens
Estimated saving: 99%
```

Estimates use `ceil(characters / 4)`. They are not tokenizer-exact, not billing estimates, and results vary by repo.

## What Problem This Solves

AI coding agents often waste context on repeated discovery:

- Which files matter for this task?
- Which generated folders should be skipped?
- Where are the risky boundaries?
- What did the last session already learn?
- Which docs should be updated after a change?

This project adds a generic Repository Context Center to answer those questions inside the repo.

## Quick Start

Inside a target repository:

```sh
npx repo-context-center init
npx repo-context-center map --write
npx repo-context-center validate
npx repo-context-center estimate --compare-naive
npx repo-context-center suggest "fix unit test failure" --max-files 8
```

From a clone of this project:

```sh
npm install
npm run build
npm link
```

Then, inside a target repository:

```sh
repo-context-center init
repo-context-center map --write
repo-context-center validate
repo-context-center estimate --compare-naive
repo-context-center suggest "fix unit test failure" --max-files 8
```

Preview installation without writing files:

```sh
repo-context-center init --dry-run
```

Install a PR validation workflow:

```sh
repo-context-center init --github-action
```

Overwrite existing context templates:

```sh
repo-context-center init --force
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

With `--github-action`, it also creates:

- `.github/workflows/repo-context-check.yml`

## Commands

```sh
repo-context-center --help
repo-context-center init [--dry-run] [--force] [--github-action]
repo-context-center map [--write] [--dry-run] [--json] [--max-files <number>]
repo-context-center validate [--strict]
repo-context-center archive [--keep <number>] [--dry-run]
repo-context-center estimate [--mode compact|investigation|detailed] [--task "<task>"] [--compare-naive] [--json] [--max-files <number>]
repo-context-center scan [--json]
repo-context-center suggest "<task>" [--json] [--symbols] [--max-files <number>]
```

- `init`: install the generic context templates.
- `map`: analyze repo layout and generate repo-specific context sections.
- `validate`: check that required context files exist and report warnings.
  Missing `.repo-context-center/config.json` is a warning by default and a
  failure with `--strict`.
- `archive`: archive older entries from long-running context files; defaults to keeping 50 entries.
- `estimate`: estimate task-aware source, test, and context token overhead; optionally compare with a naive repo scan.
- `scan`: inspect only the repository layout and suggest lightweight entries for context maps.
- `suggest`: recommend low-token context files, real likely files, likely tests, mode, symbols, and risk level for a task.

See [docs/github-action.md](docs/github-action.md) for PR validation setup.

Example:

```sh
repo-context-center suggest "fix payment consent bug" --json --max-files 8
```

Estimate context overhead:

```sh
repo-context-center estimate --compare-naive
repo-context-center estimate --task "fix Cypress test" --mode compact
```

Token estimates use `ceil(characters / 4)`. They are rough planning numbers,
not exact tokenizer output and not model billing estimates. The command is meant
to help evaluate whether the context center is reducing broad repo reads enough
to justify its own startup cost. In an empty repo, startup context can be zero
until templates are installed; after `repo-context-center init`, default context
files should produce a realistic non-zero startup estimate.

## Map Command

`init` creates generic templates. `map` analyzes repo layout with heuristics, and `map --write` updates generated sections between markers while preserving manual content outside those markers.

The map command:

- uses no AI and adds no runtime dependency;
- uses only real existing files;
- does not emit placeholders like `path/or/flow`;
- is best treated as a starting map, not a substitute for source review.

## Recommended AI Agent Workflow

Ask the agent to:

1. Read `AGENTS.md`.
2. Follow `docs/ai-context/TASK_ROUTING.md`.
3. Check `docs/ai-context/TOKEN_BUDGET.md` and `docs/ai-context/DO_NOT_READ.md`.
4. Read only the on-demand context files relevant to the task.
5. Verify source code before changing behavior.
6. Update context files only when durable repo knowledge changes.

See [docs/agent-usage.md](docs/agent-usage.md).

## Token-Saving Strategy

The context center is meant to reduce repeated discovery, not replace source reading. It works by keeping small, stable maps near the repo:

- route tasks before opening many files;
- skip generated and vendored paths by default;
- keep module, dependency, risk, and symbol notes compact;
- archive long-running notes before they become noisy.

See [docs/token-strategy.md](docs/token-strategy.md).

## Example: Before/After Session Behavior

Before:

> The agent scans broadly, opens generated files, rediscovers entrypoints, misses a risky shared module, and repeats the same investigation next session.

After:

> The agent reads `AGENTS.md`, follows task routing, opens the relevant module map, checks hotspots, edits a smaller set of files, runs focused tests, and records durable lessons.

More examples are in [docs/examples.md](docs/examples.md).

## Further Reading

- [Concept](docs/concept.md)
- [Agent usage](docs/agent-usage.md)
- [Token strategy](docs/token-strategy.md)
- [Examples](docs/examples.md)
- [GitHub Action](docs/github-action.md)

## Supported Project Types

The generic templates are language-agnostic. They can be installed in JavaScript, TypeScript, Python, Go, Rust, Ruby, Java, monorepos, docs repos, and mixed stacks.

Repo-specific mapping is heuristic-based and works best when files follow common conventions. Source code remains the source of truth.

## Roadmap

- Completed: generic template installation.
- Completed: validation.
- Completed: archive.
- Completed: estimate.
- Completed: suggest.
- Completed: repo-specific map generation.
- Future: richer import graph.
- Future: better framework detection.
- Future: safer merge/update UX.
- Future: project-specific packs.

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

The package publishes the compiled `dist/` output, including the generic context
templates copied during build. `prepublishOnly` runs build and tests before a
manual `npm publish`.
