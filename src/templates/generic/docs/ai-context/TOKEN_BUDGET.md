# Token Budget

Compact Mode:
- routing + target file + nearest test

Investigation Mode:
- add maps, callers, failure evidence

Read:
1. `AGENTS.md`
2. `TASK_ROUTING.md`
3. Relevant map files
4. Target source and tests

Estimate overhead:
- Run `repo-context-center estimate`.
- `--compare-naive` compares startup vs broad pass.
- Approximate, not billing data.

Skip:
- generated output
- lockfiles unless dependency state matters
- large snapshots unless failure depends on them

Escalate only for concrete unknowns.
