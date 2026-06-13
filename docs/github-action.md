# GitHub Action

`repo-context-center` can install a small pull request validation workflow.

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
- runs `npx repo-context-center validate`.

Existing workflow files are not overwritten. Use `--force` to replace the
installed workflow:

```sh
repo-context-center init --github-action --force
```

No external services are required beyond GitHub Actions and npm package access.
