# Java Gradle RCC Example

Minimal Gradle-shaped repository example for adopting RCC.

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update greeting service" --agent
rcc impact "update greeting service" --json
rcc verify "update greeting service"
rcc metrics "update greeting service" --json
```

When `gradlew` exists, `rcc verify` prefers `./gradlew test` and `./gradlew build`. RCC does not execute Gradle.
