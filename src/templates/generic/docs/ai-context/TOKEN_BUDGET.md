# Token Budget

Use context deliberately.

Default read order:
1. `AGENTS.md`
2. `TASK_ROUTING.md`
3. Relevant map files
4. Target source and tests

Avoid:
- Generated output.
- Lockfiles unless dependency state matters.
- Large snapshots or fixtures unless failing behavior depends on them.

Escalate context only when the first pass leaves a concrete unknown.
