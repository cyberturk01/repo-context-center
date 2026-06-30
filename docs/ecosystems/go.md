# Go Repositories

RCC works in Go repositories as repository intelligence for AI coding agents. It helps agents and developers start with the right files, understand likely impact, and choose verification steps. RCC does not execute Go commands, replace `go test`, or become a build tool.

## Quickstart

From a Go repository:

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update account service" --agent
rcc impact "update account service" --json
rcc verify "update account service"
rcc metrics "update account service" --json
```

Recommended RCC workflow:

```text
rcc init -> rcc map -> rcc work "<task>" -> rcc impact "<task>" -> rcc verify "<task>" -> rcc metrics "<task>"
```

`metrics` is optional diagnostics. Use `done` after the task is complete to record what actually changed and which checks were run:

```sh
rcc done --summary "updated account service" --files auto --verify "go test ./..."
```

## Go Signals

RCC recognizes Go repositories and Go service roots with:

- `go.mod`

For a basic module, `go.mod` at the repository root is enough for RCC to recognize the Go ecosystem. In a multi-service repository, `go.mod` under a service directory helps RCC identify the nearest Go module for affected paths.

## Verify Defaults

When Impact does not already provide a stronger task-specific command, `rcc verify` may suggest:

```sh
go test ./...
```

RCC prints this recommendation in the verification plan. A human, CI job, or coding agent decides whether to run it.

## Package-Level Verification

RCC keeps package-level verification guidance conservative. It does not infer every possible `go test ./internal/account` command from source layout. Instead:

- If affected tests are already known through Impact or repository learning, Verify can surface those targeted tests.
- If no stronger command exists, the Go fallback remains `go test ./...`.
- If your repository has a narrower package command habit, record it with `rcc done --verify` after real work so future repository learning can help.

Example:

```sh
rcc work "fix account validation" --agent
rcc impact "fix account validation" --json
rcc verify "fix account validation"
go test ./internal/account
rcc done --summary "fixed account validation" --files auto --verify "go test ./internal/account"
```

## Backend Service Example

For a backend task such as:

```sh
rcc verify "fix checkout service timeout"
```

in a repository with:

```text
go.mod
internal/checkout/service.go
internal/checkout/service_test.go
```

RCC keeps recommendations focused on Go/backend verification. Even if task wording mentions a frontend-facing behavior, backend-only Go paths should not produce generic frontend smoke checks unless affected frontend files are present.

## Go Monorepos

Go monorepos often contain multiple modules:

```text
services/accounts/go.mod
services/accounts/internal/account/service.go
services/billing/go.mod
services/billing/internal/invoice/service.go
```

RCC detects workspace-style directories such as `services/`, `apps/`, `packages/`, `libs/`, and `modules/`. When affected paths make the relevant service clear, `rcc verify` prefers the nearest detected Go module over task wording alone.

Typical monorepo flow:

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write --max-files 500
rcc work "update billing invoice service" --agent
rcc impact "update billing invoice service" --json
rcc verify "update billing invoice service"
rcc metrics "update billing invoice service" --json
```

## GitHub Actions

```yaml
name: RCC Go Context

on:
  pull_request:

jobs:
  rcc:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
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

This workflow checks RCC context freshness and prints repository intelligence for the task. It does not run `go test`; keep your normal Go test job as a separate CI step.
