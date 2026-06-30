# Python Pytest RCC Example

Minimal pytest-oriented Python repository example for adopting RCC.

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update greeting module" --agent
rcc impact "update greeting module" --json
rcc verify "update greeting module"
rcc metrics "update greeting module" --json
```

With pytest signals, `rcc verify` may recommend `pytest` when no stronger task-specific command exists. RCC does not execute pytest.
