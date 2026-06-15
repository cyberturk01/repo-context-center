# Architecture

Repo Context Center is organized around a TypeScript CLI and a small set of core modules that inspect a repository, classify files, and render context artifacts.

## CLI Entry

The CLI entrypoint lives under `src/cli`. It parses commands and delegates to command modules for workflows such as `init`, `map`, `scan`, `suggest`, `start`, `estimate`, `archive`, and `validate`.

## Repo Scanning

Repository scanning logic lives in `src/core/scanner.ts` and related core utilities. It walks project files, applies ignore and classification rules, and provides the raw repository inventory used by other commands.

## Map Generation

Map generation is handled by core mapping and repository-understanding modules such as `repoMapper`, `repoFileClassifier`, `repositoryUnderstanding`, and symbol-related logic. These modules turn file inventories into compact summaries of project structure, hotspots, symbols, and dependency hints.

## Task-Aware Routing

Task-aware routing is centered on `src/core/suggester.ts`. It maps a user task to relevant context files and repository areas so an AI coding agent can load the most useful information first.

## Startup Context

Startup context generation is centered on `src/core/startPrompt.ts` and related context-reading helpers. It produces the initial orientation content an agent can use before making edits.

## Renderers

Rendering modules are responsible for producing the final user-facing output formats, including Markdown-oriented context artifacts and CLI output.

## Docs and Templates

Documentation lives under `docs`, and reusable context templates live under `src/templates` and `templates`. The build copies template assets into `dist` so the published CLI can install and generate context files for other repositories.
