# Running the stack locally

The whole system runs as a `docker compose` stack: **Postgres + migrate +
API + runner worker + frontend dashboard**. `ollama` is external by default
(reached on `host.docker.internal`); an optional containerized `ollama` is
available behind a compose profile.

## Prerequisites

- **Docker** + **Docker Compose v2** (`docker compose ...`) — all you need to
  run the full stack.
- A reachable **ollama** (or any OpenAI-compatible) server for real LLM runs.
  You can start with no LLM at all via the mock dry-run path.
- **Node 20+** only if you want to run the frontend dev server outside Docker.

## Get the code

```bash
git clone https://github.com/heilashahidi/genetic-algo-llm-testing.git
cd genetic-algo-llm-testing
```

## How seed data and the database work (read once)

There is **no database seeding step — Postgres starts empty.**

- The 121 attack genomes live in a repo file,
  `documentation/attack_library/data/genomes.jsonl` (baked into the app image).
  They are the GA's starting population, not database rows.
- `migrate` applies `migrations/*.sql`, which only **create empty tables**
  (`experiments`, `runs`, `generations`, `individuals`, `schema_drafts`). No
  attack data is inserted.
- The genome **schema** also starts from a file (`genome_schema.json`):
  `GET /schema` falls back to it until you save an edit in the Genome editor
  (which writes the single `schema_drafts` row).
- When you **start a run**, the runner reads `genomes.jsonl`, re-encodes the
  seeds against that run's schema snapshot, and writes them as generation 0.
  The database fills with run data **as a side effect of running** — there is
  nothing to import.

## 1. Configure

```bash
cp .env.example .env
```

Edit `.env` if needed. Defaults wire the stack to the in-network Postgres
(`postgresql://ga:ga@postgres:5432/ga`) and an ollama on the host
(`http://host.docker.internal:11434/v1`).

> **Wiring note (read this).** The GA runner does **not** consume the `LLM_*` /
> `OLLAMA_*` env vars yet. The target provider, base URL and model are read from
> the **experiment config** (the `harness` block) stored in the database — i.e.
> from the JSON you `POST /experiments`. The env vars are the single documented
> place a future "env → config defaults" wiring will read from; they are already
> injected into the `runner` container so that wiring needs no compose change.
> For now, set `harness.provider` / `harness.base_url` / `harness.model` in the
> config you submit (see the example below).

## 2. Bring up the stack

```bash
docker compose up --build
```

Startup order is enforced by health/completion conditions:

1. `postgres` becomes healthy (`pg_isready`).
2. `migrate` runs `scripts/migrate.py` once and exits (applies `migrations/*.sql`).
3. `api` (uvicorn on `:8000`), `runner` (`run_ga.py --worker`), and `frontend`
   (nginx on `:3000`) start.

Then open the **dashboard at <http://localhost:3000>** (API at
<http://localhost:8000>, `GET /health` → `{"status":"ok"}`). The easiest way to
drive everything — create/start/stop runs, watch the lineage tree, explore
alleles, and edit the genome schema — is the dashboard; the API calls below are
the equivalent if you prefer curl.

> **Port conflicts.** If `5432`, `8000`, or `3000` are already in use on your
> machine, set `POSTGRES_PORT`, and/or `FRONTEND_PORT` (and edit the `api` port)
> in `.env` before `docker compose up`.

## 3. Create and start a run via the API

Create an experiment (the `config` is validated against `ExperimentConfig`).
Omitted fields use the built-in defaults — including the synthetic policy that
guards a secret passphrase the model must not reveal — so you only set what you
want to change. The zero-dependency smoke (no LLM needed) uses the mock harness:

```bash
curl -s -X POST http://localhost:8000/experiments \
  -H 'content-type: application/json' \
  -d '{
        "name": "smoke",
        "config": {
          "dry_run": true,
          "ga": {"population_size": 10, "max_generations": 2},
          "harness": {"provider": "mock"}
        }
      }'
# -> {"experiment_id": "<exp-id>"}
```

For a **real run**, drop `dry_run`/mock and point `harness` at your LLM:

```bash
"harness": {
  "provider": "ollama",
  "base_url": "http://host.docker.internal:11434/v1",
  "model": "mistral:7b-instruct"
}
```

The schema snapshot, target query, and fitness policy come from the defaults
unless overridden; edit genes/alleles in the dashboard's **Genome** tab to
change what prompts the GA can build.

Enqueue a run (the `runner` worker will claim and execute it):

```bash
curl -s -X POST http://localhost:8000/experiments/<exp-id>/runs
# -> {"run_id": "<run-id>", "status": "queued"}
```

## 4. Poll progress

```bash
curl -s http://localhost:8000/runs/<run-id>                 # status, current_generation
curl -s http://localhost:8000/runs/<run-id>/generations     # per-generation metrics
curl -s "http://localhost:8000/runs/<run-id>/individuals?generation=1"
```

Control a run: `POST /runs/<run-id>/pause`, `/resume`, `/stop`.

## 5. Containerized ollama (optional)

By default ollama is external. To run it inside the stack instead:

```bash
docker compose --profile with-ollama up
```

This starts the `ollama/ollama` container on `:11434` with a persistent volume.
Point the experiment config's `harness.base_url` at `http://ollama:11434/v1`
(the in-network service name) when using this profile, and `docker compose exec
ollama ollama pull <model>` to fetch the model.

## 6. Offline smoke tests (no Postgres)

The pre-existing offline path still works and needs no database:

```bash
docker compose run --rm ga-dry-run   # mock harness, synthetic fitness
docker compose run --rm test         # pytest tests/ga/ -q
```

## 7. DATABASE_URL-gated integration tests

Some tests are skipped unless a real Postgres is reachable. With the stack up
(Postgres exposed on `localhost:5432`):

```bash
DATABASE_URL=postgresql://ga:ga@localhost:5432/ga python -m pytest tests/ -q
```

## 8. Frontend dashboard

A React + Vite + TypeScript dashboard (in `frontend/`) drives the control-plane
API: create runs, monitor status, watch fitness charts, and inspect individuals.

### Dev server

```bash
cd frontend
npm install
npm run dev          # serves on http://localhost:5173
```

The dashboard reads the API base URL from `VITE_API_BASE_URL` (default
`http://localhost:8000`). If the API is elsewhere, set it before starting dev:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

A production build (what Docker serves) is verified with:

```bash
npm run build        # tsc typecheck + vite build -> frontend/dist
```

### Via docker compose

`docker compose up` now also builds and serves the dashboard at
**http://localhost:3000** (the `frontend` service, nginx serving the static
bundle). `VITE_API_BASE_URL` is baked in at build time, so it is the URL the
**browser** uses to reach the API — override it (and `FRONTEND_PORT`) in `.env`
if the API is not on `http://localhost:8000`. After changing it, rebuild:

```bash
docker compose up --build frontend
```
