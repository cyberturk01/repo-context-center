# repo-context-center
A ContextOps toolkit for AI coding agents. Install repository memory, task routing, token budgets, dependency maps, and validation to reduce context usage and improve code changes.

## Development

```sh
npm install
npm run build
npm test
```

## CLI

After building, the CLI entrypoint is available at `dist/cli/index.js`.

```sh
repo-context-center --help
repo-context-center init
repo-context-center validate
repo-context-center archive
```

The initial scaffold includes lightweight command dispatch only. Repository scanning
and archive generation will be added later.
