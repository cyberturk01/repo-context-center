# Hotspots

Track files or flows that often cause bugs.

Format:

| Hotspot | Why | Safer Move |
| --- | --- | --- |
| `path/or/flow` | Failure pattern | Test, review, or constraint |

Use for:
- Complex state.
- Concurrency.
- Auth or permissions.
- Serialization.
- Boundary adapters.

Remove entries when they stop being true.
