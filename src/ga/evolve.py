import random

from .contract import Genome, PerturbationChannel, SemanticChannel, categorical_values

# Seeded genetic operators (PRD §4). Pure functions of an injected Random, so a
# fixed seed reproduces a run exactly. Crossover is per-gene uniform within the
# two-channel structure (genes never leave their channel), which lets the partial
# building blocks of §5/C8 recombine into a full solution.

# Gene domains are static (closed enum sets) — derive them once at import.
_SEM, _PER = categorical_values()


def random_genome(rng: random.Random) -> Genome:
    return Genome(
        semantic_channel=SemanticChannel(
            frame=rng.choice(_SEM["frame"]),
            persona=rng.choice(_SEM["persona"]),
            task_style=rng.choice(_SEM["task_style"]),
            instruction_pressure=rng.choice(_SEM["instruction_pressure"]),
            demo_count=rng.randint(0, 5),
            conversation_mode=rng.choice(_SEM["conversation_mode"]),
            context_source=rng.choice(_SEM["context_source"]),
        ),
        perturbation_channel=PerturbationChannel(
            format=rng.choice(_PER["format"]),
            delimiter_style=rng.choice(_PER["delimiter_style"]),
            noise_enabled=rng.choice([True, False]),
            noise_type=rng.choice(_PER["noise_type"]),
            noise_position=rng.choice(_PER["noise_position"]),
            noise_ratio=round(rng.random(), 2),
        ),
    )


def crossover(a: Genome, b: Genome, rng: random.Random) -> Genome:
    da, db = a.model_dump(), b.model_dump()
    child = {
        channel: {gene: (da if rng.random() < 0.5 else db)[channel][gene] for gene in da[channel]}
        for channel in ("semantic_channel", "perturbation_channel")
    }
    return Genome(**child)


def mutate(genome: Genome, rng: random.Random, rate: float = 0.15) -> Genome:
    d = genome.model_dump()
    for gene, vals in _SEM.items():
        if rng.random() < rate:
            d["semantic_channel"][gene] = rng.choice(vals)
    if rng.random() < rate:
        d["semantic_channel"]["demo_count"] = rng.randint(0, 5)
    for gene, vals in _PER.items():
        if rng.random() < rate:
            d["perturbation_channel"][gene] = rng.choice(vals)
    if rng.random() < rate:
        d["perturbation_channel"]["noise_enabled"] = not d["perturbation_channel"]["noise_enabled"]
    if rng.random() < rate:
        d["perturbation_channel"]["noise_ratio"] = round(rng.random(), 2)
    return Genome(**d)


def tournament(scored: list[tuple[Genome, float]], rng: random.Random, k: int = 3) -> Genome:
    contenders = [rng.choice(scored) for _ in range(k)]
    return max(contenders, key=lambda gf: gf[1])[0]
