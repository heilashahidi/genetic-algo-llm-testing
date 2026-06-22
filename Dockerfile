FROM python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app/src
ENV PYTHONUNBUFFERED=1

COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/
COPY scripts/ scripts/
COPY tests/ tests/
COPY documentation/attack_library/ documentation/attack_library/
COPY experiments/configs/ experiments/configs/

RUN mkdir -p experiments

ENTRYPOINT ["python", "scripts/run_ga.py"]
CMD ["--dry-run", "--generations", "2", "--population", "12"]
