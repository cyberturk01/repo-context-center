# Go Repositories

RCC works in Go repositories as repository intelligence for AI coding agents. It helps agents start with the right files and suggests verification commands when the repository has clear Go signals.

## Detection

RCC recognizes Go repositories with:

- `go.mod`

## Verify Defaults

When Impact does not already provide a stronger targeted command, `rcc verify` may suggest:

```sh
go test ./...
```

RCC does not run this command automatically.

## Local Adoption

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update account service" --agent
rcc impact "update account service" --json
rcc verify "update account service"
```

After running the checks you choose, record the actual result:

```sh
rcc done --summary "updated account service" --files auto --verify "go test ./..."
```

## GitHub Actions

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- uses: actions/setup-go@v5
  with:
    go-version: "1.22"
- run: npm install -g repo-context-center@latest
- run: rcc map --check
- run: rcc work "review go service change" --agent
- run: rcc impact "review go service change" --json
- run: rcc verify "review go service change"
- run: rcc metrics "review go service change" --json
  if: always()
```
