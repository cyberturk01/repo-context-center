# Java Maven RCC Example

Minimal Maven-shaped repository example for adopting RCC.

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update greeting service" --agent
rcc impact "update greeting service" --json
rcc verify "update greeting service"
rcc metrics "update greeting service" --json
```

`rcc verify` may recommend `mvn test` and `mvn verify` when no stronger task-specific command exists. RCC does not run those commands.
