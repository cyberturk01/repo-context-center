# Agent Usage

Use these instructions when asking an AI coding agent to work in a repo with a context center.

## Suggested Prompt

```text
Before changing code, read AGENTS.md and follow docs/ai-context/TASK_ROUTING.md.
Use the smallest relevant context set.
Check docs/ai-context/DO_NOT_READ.md before broad search.
When you learn durable repo facts, update LESSONS_LEARNED.md and CHANGE_LOG.md.
```

## Expected Agent Flow

1. Read `AGENTS.md`.
2. Identify the task type in `TASK_ROUTING.md`.
3. Open the relevant context maps.
4. Inspect source and tests.
5. Make the smallest useful change.
6. Run focused validation.
7. Update context only when the new fact should survive the session.

## Works With

- Codex
- Claude Code
- Cursor
- Copilot-style agents
- Other tools that read repository instructions or Markdown docs

## Human Review

Treat context files like code-adjacent docs:

- review them when they change;
- delete stale guidance;
- avoid project secrets;
- keep instructions tool-neutral where possible.
