# Go Service RCC Example

Minimal Go module example for adopting RCC.

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update account service" --agent
rcc impact "update account service" --json
rcc verify "update account service"
rcc metrics "update account service" --json
```

With `go.mod`, `rcc verify` may recommend `go test ./...` when no stronger task-specific command exists. RCC does not execute Go commands.
