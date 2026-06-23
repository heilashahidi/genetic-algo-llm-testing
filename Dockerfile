FROM python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app/src
ENV PYTHONUNBUFFERED=1

COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt

# src/ contains both the GA core (src/ga/) and the API (src/api/).
COPY src/ src/
COPY scripts/ scripts/
COPY tests/ tests/
# migrations/ is required by scripts/migrate.py (apply_migrations reads
# /app/migrations/*.sql via storage_postgres.migrations_dir()).
COPY migrations/ migrations/
COPY documentation/attack_library/ documentation/attack_library/
COPY experiments/configs/ experiments/configs/

RUN mkdir -p experiments

# Neutral entrypoint: one image, many roles. Each compose service overrides the
# command -- uvicorn for the API, scripts/run_ga.py --worker for the runner,
# scripts/migrate.py for migrations. The default CMD keeps the offline dry-run
# smoke test working with a bare `docker run <image>` (no Postgres required).
ENTRYPOINT ["python"]
CMD ["scripts/run_ga.py", "--dry-run", "--generations", "2", "--population", "12"]
