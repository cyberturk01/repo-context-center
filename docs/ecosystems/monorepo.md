# Monorepos

RCC supports workspace-style repositories without becoming a project manager, dependency graph engine, or build executor. It understands enough repository structure to keep AI coding agents focused on the right package.

## Supported Signals

RCC recognizes common monorepo signals:

- `apps/`
- `packages/`
- `services/`
- `libs/`
- `modules/`
- npm `workspaces` in `package.json`
- pnpm `pnpm-workspace.yaml`
- Yarn workspaces
- Turborepo via `turbo.json` or `turbo` dependency
- Nx via `nx.json` or Nx dependencies
- Lerna via `lerna.json` or `lerna` dependency

It also detects package ecosystem roots one package level below workspace directories, such as:

```text
packages/auth/package.json
services/auth/pom.xml
services/billing/build.gradle.kts
packages/api/pyproject.toml
services/worker/go.mod
```

## Package-Aware Routing

When a task or affected path clearly points at a package, RCC prefers files from that package first:

```text
packages/auth/src/session.ts
packages/auth/tests/session.test.ts
```

before unrelated packages such as:

```text
packages/frontend/
packages/mobile/
packages/docs/
```

RCC expands across package boundaries only when task wording, learned relationships, or existing routing evidence already supports it.

## Package-Aware Verify

`rcc verify` keeps repository-level fallbacks, but can recommend package-aware commands when the nearest package is clear:

- npm workspaces: `npm test --workspace auth`
- pnpm: `pnpm --filter auth test`
- Yarn workspaces: `yarn workspace auth test`
- Java Maven module: `mvn -pl auth-service test`
- Java Gradle project: `./gradlew :auth:test`
- Python package: `pytest packages/auth`
- Go module: nearest detected `go.mod`, with safe fallback to `go test ./...`

RCC prints recommendations. It does not execute commands, infer coverage, estimate runtime, or score package health.

## Ecosystem Examples

Java multi-module:

```text
services/auth/pom.xml
services/auth/src/main/java/example/AuthService.java
services/billing/pom.xml
```

Python monorepo:

```text
packages/api/pyproject.toml
packages/api/src/api/
packages/jobs/pyproject.toml
```

Go multi-module:

```text
services/accounts/go.mod
services/accounts/internal/account/service.go
services/billing/go.mod
services/billing/internal/invoice/service.go
```

Node workspace:

```text
package.json
pnpm-workspace.yaml
packages/auth/package.json
apps/web/package.json
```

## Local Adoption

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write --max-files 500
rcc work "update auth package" --agent
rcc impact "update auth package" --json
rcc verify "update auth package"
rcc metrics "update auth package" --json
```

After running the checks you choose, record the actual result:

```sh
rcc done --summary "updated auth package" --files auto --verify "pnpm --filter auth test"
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
