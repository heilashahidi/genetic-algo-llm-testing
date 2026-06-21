from pathlib import Path

from .contract import ResultRecord

# Append-only JSONL — the only persisted store (PRD §3.2). Every aggregation the
# dashboard shows is derived from these records.


def append_record(path: str | Path, record: ResultRecord) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as f:
        f.write(record.model_dump_json() + "\n")


def read_records(path: str | Path) -> list[ResultRecord]:
    text = Path(path).read_text(encoding="utf-8")
    return [ResultRecord.model_validate_json(line) for line in text.splitlines() if line.strip()]
