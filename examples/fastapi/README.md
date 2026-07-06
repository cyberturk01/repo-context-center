# FastAPI RCC Example

Minimal FastAPI-shaped repository example for adopting RCC.

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update account route" --agent
rcc impact "update account route" --json
rcc verify "update account route"
rcc metrics "update account route" --json
```

`rcc verify` may recommend `pytest` when pytest is present in Python signals. Backend-only FastAPI tasks should not receive generic frontend smoke checks. RCC does not run the application or tests.
