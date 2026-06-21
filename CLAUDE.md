# CLAUDE.md

## Stack: TypeScript, React, JSON, Python — nothing else by default

Approved stack: **TypeScript** (incl. React/TSX), **JSON**, **Python**. No other language, runtime, or config format unless the task is _impossible_ in these — a hard external constraint (vendor SDK only ships in X, platform only accepts Y), not preference.

- Bash: throwaway one-liners only. Anything reusable is TS or Python.
- Config the repo owns: JSON. Not YAML, TOML, INI.
- No Go, Ruby, Java, C#, Swift, Kotlin for new code.
- No invented DSLs or templating languages to dodge writing TS / Python.

Necessary boundaries don't count: SQL, `Dockerfile`, HTML/CSS shipped through React, the one required CI YAML. Use them; don't expand them. Anything past that bar — surface the hard constraint and the in-stack alternative you ruled out, before writing.

## Hosting: GitHub

This repo is hosted on **GitHub**: `heilashahidi/genetic-algo-llm-testing`.

- Remote: `origin` — `https://github.com/heilashahidi/genetic-algo-llm-testing.git`.
- The `gh` CLI is installed and **already authenticated**.
  Use it for all GitHub work; do not author GitHub Actions unless explicitly asked.
