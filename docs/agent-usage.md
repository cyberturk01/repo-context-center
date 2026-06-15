# Agent Usage

## Recommended Daily Workflow

1. Run `npx repo-context-center init` once per repo to install context templates.
2. Run `npx repo-context-center map --write` to create durable repo-level context.
3. Run `map --write` again after meaningful repo structure changes.
4. Let `AGENTS.md` guide agents.
5. Use `npx repo-context-center start "<task>"` before each new coding task when possible.

Example:

```sh
npx repo-context-center start "fix birthday email delay"
```

`repo-context-center` does not run in the background. It refreshes generated context only when you run `map --write`, checks freshness only when you run `map --check`, and prints startup guidance only when you run `start`.

## Command Roles

| Command | Purpose | When to use |
| --- | --- | --- |
| `init` | install context templates | once per repo |
| `map --write` | refresh repo map | after structure changes |
| `map --check` | detect stale context | CI / PRs |
| `suggest` | get task recommendations / JSON | tooling |
| `start` | generate agent startup prompt | before each task |

`map --write` creates durable repo-level context in `AGENTS.md` and `docs/ai-context/*`.

`suggest` returns task-specific recommendations. Use it directly for integrations, especially with `--json`.

`start` generates a ready-to-paste startup prompt for AI coding agents, including read-first docs, likely source files, likely tests, risk, and compact recommendation reasons.

## How Agents Should Use AGENTS.md

`AGENTS.md` should instruct agents to run `npx repo-context-center start "<task>"` when shell access is available.

If users only tell an agent to read `AGENTS.md`, the agent receives stable repo guidance and fallback context docs. That does not mean shell commands will always run automatically.

If shell access or approval is unavailable, the agent should fall back to the context docs listed in `AGENTS.md`, especially `TASK_ROUTING.md`, `TOKEN_BUDGET.md`, and `DO_NOT_READ.md`.
