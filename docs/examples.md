# Examples

## Bug Fix

Before context center:

- Agent searches the whole repo.
- Opens generated files and snapshots.
- Finds the failing module late.
- Repeats the same discovery next session.

After context center:

- Agent reads `TASK_ROUTING.md`.
- Opens `MODULE_INDEX.md` and `HOTSPOTS.md`.
- Reads the target source and nearby tests.
- Adds a note to `LESSONS_LEARNED.md` if the bug reveals a durable rule.

## Feature Work

Before:

- Agent starts from a broad keyword search.
- Misses a shared dependency boundary.
- Changes one layer but not related tests.

After:

- Agent checks `PROJECT_MAP.md`.
- Reads `DEPENDENCY_MAP.md` for affected boundaries.
- Uses `SYMBOL_MAP.md` to find public APIs.
- Runs focused tests for the touched modules.

## Refactor

Before:

- Agent edits a helper without checking callers.
- A downstream command breaks.

After:

- Agent reads `DEPENDENCY_MAP.md`.
- Opens callers listed in `SYMBOL_MAP.md`.
- Checks `RISK_REGISTER.md`.
- Updates context if ownership or routing changed.

## Maintenance

Use:

```sh
repo-context-center validate --strict
repo-context-center archive --keep 50
```

Run validation after template edits. Archive when `LESSONS_LEARNED.md` or `CHANGE_LOG.md` becomes hard to scan.
