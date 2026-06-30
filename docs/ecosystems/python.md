# Python Repositories

RCC works in Python repositories as repository intelligence for AI coding agents. It helps route an agent to likely files, estimate impact, and suggest verification commands; it does not run tests or become a QA platform.

## Detection

RCC recognizes common Python signals:

- `pyproject.toml`
- `requirements.txt`
- `setup.py`
- `pytest.ini`

## Verify Defaults

When Impact does not already provide a stronger targeted command, `rcc verify` may suggest:

- `pytest` when pytest-oriented signals are present.
- `python -m pytest` as a conservative Python fallback.

RCC still prefers affected files and detected repository signals over task wording alone.

## Local Adoption

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update account service" --agent
rcc impact "update account service" --json
rcc verify "update account service"
```

After running the checks you choose, record the actual result:

```sh
rcc done --summary "updated account service" --files auto --verify "pytest"
```

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
