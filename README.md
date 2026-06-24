# genetic-algo-llm-testing

A genetic-algorithm harness for evolving adversarial prompts against a target
LLM, with a Postgres-backed control plane and an HTTP API.

## Quick start

Prerequisites: **Docker** + **Docker Compose v2**. (A reachable ollama / any
OpenAI-compatible server is needed only for real LLM runs; you can start with
the mock dry-run path.)

```bash
git clone https://github.com/heilashahidi/genetic-algo-llm-testing.git
cd genetic-algo-llm-testing
cp .env.example .env
docker compose up --build
```

This brings up **postgres → migrate (one-shot) → api + runner + frontend**. Open
the dashboard at <http://localhost:3000> (API at <http://localhost:8000>). ollama
stays external by default (use `docker compose --profile with-ollama up` to run
it containerized).

**Fresh start = empty database.** There is no seeding step: `migrate` only
creates empty tables. The 121 seed attacks (`documentation/attack_library/data/
genomes.jsonl`) and the genome schema (`genome_schema.json`) are repo files baked
into the image; the database fills with run data as a side effect of starting a
run. See "How seed data and the database work" in the guide below.

See [documentation/running_locally.md](documentation/running_locally.md) for the
full walkthrough: prerequisites, creating/starting runs (dashboard or API),
polling generations, the Genome editor, the `with-ollama` profile, the offline
`ga-dry-run`/`test` smoke services, and the `DATABASE_URL`-gated integration
tests.
