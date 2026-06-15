# Testing Strategy

Repo Context Center should pass the TypeScript build before release:

```sh
npm run build
```

All tests must pass before release:

```sh
npm test
```

Before publishing or tagging a release, run a package dry run:

```sh
npm pack --dry-run
```

Routing changes need focused tests around task suggestions, startup context, and command behavior. Changes in `src/core/suggester.ts`, `src/core/startPrompt.ts`, or related routing logic should be covered by the relevant `suggest` and `start` tests.

CLI changes need argument, command compatibility, and output behavior tests so existing user workflows keep working across versions.
