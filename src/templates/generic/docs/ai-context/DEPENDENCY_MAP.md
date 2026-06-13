# Dependency Map

Record important internal and external dependencies.

Format:

| From | Depends On | Why It Matters |
| --- | --- | --- |
| `module` | `module/package` | Runtime, API, build, or test impact |

Use this to avoid surprise blast radius.

Update when:
- A shared dependency changes.
- A module boundary shifts.
- A new external package is added.
