# repo-context-center

![npm](https://img.shields.io/npm/dm/repo-context-center)
![npm](https://img.shields.io/npm/v/repo-context-center)

Repo Context Center (RCC) is a repository intelligence layer for AI coding agents.

Instead of broadly scanning repositories, RCC helps agents find the right files, understand change impact, and determine what should be verified using compact, deterministic repository context. This minimizes unnecessary repository exploration while preserving the agent's ability to make implementation decisions.

RCC works with Codex, Claude Code, Cursor, Copilot-style agents, and other coding assistants that can read repository instructions or invoke local CLI tools. It is not an AI coding agent, code generator, code reviewer, or security scanner.

Core workflow:

```
init → map → work → impact → verify → done → handoff
```

Optional diagnostic:

```
metrics
```


## Local-First

- No API keys.
- No AI service.
- No model costs.
- No background process.
- Works entirely on local repository metadata and Markdown files.

Core capabilities:

- Repository Understanding
- Task Routing
- Startup Context
- Decision Memory
- Work Tracking
- Repository Learning
- Agent Handover
- Impact Analysis
- Verify Intelligence
- Repository Metrics

![Repo Context Center workflow](https://raw.githubusercontent.com/cyberturk01/repo-context-center/main/docs/assets/repo-context-center-diagram.svg)

## Quick Start

Initialize RCC and generate the repository map:

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
```

Then ask RCC for the smallest useful route for an agent task:

```sh
npx repo-context-center@latest work "fix workflow risk detection" --agent
```

Example output:

```json
{
  "task": "fix workflow risk detection",
  "primaryFiles": [
    ".github/workflows/ai-project-guardian.yml",
    ".github/workflows/ci.yml",
    "package.json"
  ],
  "supportingFiles": [],
  "tests": [
    "tests/decision.test.js"
  ],
  "readFirst": [
    "AGENTS.md"
  ],
  "next": "Start with primaryFiles. Do not rerun work for this task. Use rcc find \"workflow\" only if needed.",
  "briefTokens": 87
}
```

- `primaryFiles` are the files to inspect first.
- `tests` are the most likely checks to validate changes.
- `supportingFiles` are optional follow-up files when the route is not enough.
- `readFirst` contains repository rules the agent should read before editing.

## Non-Node Usage

RCC remains repository intelligence for AI coding agents, not a Node-only tool. It can detect common Maven, Gradle, Python, Go, .NET, and workspace-style repository signals and use them to make `rcc verify` recommendations feel natural when no stronger task-specific command exists.

RCC is distributed as a single npm CLI package. Java, Python, Go, Maven, Gradle, Spring Boot, Quarkus, and monorepo examples are adoption examples only; they show how RCC works inside those repository types. RCC does not publish separate Maven, PyPI, Go module, or .NET packages.

Examples:

- Java Maven: `mvn test`, with `mvn verify` as broader verification.
- Java Gradle: `./gradlew test` and `./gradlew build` when the wrapper exists; otherwise `gradle test` and `gradle build`.
- Spring Boot and Quarkus: use the Java Maven/Gradle signals and keep backend-only verification focused on Java paths.
- Python: detects `pyproject.toml`, `requirements.txt`, `setup.py`, and `pytest.ini`; suggests `pytest` when pytest signals are present, otherwise `python -m pytest`. See [Python adoption](docs/ecosystems/python.md).
- Go: detects `go.mod`; suggests `go test ./...` when no stronger task-specific command exists. See [Go adoption](docs/ecosystems/go.md).
- .NET: `dotnet test`.
- Node: existing Node behavior is preserved.

RCC prints suggested commands but does not execute them. See [Java](docs/ecosystems/java.md), [Python](docs/ecosystems/python.md), [Go](docs/ecosystems/go.md), and [monorepo](docs/ecosystems/monorepo.md) adoption notes.

## Monorepo Intelligence

RCC recognizes common workspace layouts such as `apps/`, `packages/`, `services/`, `libs/`, `modules/`, npm/yarn/pnpm workspaces, Turborepo, Nx, and Lerna. In monorepos, Work and Impact prefer files in the same package when task wording or affected paths make the package clear, while Verify can suggest package-aware commands such as workspace test filters, Maven `-pl`, Gradle project paths, or package-scoped pytest when confidence is sufficient.

RCC understands repository structure; it does not replace the build system, run commands, score package health, or create execution plans.

Preview installation without writing files:

```sh
npx repo-context-center init --dry-run
```

Overwrite existing context templates:

```sh
npx repo-context-center init --force
```

Refresh older RCC agent instructions while preserving manual AGENTS.md sections:

```sh
npx repo-context-center@latest init --update
```

## Use the Latest Version

Recommended first-run commands:

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
npx repo-context-center@latest work "fix workflow risk detection" --agent
```

`npx repo-context-center@latest` runs the latest published version. After global or local installation, use either `rcc` or `repo-context-center`.

If an existing repository has an older local RCC install, `npx repo-context-center ...` may run that local binary instead of the latest published package. Use `npx repo-context-center@latest init --update` or upgrade the local dependency before refreshing `AGENTS.md`.

For release validation, check:

```sh
npm run release:check
```

## Complete Usage Guide

Recommended workflow:

```text
init -> map -> work -> impact -> verify -> done -> handoff
```

| Step | Command | When to run it | What it produces | Who uses the output |
| --- | --- | --- | --- | --- |
| `init` | `npx repo-context-center@latest init` | Once per repository, or when installing missing RCC context files | `AGENTS.md`, `docs/ai-context/*`, and `.repo-context-center/config.json` | Humans and agents |
| `init --update` | `npx repo-context-center@latest init --update` | When an existing repo has older RCC-generated `AGENTS.md` guidance | Refreshed RCC agent workflow while preserving manual AGENTS.md content | Humans and agents |
| `map --write` | `npx repo-context-center@latest map --write` | After init and after meaningful repo structure changes | Refreshed generated sections in context files | Agents, reviewers, and CI |
| `work` | `rcc work "implement feature" --agent` | Once at task start | Compact route with primary files, tests, supporting files, and read-first rules | The active coding agent |
| `impact` | `rcc impact "update README wording" --json` | Before or after a change when estimating affected files and checks | Affected files, affected tests, suggested commands, confidence, and notes | Humans, agents, and reviewers |
| `verify` | `rcc verify "implement feature"` | Before final verification or review | Verification plan with targeted tests, build commands, smoke checks, manual checks, and a validation checklist | Humans, agents, and reviewers |
| `done` | `rcc done --summary "implemented feature" --files auto --verify "npm test"` | After meaningful completed work | Lightweight work memory in `docs/ai-context/WORK_LOG.md` and learned repository patterns in `docs/ai-context/REPOSITORY_LEARNING.md` | Future agents and humans |
| `learn` | `rcc learn --write` | When repository learning should be regenerated on demand | Refreshed learned focus areas, file relationships, verification patterns, and repository habits | Agents, humans, and routing commands |
| `handoff` | `rcc handoff` or `rcc handoff --agent` | When work continues in another session or agent | Continuation brief from recent work, decisions, and task-aware files | The next agent or human |

Optional diagnostics:

- Use `rcc metrics "<task>" --json` when you need a compact repository intelligence snapshot for one task. It is not a required workflow step.
- Use `rcc measure "<task>"`, `rcc estimate --compare-naive`, or `rcc scan --json` when evaluating routing, context cost, or repository layout.
- `metrics` summarizes existing Work, Measure, Impact, Verify, and freshness outputs. It does not run a second independent repository analysis engine.

## Command-guided, not command-chained

RCC guides humans and AI agents toward the next explicit command. It does not automatically run follow-up commands.

- `work` does not run `map`; refresh generated context with `map --write` when you choose to.
- `verify` does not execute tests; it prints targeted test commands, build commands, smoke checks, and manual checks for you to run.
- `done` records completed-work memory and repository learning signals, but it should not surprise users with broad automation.
- RCC outputs may recommend the next command, but the human or agent decides what to run.

Agent guidance:

- Run `rcc work "<task>" --agent` once at task start.
- Inspect `primaryFiles`, `tests`, and `supportingFiles` before broader search.
- Do not repeatedly rerun the same task route.
- If `tests` is empty, follow the `next` guidance; for tiny and small tasks RCC tells agents to open only the primary file and avoid adding generic tests when no strongly related tests were found.
- Use `rcc find "<keyword>"` only if the route is insufficient.
- Use `rcc impact "<task>" --json` when you need a compact estimate of affected files, tests, and verification commands.
- Use `rcc verify "<task>"` when you need a concrete verification plan from Impact results.
- Use `rcc done` after meaningful work.
- Use `rcc learn --write` when learned repository patterns need to be regenerated manually.
- Use `rcc handoff` when another session or agent needs to continue.
- When developing RCC itself, run `node dist/cli/index.js <command>` after `npm run build` so an older global `rcc` does not shadow the repo build. If `rcc doctor` or `rcc work "<task>" --agent` is unknown, update or relink the global install.

Agents should treat RCC output as navigation guidance, not proof. Source code remains the source of truth, and agents should verify source before editing.

## Manual vs Automatic

RCC does not run in the background, automatically edit source code, run commands, or automatically verify correctness. It gives deterministic context, routes, verification plans, and memory so humans and agents can work with less discovery overhead.

| Area | Manual action | Automatic RCC behavior |
| --- | --- | --- |
| `init` | Run the command when adopting RCC or adding the default CI workflow | Creates missing RCC templates and config; preserves existing manual content |
| `map --write` | Run after structural changes | Refreshes generated sections in `docs/ai-context/*` and warns if `AGENTS.md` needs `init --update` |
| `work` | Run once at task start and follow the route | Reads context and repo metadata to produce a compact task route |
| `impact` | Run when estimating change impact | Combines working-tree changes, task routing, learned test signals, and scored affected-test candidates |
| `verify` | Run when planning final checks | Builds a verification plan from Impact results; RCC prints commands and checks but does not execute them |
| `metrics` | Run only when diagnosing RCC task intelligence | Optionally summarizes existing Work, Measure, Impact, Verify, and freshness outputs without running a second independent repository analysis engine |
| `find` | Run only when the route is insufficient | Returns focused fallback file candidates with reasons |
| `done` | Record summary, changed files, and verification after meaningful work | Appends lightweight work memory for future handoff and routing |
| `learn` | Regenerate learned repository patterns on demand | Reads work memory, work index, and decisions to refresh `REPOSITORY_LEARNING.md` |
| `handoff` | Run when another session or agent needs to continue | Builds a continuation brief from recent work, decisions, and task route signals |
| `decision add` | Record durable project decisions intentionally | Stores decision memory in `docs/ai-context/DECISIONS.md` |
| `map --check` | Run locally or in CI to detect stale context | Exits non-zero when generated context needs refresh |
| CI workflow | Install with `init --github-action` and commit it | Runs RCC freshness checks during pull requests |
| Generated context files | Commit refreshed generated sections when useful | Rebuilds generated sections between RCC markers |
| Manual notes / decisions | Keep project knowledge in manual sections or decision memory | Preserves manual sections while generated sections can be refreshed |

## What RCC Does Not Do

RCC is not an AI coding agent, code generator, security scanner, replacement for tests or review, or background service.

## Agent Handover

Agents often restart without knowing what was completed, which files were touched, which decisions were made, or what should happen next. RCC can generate a continuation brief from repository memory.

Print a human-readable handoff brief:

```sh
rcc handoff
```

Print machine-readable handoff JSON:

```sh
rcc handoff --json
```

Route the handoff around a specific continuation task:

```sh
rcc handoff "continue workflow validation"
```

Print a compact agent handoff payload:

```sh
rcc handoff --agent
```

The handoff brief can include recent work summaries, touched files, verification notes, follow-ups, risks, relevant decisions, and task-aware next files.

## When to Use Handoff

Use `rcc handoff` for:

- long-running tasks
- switching between Codex sessions
- switching between AI agents
- resuming work the next day

## Token Saving Expectations

RCC is designed to reduce initial repository discovery context. In measured examples, RCC can reduce startup discovery context by roughly 70-99%, depending on repository size, context freshness, routing scope, and task specificity. Full-task savings are usually lower because the agent still needs to read source files, make changes, and verify behavior.

Measured examples can show large reductions, sometimes from hundreds of thousands of estimated naive-scan tokens to compact routes under a few hundred tokens. These are discovery and context-scope estimates, not guaranteed real model billing savings. Actual savings depend on repository size, context freshness, routing scope, task wording, and whether the agent follows the route.

## Measurement

Measure the difference between a naive repository scan and the RCC route for a task:

```sh
rcc measure "fix workflow risk detection"
```

Example output:

```text
RCC measurement

Task:
fix workflow risk detection

Naive scan estimate:
195,623 tokens

RCC agent route:
87 tokens

Primary files:
3

Supporting files:
0

Tests:
1

Files counted:
137

Files excluded:
42

Ignored by RCC rules:
18
Representative ignored paths:
Examples only; these are not necessarily full excluded directories.
docs/ai-context/archive

Unsupported or non-source files:
24
Representative unsupported paths:
Examples only; these are not necessarily full excluded directories.
package-lock.json

Skipped because scan cap was reached:
0
Representative scan-cap paths:
Examples only; these are not necessarily full excluded directories.
none

Estimated saving:
195,536 tokens (99.9%)
```

Token estimates are based on repository size, context freshness, and routing scope. Reported savings are discovery/context-scope estimates, not guarantees of real model billing savings.

JSON output is available for integrations:

```sh
rcc measure "fix workflow risk detection" --json
```

## Repository Metrics

Use `metrics` when you want an optional compact task-level quality snapshot of RCC's repository intelligence signals. It is a diagnostic command, not part of the required RCC workflow:

```sh
rcc metrics "fix workflow risk detection"
rcc metrics "fix workflow risk detection" --json
```

Metrics reuses existing RCC outputs instead of running a second independent repository analysis engine. It summarizes:

- `work` routing counts and task metadata
- `measure` discovery/context-scope token savings estimates
- map freshness from the work brief
- `impact` summary and confidence
- `verify` recommendation counts and confidence

The JSON output is intentionally compact and task-oriented. It contains numeric summaries under `routing`, `tokens`, `freshness`, `impact`, and `verification`, and does not include raw `work`, `impact`, or `verify` arrays such as affected files, targeted tests, manual checks, or command lists.

## Why RCC

Without RCC, an agent often scans many files before finding the relevant code, tests, workflows, configuration, and repository rules.

With RCC, the agent starts with:

- `primaryFiles`
- `tests`
- `supportingFiles`
- `readFirst`

and avoids broad repository exploration until necessary.

That saves context, time, and attention while still leaving the agent in control of source verification.

## Supporting Commands

The primary workflow is:

```text
init -> map -> work -> impact -> verify -> done -> handoff
```

Optional diagnostic command:

```text
metrics
```

The commands below support that workflow.

### Refresh Repository Maps

`map --write` analyzes real files with deterministic heuristics and updates generated sections in `docs/ai-context/*`. If `AGENTS.md` appears to contain older RCC guidance, it prints a warning instead of rewriting it automatically; run `npx repo-context-center@latest init --update` to refresh agent instructions safely.

```sh
npx repo-context-center map --write --max-files 300
```

Example output:

```text
repo-context-center map

Files scanned: 500
Mode: write

Updated files:
- docs/ai-context/TASK_ROUTING.md (updated)
- docs/ai-context/PROJECT_MAP.md (updated)
- docs/ai-context/HOTSPOTS.md (updated)

Detected:
- Task routing rows: 3
- Modules: 7
- Risks: 5
- Dependencies: 4
- Symbols: 6
- Hotspots: 7
```

Preview proposed generated context changes:

```sh
npx repo-context-center map --dry-run --max-files 300
```

Check whether generated context is stale:

```sh
npx repo-context-center map --check --max-files 300
```

Recommended `--max-files` values:

- Small and medium repos: `150`-`300`.
- Larger repos and monorepos: `500` or more, tuned to keep CI runtime acceptable.

### Find Focused Fallback Files

Use `find` when `rcc work` gives useful direction but the agent still needs a focused fallback before broad search:

```sh
npx repo-context-center find "decision command"
```

`find "<query>"` returns focused file candidates with short deterministic reasons. It prefers task-routing, filename, path, paired-test, and lightweight content signals while filtering noisy generated, fixture, snapshot, archive, and internal context paths.

### Analyze Change Impact

Use `impact` to estimate affected files, likely affected tests, and suggested verification commands from the current working tree plus a task description:

```sh
npx repo-context-center impact "update README wording" --json
```

Example output:

```json
{
  "schemaVersion": 1,
  "command": "impact",
  "task": "update README wording",
  "mode": "working-tree",
  "basis": "changed-files-and-task",
  "summary": {
    "changedFiles": 1,
    "contextChanges": 0,
    "affectedFiles": 1,
    "affectedTests": 0,
    "suggestedCommands": 0
  },
  "changedFiles": [
    {
      "path": "README.md",
      "reason": "changed in working tree"
    }
  ],
  "contextChanges": [],
  "affectedFiles": [
    {
      "path": "README.md",
      "reason": "changed in working tree"
    }
  ],
  "affectedTests": [],
  "suggestedCommands": [],
  "confidence": "medium",
  "confidenceExplanation": {
    "level": "medium",
    "reasons": [
      "changed files detected",
      "task routing matched",
      "no test relationship"
    ],
    "evidence": {
      "changedFiles": 1,
      "nonContextChangedFiles": 1,
      "contextChanges": 0,
      "affectedFiles": 1,
      "affectedTests": 0,
      "taskRoutingMatched": true,
      "filenameStemMatched": false,
      "contextOnlyChanges": false,
      "testRelationship": "none"
    }
  },
  "verificationHints": [],
  "notes": [
    "Heuristic MVP: combines git working-tree changes, RCC task routing, learned test signals, and scored affected test candidates.",
    "This is not a full static dependency analysis.",
    "Docs-only impact detected; no focused test command suggested."
  ]
}
```

Use `--task-only` to estimate impact from the task route without reading current git changes:

```sh
npx repo-context-center impact "fix login regression" --task-only --json
```

Impact analysis is intentionally heuristic, not a static dependency engine. It uses git working-tree changes, RCC task routing, learned test signals, and confidence-scored affected test candidates. In `--task-only` mode, the `mode` field is `task-only`, `changedFiles` is empty, and the analysis is based on the task route.

Affected test entries include `score`, `confidence`, and `signals` fields in JSON output. Test recommendations can combine signals such as changed test file, same directory, same package/module, filename similarity, imports of affected source, repository learning, task routing evidence, and co-change history. RCC filters weak generic route-only tests and reports only candidates above the confidence threshold.

RCC setup and agent-context changes such as `docs/ai-context/**`, `.repo-context-center/**`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/**`, and `.github/copilot-instructions.md` are reported under `contextChanges` instead of `affectedFiles`. For docs-only changes such as `README.md`, `docs/**`, and Markdown wording updates, RCC keeps the impact focused and avoids broad `npm test` fallback unless source, package, workflow, or known tests are also affected.

### Plan Verification

Use `verify` to turn Impact Analysis into a concrete verification plan:

```sh
rcc verify "fix login bug"
rcc verify "fix login bug" --json
rcc verify "fix login bug" --task-only --json
```

Verify Intelligence reuses Impact as the source of truth for affected files and tests. It organizes the result into:

- `targetedTests`: focused tests from `impact.affectedTests`.
- `targetedTestCommands`: test commands from `impact.suggestedCommands`.
- `buildCommands`: build commands suggested by Impact.
- `smokeChecks`: broader verification commands when Impact provides them.
- `manualChecks`: affected-file, context-change, and verification-hint checks for humans or agents to inspect.
- `validationChecklist`: compact checklist items for completing the task responsibly.

RCC does not run these commands automatically. `rcc verify` prints the plan so a human or agent can choose and run the appropriate project commands, then record the actual result with `rcc done --verify`.

### Validate Installation

Validate installed context files:

```sh
npx repo-context-center validate
npx repo-context-center validate --strict
```

Validation accepts either an `AGENTS.md` pointer to `docs/ai-context/RCC_WORKFLOW.md` or complete fallback guidance directly in `AGENTS.md`. Fallback guidance should tell agents to read `TASK_ROUTING.md` and `DO_NOT_READ.md`, use `TOKEN_BUDGET.md` only when needed, inspect a small number of likely files, and avoid broad repository scans when RCC commands are unavailable.

### Record Completed Work

Use `done` after meaningful agent work:

```sh
npx repo-context-center done --summary "fixed auth routing" --files auto --verify "npm test"
```

`done` also refreshes repository learning so future `work` and `handoff` output can include learned file relationships, likely tests, verification patterns, and repository habits.

### Regenerate Repository Learning

Use `learn` when you want to inspect or refresh learned repository patterns without recording new completed work:

```sh
npx repo-context-center learn
npx repo-context-center learn --write
npx repo-context-center learn --json
npx repo-context-center learn --debug
```

`learn --write` updates `docs/ai-context/REPOSITORY_LEARNING.md`. `learn --json` returns the same learned model for integrations, and `learn --debug` shows source counts and ignored entries.

### Prepare Agent Handover

Use `handoff` when work needs to continue in another session or with another agent:

```sh
npx repo-context-center handoff
npx repo-context-center handoff --json
npx repo-context-center handoff "continue workflow validation"
npx repo-context-center handoff --agent
```

### Estimate Broader Context Costs

`measure` is the task-first command for route-vs-naive task estimates:

```sh
npx repo-context-center measure "fix login bug"
```

`estimate` is the broader context-cost command for installed files, startup context, and comparison scenarios. Use `estimate`, not `measure`, with `--compare-naive`:

```sh
npx repo-context-center estimate --compare-naive
npx repo-context-center estimate --task "fix login bug"
npx repo-context-center estimate --json
```

### Inspect Repository Metrics

`metrics` is an optional diagnostic command, not a required workflow step. It summarizes RCC's existing Work, Measure, Impact, Verify, and freshness outputs without running a second independent repository analysis engine:

```sh
npx repo-context-center metrics "fix login bug"
npx repo-context-center metrics "fix login bug" --json
```

### Integrations And JSON

Use `work --agent` for the compact route:

```sh
npx repo-context-center work "improve package scripts" --agent
```

When no strongly related tests are found, `work --agent` keeps `tests` empty and tells the agent not to add generic tests. Tiny and small task routes also bias toward opening only the primary file before editing.

Use `work --json` when an agent or tool needs the full work brief in a stable machine-readable shape:

```sh
npx repo-context-center work "improve package scripts" --json
npx repo-context-center work "improve package scripts" --json --context-budget minimal
```

Use `impact --json` when a tool needs affected files, tests, suggested commands, command metadata, confidence, and compact notes:

```sh
npx repo-context-center impact "fix login regression" --json
npx repo-context-center impact "fix login regression" --task-only --json
```

Use `verify --json` when a tool needs the stable VerificationPlan contract:

```sh
npx repo-context-center verify "fix login regression" --json
npx repo-context-center verify "fix login regression" --task-only --json
```

`verify --json` is intended for long-lived integrations. Treat the contract in layers:

- Stable: top-level fields `schemaVersion`, `command`, `task`, `mode`, `summary`, `targetedTests`, `targetedTestCommands`, `buildCommands`, `smokeChecks`, `manualChecks`, `validationChecklist`, `confidence`, `confidenceExplanation`, and `notes`; summary count fields; path, command, type, scope, confidence, and priority fields inside recommendation objects.
- Compact informational wording: `reason`, `confidenceExplanation.reasons`, and `notes` help humans and agents understand the recommendations. They stay short and high-level, but integrations should display them rather than parse exact wording.
- Internal and intentionally omitted: execution plans, estimated minutes, coverage percentages, verification scores, raw Impact collections such as `affectedFiles`, `affectedTests`, `suggestedCommands`, `changedFiles`, `contextChanges`, routing evidence, domain-match internals, and scoring implementation details.

Integrations should execute or display the stable command/path/check data and avoid depending on long reason strings or heuristic explanation text.

Use `metrics --json` when a tool needs compact RepositoryMetrics for optional diagnostics:

```sh
npx repo-context-center metrics "fix login regression" --json
```

`metrics --json` is a summary contract, not a raw data export. Stable top-level fields are `schemaVersion`, `command`, `task`, `ecosystem`, `routing`, `tokens`, `freshness`, `impact`, and `verification`. The nested objects contain counts, confidence values, freshness status, detected ecosystem summaries, and discovery/context-scope token-saving estimates. Raw arrays from Work, Impact, and Verify are intentionally omitted.

Use `handoff --json` or `handoff --agent` when a tool needs continuation context:

```sh
npx repo-context-center handoff --json
npx repo-context-center handoff --agent
```

Use `suggest --json` when integrating RCC recommendations into another tool:

```sh
npx repo-context-center suggest "fix auth login bug" --json
```

Use `scan --json` to inspect only repository layout and lightweight context suggestions:

```sh
npx repo-context-center scan --json
```

### Archive And Decisions

Archive older long-running notes:

```sh
npx repo-context-center archive --keep 50
```

Archiving keeps work memory compact and refreshes repository learning from the remaining indexed history.
`done` also performs this compaction automatically when `WORK_LOG.md` grows beyond 100 entries,
keeping the newest 50 entries in the live file and moving older entries into the excluded archive.

Preserve durable project decisions:

```sh
npx repo-context-center decision add "Keep AGENTS.md compact" --reason "Reduce startup token overhead" --files AGENTS.md
npx repo-context-center decision list
npx repo-context-center decision search "agents"
```

### Lower-Level Commands

`start` and `log` remain available for lower-level workflows:

```sh
npx repo-context-center start "fix auth bug"
npx repo-context-center log "Fixed auth routing" --files src/auth.ts,tests/auth.test.ts
```

Prefer `rcc work`, `rcc done`, and `rcc handoff` for new agent workflows.

## Command Reference

Primary workflow:

```text
init -> map -> work -> impact -> verify -> done -> handoff
```

Optional diagnostics: `metrics`, `measure`, `estimate`, `scan`.

### Core agent workflow

```sh
repo-context-center work "<task>" [--agent] [--json] [--context-budget minimal|balanced|deep] [--max-files <number>]
```

### Setup and validation

```sh
repo-context-center init [--dry-run] [--force] [--update] [--update-agent-file] [--github-action]
repo-context-center map [--write] [--check] [--dry-run] [--json] [--max-files <number>]
repo-context-center validate [--strict]
```

### Impact and verification

```sh
repo-context-center impact "<task>" [--json] [--task-only] [--max-files <number>]
repo-context-center verify "<task>" [--json] [--task-only] [--planned] [--level minimal|balanced|deep]
```

### Memory and handoff

```sh
repo-context-center done --summary "<summary>" [--files auto|none|"<path,path>"] [--verify "<command/result>"] [--dry-run]
repo-context-center learn [--json] [--write] [--debug]
repo-context-center handoff [task] [--json|--agent] [--debug] [--write]
repo-context-center decision add "<decision>" --reason "<reason>" [--status <status>] [--files <path,path>]
repo-context-center decision list
repo-context-center decision search "<query>"
```

### Lookup and diagnostics

```sh
repo-context-center find "<query>" [--limit <number>]
repo-context-center metrics "<task>" [--json]
repo-context-center measure "<task>" [--json]
repo-context-center estimate [--mode compact|investigation|detailed] [--task "<task>"] [--compare-naive] [--json] [--max-files <number>]
repo-context-center scan [--json]
repo-context-center doctor
repo-context-center --help
repo-context-center --version
```

### Maintenance and lower-level commands

```sh
repo-context-center archive [--keep <number>] [--dry-run]
repo-context-center suggest "<task>" [--json] [--symbols] [--max-files <number>]
repo-context-center start "<task>" [--max-files <number>] [--copy]
repo-context-center log "<summary>" [--files <path,path>] [--dry-run]
```

| Command | Purpose | When to use |
| --- | --- | --- |
| `init` | install RCC repository instructions and context templates | once per repo |
| `map --write` | refresh generated repo maps | after structure changes |
| `work --agent` | print the compact agent route | once at task start |
| `impact` | estimate affected files, tests, and verification commands | before or after a change |
| `verify` | build a verification plan from Impact results | before final checks or review |
| `find` | locate focused candidate files | only if the route is insufficient |
| `measure` | task-first route-vs-naive estimate | when evaluating routing efficiency for one task |
| `metrics` | summarize route, discovery savings estimates, freshness, impact, and verification signals | optional diagnostic when inspecting RCC performance for one task |
| `done` | save completed-work memory | after meaningful agent work |
| `learn` | regenerate repository learning | after memory edits, archive maintenance, or before release checks |
| `handoff` | prepare a continuation brief | when work continues in another session or agent |
| `validate` | check required context files | setup and CI |
| `map --check` | detect stale generated maps | CI / PRs |
| `archive` | keep long-running notes compact | periodic maintenance |
| `estimate` | estimate installed context, startup cost, and naive comparisons | evaluation and debugging |
| `decision` | record durable project decisions | architecture/workflow decisions |
| `suggest` | get recommendations or JSON | tooling and integrations |
| `scan` | inspect repo layout | diagnostics |
| `start` | print a lower-level startup prompt | specialized workflows |
| `log` | add a lower-level change log entry | specialized workflows |

## CI / Keeping Context Fresh

RCC does not run in the background. Generated context changes only when commands such as `map --write` are run.

Refresh generated context after significant structure changes, such as:

- new source roots;
- renamed modules;
- new CLI entrypoints;
- changed test layout;
- updated build or config files;
- new generated-output locations;
- changed package scripts.

Use `map --check` in CI to fail pull requests when generated context files are stale:

```yaml
name: Repository Context Check

on:
  pull_request:

jobs:
  context-check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Check generated context is fresh
        run: npx repo-context-center map --check --max-files 300
```

Ecosystem CI examples can keep the RCC steps identical while the project setup changes around them.

Node:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm install -g repo-context-center@latest
- run: rcc map --check
- run: rcc work "review pull request impact" --agent
- run: rcc impact "review pull request impact" --json
- run: rcc verify "review pull request impact"
- run: rcc metrics "review pull request impact" --json
  if: always()
```

Java Maven:

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

Java Gradle:

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

Python:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
- run: npm install -g repo-context-center@latest
- run: rcc map --check
- run: rcc work "review python service change" --agent
- run: rcc impact "review python service change" --json
- run: rcc verify "review python service change"
- run: rcc metrics "review python service change" --json
  if: always()
```

Go:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- uses: actions/setup-go@v5
  with:
    go-version: "1.22"
- run: npm install -g repo-context-center@latest
- run: rcc map --check
- run: rcc work "review go service change" --agent
- run: rcc impact "review go service change" --json
- run: rcc verify "review go service change"
- run: rcc metrics "review go service change" --json
  if: always()
```

Monorepo:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm install -g repo-context-center@latest
- run: rcc map --check --max-files 500
- run: rcc work "review workspace change" --agent
- run: rcc impact "review workspace change" --json
- run: rcc verify "review workspace change"
- run: rcc metrics "review workspace change" --json
  if: always()
```

If CI fails, refresh generated sections locally:

```sh
npx repo-context-center map --write --max-files 300
```

Then commit the updated `docs/ai-context/*` files.

If the output says `AGENTS.md appears outdated`, refresh it separately:

```sh
npx repo-context-center@latest init --update
```

Commit `AGENTS.md` too when `init --update` changes it.

Install the default PR validation workflow:

```sh
npx repo-context-center init --github-action
```

## Installed Files

`repo-context-center init` installs generic templates:

- `AGENTS.md`
- `docs/ai-context/COMMUNICATION_MODE.md`
- `docs/ai-context/TASK_ROUTING.md`
- `docs/ai-context/MODULE_INDEX.md`
- `docs/ai-context/PROJECT_MAP.md`
- `docs/ai-context/RISK_REGISTER.md`
- `docs/ai-context/DEPENDENCY_MAP.md`
- `docs/ai-context/SYMBOL_MAP.md`
- `docs/ai-context/TOKEN_BUDGET.md`
- `docs/ai-context/DO_NOT_READ.md`
- `docs/ai-context/HOTSPOTS.md`
- `docs/ai-context/LESSONS_LEARNED.md`
- `docs/ai-context/REPOSITORY_LEARNING.md`
- `docs/ai-context/CHANGE_LOG.md`
- `docs/ai-context/archive/`

It also creates `.repo-context-center/config.json`.

`repo-context-center map --write` may update generated sections in:

- `docs/ai-context/TASK_ROUTING.md`
- `docs/ai-context/MODULE_INDEX.md`
- `docs/ai-context/PROJECT_MAP.md`
- `docs/ai-context/RISK_REGISTER.md`
- `docs/ai-context/DEPENDENCY_MAP.md`
- `docs/ai-context/SYMBOL_MAP.md`
- `docs/ai-context/HOTSPOTS.md`
- `docs/ai-context/TOKEN_BUDGET.md`
- `docs/ai-context/DO_NOT_READ.md`
- `docs/ai-context/CHANGE_LOG.md`

Use `repo-context-center init --update` to refresh RCC-managed agent workflow guidance in `AGENTS.md` while preserving manual sections.

Use `repo-context-center init --update-agent-file` when only the root `AGENTS.md` workflow block should be refreshed. RCC leaves other AI instruction files such as `CLAUDE.md`, `GEMINI.md`, `.cursor/rules`, `.github/copilot-instructions.md`, and `.windsurf/rules` byte-for-byte unchanged and reports them as detected but not modified.

Use `repo-context-center doctor` when local and global RCC commands are confusing. It distinguishes active CLI problems that need action from a harmless older nearest local install when the active CLI is otherwise healthy.

`repo-context-center done`, `repo-context-center archive`, and `repo-context-center learn --write` may update:

- `docs/ai-context/WORK_LOG.md`
- `docs/ai-context/WORK_INDEX.md`
- `docs/ai-context/REPOSITORY_LEARNING.md`

With `--github-action`, init also creates:

- `.github/workflows/repo-context-check.yml`

## Roadmap

| Capability | Status |
| --- | --- |
| Generic context installation | Available |
| Agent work route | Available |
| Repository understanding | Available |
| Task routing | Available |
| Task measurement | Available |
| Startup context | Available |
| Decision memory | Available |
| Work tracking | Available |
| Repository learning | Available |
| Agent handover | Available |
| Impact analysis | Available |
| Task-only impact mode | Available |
| Verify intelligence | Available |
| Repository metrics | Available |
| Scored affected-test recommendations | Available |
| Explainable recommendation reasons | Available |
| Targeted fallback search | Available |
| Token estimation | Available |
| Stale context detection | Available |
| CI freshness check | Available |
| Durable work logs and decision memory | Available |
| Context archiving | Available |
| Richer import graph | Planned |
| Better framework detection | Planned |
| Safer merge/update UX | Planned |
| Project-specific packs | Planned |
| Historical context analytics | Planned |

## Development

```sh
npm install
npm run build
npm test
```

## Manual Release

This package is prepared for manual npm publishing.

```sh
npm run release:check
npm publish
```

The package publishes the compiled `dist/` output, including the generic context templates copied during build. `prepublishOnly` runs build and tests before a manual `npm publish`.
