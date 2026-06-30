# Java Repositories

RCC works in Java repositories as repository intelligence for AI coding agents. It does not replace Maven, Gradle, tests, review, or CI; it helps agents find likely files, estimate impact, and recommend focused verification steps.

RCC prints Maven and Gradle commands when they are useful, but it does not execute them.

## Detection

RCC recognizes common Java signals:

- Maven: `pom.xml`
- Gradle: `build.gradle`, `build.gradle.kts`, `gradlew`

In monorepos and multi-module layouts, RCC prefers the ecosystem nearest the affected files when it can identify a package, module, or service root.

## Recommended RCC Workflow

```sh
rcc init
rcc map --write
rcc work "update account service" --agent
rcc impact "update account service" --json
rcc verify "update account service"
rcc metrics "update account service" --json
```

After running the project checks you choose, record the actual result:

```sh
rcc done --summary "updated account service" --files auto --verify "mvn test"
```

## Maven Quickstart

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update order service" --agent
rcc impact "update order service" --json
rcc verify "update order service"
```

When Impact does not already provide a stronger task-specific command, `rcc verify` may suggest:

- `mvn test`
- `mvn verify`

Use the command that matches your repository’s normal verification depth, then record what actually ran with `rcc done --verify`.

## Gradle Quickstart

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update payment service" --agent
rcc impact "update payment service" --json
rcc verify "update payment service"
```

When Impact does not already provide a stronger task-specific command, `rcc verify` may suggest:

- `./gradlew test` when `gradlew` exists.
- `gradle test` when no wrapper is detected.
- `./gradlew build` or `gradle build` for broader Gradle verification.

RCC prefers the wrapper because it usually reflects the repository’s intended Gradle version.

## Spring Boot

Spring Boot projects commonly use Maven or Gradle, so the same detection rules apply.

Example:

```sh
rcc work "fix login controller session handling" --agent
rcc impact "fix login controller session handling" --json
rcc verify "fix login controller session handling"
```

For backend-only Spring Boot paths such as `src/main/java/**/AccountController.java`, RCC should not invent generic frontend smoke checks just because the task mentions a user-facing feature. It keeps verification focused on affected Java paths, tests, and Maven or Gradle defaults.

## Quarkus

Quarkus projects also commonly use Maven or Gradle. RCC does not need a Quarkus-specific runtime integration to be useful; it uses the repository’s build signals and affected paths.

Example:

```sh
rcc work "fix account resource validation" --agent
rcc impact "fix account resource validation" --json
rcc verify "fix account resource validation"
```

For backend-only Quarkus paths such as `src/main/java/**/AccountResource.java`, RCC keeps recommendations in the Java ecosystem and avoids generic frontend smoke checks unless affected frontend files are present.

## Multi-Module And Monorepo Notes

For Maven multi-module repositories, keep the root `pom.xml` and module `pom.xml` files committed so RCC can identify Java roots. For Gradle multi-project repositories, keep root build files and the wrapper committed when possible.

In polyglot monorepos, RCC uses affected files first. For example:

- `services/billing/pom.xml` plus affected files under `services/billing/` can receive Maven recommendations.
- `services/search/build.gradle.kts` plus affected files under `services/search/` can receive Gradle recommendations.
- A root Node workspace still keeps existing Node behavior for root Node tasks.

RCC does not add project management, coverage scoring, estimated runtime, or execution planning.

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
