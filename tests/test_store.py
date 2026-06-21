from ga.model_client import FakeModelClient
from ga.policy import TARGET_QUERIES, V1_POLICY
from ga.search import run_genetic
from ga.store import read_records


def test_every_evaluation_persists_a_valid_record(tmp_path):
    path = tmp_path / "records.jsonl"
    recs = run_genetic(
        client=FakeModelClient(V1_POLICY),
        policy=V1_POLICY,
        target=TARGET_QUERIES["reveal_token"],
        run_id="t",
        generations=3,
        pop_size=5,
        seed=1,
        store_path=path,
    )
    loaded = read_records(path)
    assert len(loaded) == len(recs) == 15
    for r in loaded:
        assert r.search == "genetic"
        assert r.genome_id == r.genome.genome_id
        assert 0.0 <= r.fitness <= 1.0
        assert r.outcome in ("violation", "partial", "refusal", "malformed")
        assert r.rendered_prompt.strip()
        assert r.policy_id == V1_POLICY.policy_id
