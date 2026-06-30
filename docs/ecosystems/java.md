# Java Repositories

RCC works in Java repositories as repository intelligence for AI coding agents. It does not replace Maven, Gradle, tests, review, or CI; it helps agents find the likely files and suggests verification commands when no stronger task-specific command exists.

## Detection

RCC recognizes common Java signals:

- Maven: `pom.xml`
- Gradle: `build.gradle`, `build.gradle.kts`, `gradlew`

In monorepos, RCC prefers the ecosystem nearest the affected files when it can identify a package or service root.

## Verify Defaults

When Impact does not already provide a stronger targeted command, `rcc verify` may suggest:

- Maven targeted test default: `mvn test`
- Maven broader verification default: `mvn verify`
- Gradle targeted test default: `./gradlew test` when `gradlew` exists, otherwise `gradle test`
- Gradle build default: `./gradlew build` when `gradlew` exists, otherwise `gradle build`

Node behavior is unchanged in Node repositories.

## Local Adoption

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update account service" --agent
rcc impact "update account service" --json
rcc verify "update account service"
```

After running the project checks you choose, record the actual result:

```sh
rcc done --summary "updated account service" --files auto --verify "mvn test"
```

## GitHub Actions

Maven:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: 21
- run: npm install -g repo-context-center@latest
- run: rcc map --check
- run: rcc work "review service change" --agent
- run: rcc impact "review service change" --json
- run: rcc verify "review service change"
- run: rcc metrics "review service change" --json
  if: always()
```

Gradle:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: 21
- run: npm install -g repo-context-center@latest
- run: rcc map --check
- run: rcc work "review gradle service change" --agent
- run: rcc impact "review gradle service change" --json
- run: rcc verify "review gradle service change"
- run: rcc metrics "review gradle service change" --json
  if: always()
```
