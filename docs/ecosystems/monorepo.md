# Monorepos

RCC supports workspace-style repositories without becoming a project manager or execution engine. It detects common workspace signals and still keeps the core workflow focused on repository intelligence for AI coding agents.

## Detection

RCC recognizes monorepo-style signals such as:

- `workspaces` in root `package.json`
- `apps/`
- `packages/`
- `services/`
- `libs/`
- `modules/`

It also detects common ecosystem roots one package level below those directories, such as `services/api/pom.xml`, `packages/web/package.json`, or `services/worker/go.mod`.

## Verify Behavior

`rcc verify` prefers affected files and the nearest detected package ecosystem over task wording alone. For example:

- Changes under `services/api/` with `pom.xml` can receive Maven defaults.
- Changes under `services/worker/` with `go.mod` can receive `go test ./...`.
- Changes in a root Node workspace keep existing Node behavior.

RCC does not create an execution plan, estimate runtime, report coverage, or run commands.

## Local Adoption

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write --max-files 500
rcc work "update workspace service" --agent
rcc impact "update workspace service" --json
rcc verify "update workspace service"
rcc metrics "update workspace service" --json
```

After running the checks you choose, record the actual result:

```sh
rcc done --summary "updated workspace service" --files auto --verify "service test command"
```

## GitHub Actions

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm install -g repo-context-center@latest
- run: rcc map --check --max-files 500
- run: rcc work "review workspace change" --agent
- run: rcc impact "review workspace change" --json
- run: rcc verify "review workspace change"
- run: rcc metrics "review workspace change" --json
  if: always()
```

For polyglot monorepos, add the language setup actions that your repository already needs, such as `actions/setup-java`, `actions/setup-python`, or `actions/setup-go`.
