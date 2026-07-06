# Flask RCC Example

Minimal Flask-shaped repository example for adopting RCC.

```sh
npx repo-context-center@latest init
npx repo-context-center@latest map --write
rcc work "update login route" --agent
rcc impact "update login route" --json
rcc verify "update login route"
rcc metrics "update login route" --json
```

`rcc verify` may recommend `pytest` when pytest is present in Python signals, or `python -m pytest` for generic Python projects. RCC recommends context and checks; it does not run Flask or pytest.
