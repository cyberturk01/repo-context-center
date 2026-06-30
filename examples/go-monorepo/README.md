# Go Monorepo RCC Example

Minimal multi-service Go repository example for adopting RCC.

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write --max-files 500
rcc work "update billing invoice service" --agent
rcc impact "update billing invoice service" --json
rcc verify "update billing invoice service"
rcc metrics "update billing invoice service" --json
```

RCC detects `services/*/go.mod` files and uses affected paths to prefer the nearest Go module when making verification recommendations. It prints suggested commands such as `go test ./...`; it does not run them.
