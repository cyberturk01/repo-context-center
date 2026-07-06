# Spring Boot RCC Example

Minimal Spring Boot-shaped repository example for adopting RCC. This is not a production application; it only demonstrates repository signals and RCC workflow.

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "fix greeting controller" --agent
rcc impact "fix greeting controller" --json
rcc verify "fix greeting controller"
rcc metrics "fix greeting controller" --json
```

For backend-only controller changes, RCC should keep verification focused on Java paths and Maven or Gradle commands instead of inventing generic frontend smoke checks.
