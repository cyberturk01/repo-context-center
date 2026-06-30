# Python RCC Example

Minimal Python-shaped repository example for adopting RCC.

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update greeting module" --agent
rcc impact "update greeting module" --json
rcc verify "update greeting module"
rcc metrics "update greeting module" --json
```

With generic Python signals, `rcc verify` may recommend `python -m pytest` when no stronger task-specific command exists. RCC does not run Python commands.
