# Quarkus RCC Example

Minimal Quarkus-shaped repository example for adopting RCC. This is not a production application; it only demonstrates repository signals and RCC workflow.

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "fix greeting resource" --agent
rcc impact "fix greeting resource" --json
rcc verify "fix greeting resource"
rcc metrics "fix greeting resource" --json
```

For backend-only resource changes, RCC should keep verification focused on Java paths and Maven or Gradle commands instead of inventing generic frontend smoke checks.
