# Release Rules

Use this release checklist for Repo Context Center:

```sh
git status
npm run build
npm test
npm pack --dry-run
npm version minor
npm publish
git push
git push --tags
```

For `0.3.x` to `0.4.0` style releases, use `npm version minor`.

Inspect `git status` before release and after versioning so only intended release files are included. Do not publish unless the build, tests, and package dry run all pass.