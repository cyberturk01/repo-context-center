# Concept

`repo-context-center` installs a small context system inside a repository.

The context center gives AI coding agents stable files to read before they inspect source code:

- `AGENTS.md` for entry instructions.
- `TASK_ROUTING.md` for choosing the right context.
- Map files for modules, dependencies, symbols, risks, and hotspots.
- Maintenance files for lessons, changes, token budget, and archive policy.

This is not an AI agent and not a code analyzer. It does not decide what to change. It helps another tool decide what to read.

## Design Rules

- Keep every context file short.
- Prefer routing guidance over explanation.
- Store durable facts, not task scratch notes.
- Link to source files instead of copying source into docs.
- Update context when repeated discovery becomes obvious.

## What Belongs Here

Good context:

- "Auth checks pass through `src/auth/policy.ts`."
- "Generated clients live in `src/generated/`; avoid reading unless API shape matters."
- "Changing `packages/core` can affect CLI and worker tests."

Poor context:

- Long architecture essays.
- Temporary TODOs.
- Full stack traces.
- Copied source code.
