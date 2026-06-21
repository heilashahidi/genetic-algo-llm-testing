from .contract import Genome, ResultRecord, Search
from .fitness import score
from .model_client import ModelClient
from .policy import Policy, TargetQuery
from .render import render

# One evaluation: genome → render → model → fitness → record (PRD §4 pipeline).


def evaluate(
    genome: Genome,
    *,
    client: ModelClient,
    policy: Policy,
    target: TargetQuery,
    run_id: str,
    search: Search,
    generation: int,
    parent_ids: list[str],
    seed: int,
) -> ResultRecord:
    prompt = render(genome, policy, target)
    response = client.complete(policy.system_prompt, prompt, genome=genome, seed=seed)
    outcome, fitness = score(response, genome.perturbation_channel.noise_ratio, policy)
    return ResultRecord(
        run_id=run_id,
        search=search,
        generation=generation,
        genome_id=genome.genome_id,
        parent_ids=parent_ids,
        genome=genome,
        rendered_prompt=prompt,
        policy_id=policy.policy_id,
        target_query_id=target.target_query_id,
        response=response,
        outcome=outcome,
        fitness=fitness,
        seed=seed,
    )
