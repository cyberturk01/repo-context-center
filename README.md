# repo-context-center

A context layer for AI coding agents.

`repo-context-center` installs a small set of repository instructions and context maps into a target repo so AI coding tools can find the right context faster and avoid rereading noisy files.

It is not an AI agent. It is not a code analyzer. It does not understand your project automatically yet. It gives agents a durable place to store routing notes, module maps, risk notes, token guidance, and lessons learned.

It is designed to work with Codex, Claude Code, Cursor, Copilot-style agents, and other tools that read repository instructions.

## What Problem This Solves

AI coding agents often waste context on repeated discovery:

- Which files matter for this task?
- Which generated folders should be skipped?
- Where are the risky boundaries?
- What did the last session already learn?
- Which docs should be updated after a change?

This project adds a generic Repository Context Center to answer those questions inside the repo.

## Quick Start

From a clone of this project:

```sh
npm install
npm run build
npm link
```

Then, inside a target repository:

```sh
repo-context-center init
repo-context-center validate
```

Preview installation without writing files:

```sh
repo-context-center init --dry-run
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

## Commands

```sh
repo-context-center --help
repo-context-center init [--dry-run] [--force]
repo-context-center validate [--strict]
repo-context-center archive [--keep <number>] [--dry-run]
```

- `init`: install the generic context templates.
- `validate`: check that required context files exist; `--strict` treats warnings as failures.
- `archive`: archive older entries from long-running context files; defaults to keeping 50 entries.

## Recommended AI Agent Workflow

Ask the agent to:

1. Read `AGENTS.md`.
2. Follow `docs/ai-context/TASK_ROUTING.md`.
3. Read only the context files relevant to the task.
4. Check `DO_NOT_READ.md` before broad search.
5. Update `LESSONS_LEARNED.md` and `CHANGE_LOG.md` when durable context changes.

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

## Supported Project Types

The generic templates are language-agnostic. They can be installed in JavaScript, TypeScript, Python, Go, Rust, Ruby, Java, monorepos, docs repos, and mixed stacks.

Project-specific templates and repo scanning are not implemented yet.

## Roadmap

- Generic template installation and validation.
- Context file archiving.
- Project-specific template packs.
- Optional repository scanning to prefill maps.
- Safer update workflows for existing context centers.

## Development

```sh
npm install
npm run build
npm test
```
