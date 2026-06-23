# genetic-algo-llm-testing

A genetic-algorithm harness for evolving adversarial prompts against a target
LLM, with a Postgres-backed control plane and an HTTP API.

## Running the stack

```bash
cp .env.example .env
docker compose up --build
```

This brings up **postgres → migrate (one-shot) → api + runner**. The API is at
<http://localhost:8000>. ollama stays external by default (use
`docker compose --profile with-ollama up` to run it containerized).

See [documentation/running_locally.md](documentation/running_locally.md) for the
full walkthrough: creating/starting runs via the API, polling generations, the
`with-ollama` profile, the offline `ga-dry-run`/`test` smoke services, and the
`DATABASE_URL`-gated integration tests.
