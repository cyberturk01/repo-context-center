# Python Repositories

RCC works in Python repositories as repository intelligence for AI coding agents. It helps agents find likely files, estimate impact, and choose sensible verification steps. RCC does not execute Python commands, run pytest, collect coverage, score QA, or manage project work.

## Quickstart

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update account service" --agent
rcc impact "update account service" --json
rcc verify "update account service"
rcc metrics "update account service" --json
```

Use the `work` output to decide what the agent should read first. Use `verify` as a recommendation plan, then run the project command you choose yourself. After meaningful work, record the actual result:

```sh
rcc done --summary "updated account service" --files auto --verify "pytest"
```

## Detection

RCC recognizes common Python repository signals:

- `pyproject.toml`
- `requirements.txt`
- `setup.py`
- `pytest.ini`

`pyproject.toml` and `requirements.txt` are enough for RCC to identify a Python repository. Pytest-specific configuration or dependency text helps `rcc verify` prefer `pytest`; otherwise it uses the conservative `python -m pytest` fallback.

## pyproject.toml

A minimal project can be detected from `pyproject.toml`:

```toml
[project]
name = "orders-api"
version = "0.1.0"
```

Pytest-oriented projects can include pytest configuration:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
```

With pytest signals, `rcc verify` may recommend:

```sh
pytest
```

## requirements.txt

RCC also detects Python repositories from `requirements.txt`:

```txt
fastapi
uvicorn
```

When `requirements.txt` includes pytest, RCC treats it as a pytest-oriented signal:

```txt
fastapi
uvicorn
pytest
```

Without a pytest signal, `rcc verify` may recommend:

```sh
python -m pytest
```

## Pytest Usage

RCC does not run pytest. It can recommend pytest commands when repository signals and Impact results do not already provide a stronger focused command.

Typical flow:

```sh
rcc work "fix password reset validation" --agent
rcc impact "fix password reset validation" --json
rcc verify "fix password reset validation"
pytest
rcc done --summary "fixed password reset validation" --files auto --verify "pytest"
```

## FastAPI Example

FastAPI projects often use `pyproject.toml` or `requirements.txt` plus tests:

```text
pyproject.toml
app/main.py
tests/test_main.py
```

RCC should route agents toward the affected backend files and likely tests. Backend-only FastAPI tasks should not receive generic frontend smoke checks just because a task mentions UI-facing behavior.

Example RCC flow:

```sh
rcc work "fix FastAPI account route validation" --agent
rcc impact "fix FastAPI account route validation" --json
rcc verify "fix FastAPI account route validation"
```

## Flask Example

Flask projects can use the same RCC flow:

```text
requirements.txt
flask_app/routes.py
tests/test_routes.py
```

Example:

```sh
rcc work "fix Flask login route error handling" --agent
rcc impact "fix Flask login route error handling" --json
rcc verify "fix Flask login route error handling"
```

RCC suggests repository context and verification steps; Flask remains responsible for application behavior and your test runner remains responsible for executing tests.

## Python Monorepos

In workspace-style repositories, RCC can detect Python packages under common roots such as:

```text
services/api/pyproject.toml
services/worker/requirements.txt
packages/shared/setup.py
```

When affected files sit under a detected Python package root, `rcc verify` prefers that package ecosystem over task wording alone. Keep generated folders, virtual environments, and caches such as `.venv/`, `dist/`, `build/`, and `.pytest_cache/` out of agent reading paths through RCC context guidance.

## GitHub Actions

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

This workflow installs RCC, checks generated context freshness, prints route and impact guidance, and emits a verification plan. It does not run Python tests unless you add your own test step.
