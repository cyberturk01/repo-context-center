# GitHub Action

`repo-context-center` can install a small pull request workflow that fails when
generated context files are stale.

```sh
repo-context-center init --github-action
```

This creates:

```text
.github/workflows/repo-context-check.yml
```

The workflow:
- runs on pull requests and manual dispatch;
- checks out the repository;
- sets up Node.js 20;
- runs `npx repo-context-center map --check --max-files 300`.

If the check fails, refresh the generated context sections locally:

```sh
npx repo-context-center map --write --max-files 300
```

The installed workflow is check-only and does not auto-commit changes. Users can
add auto-commit behavior if they want it, but the safe default is to fail CI and
let the pull request author commit the refreshed context files.

Existing workflow files are not overwritten. Use `--force` to replace the
installed workflow:

```sh
repo-context-center init --github-action --force
```

No external services are required beyond GitHub Actions and npm package access.
