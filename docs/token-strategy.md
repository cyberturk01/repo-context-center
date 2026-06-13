# Token Strategy

The goal is to spend tokens on the files that can change the answer.

## Default Read Order

1. `AGENTS.md`
2. `docs/ai-context/TASK_ROUTING.md`
3. The relevant map file
4. Target source files
5. Nearby tests

## Reduce Waste

- Read maps before broad search.
- Check `DO_NOT_READ.md` before opening large paths.
- Avoid generated, vendored, built, and coverage output.
- Prefer specific symbols and paths over whole-folder reads.
- Use `HOTSPOTS.md` and `RISK_REGISTER.md` before editing shared code.

## Keep Context Small

- Add facts that help future sessions.
- Remove stale notes quickly.
- Archive long logs with `repo-context-center archive`.
- Keep tables short enough to scan in one pass.

## When to Expand Context

Expand only when there is a concrete unknown:

- a caller is unclear;
- a test failure points outside the first module;
- a shared type or dependency boundary is involved;
- a risk note says the change has wider impact.
