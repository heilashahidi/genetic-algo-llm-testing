import type { GeneSchema, IndividualRecord } from "./types";

/**
 * Pure, parameterized statistics for the Allele Explorer. Everything is
 * computed client-side from the individuals array plus the genome schema.
 *
 * Vocabulary:
 *  - An *allele* is one possible value of a gene. For categorical /
 *    multi_categorical genes it is each entry in `schema.alleles`; for boolean
 *    genes it is the synthetic pair "on" (true) and "off" (false).
 *  - An individual *carries* an allele per the gene's type (see `carries`).
 *  - `lift` measures how much an allele beats the population mean on its own.
 *  - `synergy` measures how much a pair beats the additive expectation of two
 *    independent lifts (i.e. whether two alleles are better together).
 */

/** A carrier counts as a "success" at or above this fitness. */
export const SUCCESS_THRESHOLD = 1.0;

export type MetricMode = "mean" | "success";

/** "all" generations, or a specific generation number. */
export type GenerationFilter = number | "all";

export interface AlleleStat {
  gene: string;
  allele: string;
  /** Carrier count among counted (fitness != null) individuals. */
  n: number;
  /** Mean fitness of carriers (0 when no carriers). */
  meanFitness: number;
  /** Fraction of carriers with fitness >= SUCCESS_THRESHOLD. */
  successRate: number;
  /** meanFitness - populationMean. */
  lift: number;
}

export interface PairStat {
  geneA: string;
  alleleA: string;
  geneB: string;
  alleleB: string;
  /** Co-carrier count (carry both). */
  n: number;
  coMean: number;
  /** coMean - (populationMean + lift(a) + lift(b)). */
  synergy: number;
}

export interface PopulationStats {
  /** Individuals retained (fitness != null and within the generation filter). */
  counted: IndividualRecord[];
  populationMean: number;
  /** gene -> allele -> stat, in schema order. */
  alleleStats: AlleleStat[];
}

/** The list of alleles for a gene, including the synthetic boolean pair. */
export function allelesOf(gene: GeneSchema): string[] {
  if (gene.type === "boolean") return ["on", "off"];
  return gene.alleles ?? [];
}

/** Whether an individual carries `allele` of `gene`, per the gene's type. */
export function carries(
  individual: IndividualRecord,
  gene: GeneSchema,
  allele: string,
): boolean {
  const value = individual.genome[gene.name];
  switch (gene.type) {
    case "boolean":
      return value === (allele === "on");
    case "multi_categorical":
      return Array.isArray(value) && value.includes(allele);
    case "categorical":
    default:
      return value === allele;
  }
}

/**
 * For a multi_categorical gene, collapse an individual's active set into a
 * single category label (sorted, "+"-joined), or "(none)" when empty. Used by
 * the parallel-categories view, which needs one bucket per individual per axis.
 */
export function multiCategoryLabel(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "(none)";
  return [...value].map(String).sort().join("+");
}

/** The single category label an individual falls under for any gene type. */
export function categoryLabel(
  individual: IndividualRecord,
  gene: GeneSchema,
): string {
  const value = individual.genome[gene.name];
  if (gene.type === "boolean") return value ? "on" : "off";
  if (gene.type === "multi_categorical") return multiCategoryLabel(value);
  return value == null ? "(none)" : String(value);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Keep only fitness-bearing individuals within the generation filter. */
export function filterCounted(
  individuals: IndividualRecord[],
  generation: GenerationFilter,
): IndividualRecord[] {
  return individuals.filter(
    (ind) =>
      ind.fitness != null &&
      !Number.isNaN(ind.fitness) &&
      (generation === "all" || ind.generation === generation),
  );
}

/** Compute the population mean and every allele's stat over the counted set. */
export function computePopulationStats(
  individuals: IndividualRecord[],
  genes: GeneSchema[],
  generation: GenerationFilter,
): PopulationStats {
  const counted = filterCounted(individuals, generation);
  const populationMean = mean(counted.map((ind) => ind.fitness as number));

  const alleleStats: AlleleStat[] = [];
  for (const gene of genes) {
    for (const allele of allelesOf(gene)) {
      const carrierFitness: number[] = [];
      let successes = 0;
      for (const ind of counted) {
        if (!carries(ind, gene, allele)) continue;
        const f = ind.fitness as number;
        carrierFitness.push(f);
        if (f >= SUCCESS_THRESHOLD) successes += 1;
      }
      const n = carrierFitness.length;
      const meanFitness = mean(carrierFitness);
      alleleStats.push({
        gene: gene.name,
        allele,
        n,
        meanFitness,
        successRate: n === 0 ? 0 : successes / n,
        lift: n === 0 ? 0 : meanFitness - populationMean,
      });
    }
  }
  return { counted, populationMean, alleleStats };
}

/** The metric value used to rank/size an allele under the active mode. */
export function metricValue(stat: AlleleStat, mode: MetricMode): number {
  return mode === "success" ? stat.successRate : stat.lift;
}

/** Index allele stats as gene -> allele -> stat for fast pair lookups. */
function indexAlleleStats(
  stats: AlleleStat[],
): Map<string, Map<string, AlleleStat>> {
  const byGene = new Map<string, Map<string, AlleleStat>>();
  for (const stat of stats) {
    let inner = byGene.get(stat.gene);
    if (!inner) {
      inner = new Map();
      byGene.set(stat.gene, inner);
    }
    inner.set(stat.allele, stat);
  }
  return byGene;
}

/** Mean fitness of individuals carrying BOTH alleles, with their count. */
export function coCarrierStats(
  counted: IndividualRecord[],
  geneA: GeneSchema,
  alleleA: string,
  geneB: GeneSchema,
  alleleB: string,
): { n: number; coMean: number } {
  const fitness: number[] = [];
  for (const ind of counted) {
    if (carries(ind, geneA, alleleA) && carries(ind, geneB, alleleB)) {
      fitness.push(ind.fitness as number);
    }
  }
  return { n: fitness.length, coMean: mean(fitness) };
}

/**
 * Rank synergistic allele pairs across all alleles from DIFFERENT genes.
 * synergy = coMean - (populationMean + lift(a) + lift(b)); pairs with fewer
 * than `minCount` co-carriers are skipped. Sorted by synergy descending.
 */
export function rankSynergyPairs(
  pop: PopulationStats,
  genes: GeneSchema[],
  minCount: number,
): PairStat[] {
  const byGene = indexAlleleStats(pop.alleleStats);
  const pairs: PairStat[] = [];

  for (let i = 0; i < genes.length; i += 1) {
    for (let j = i + 1; j < genes.length; j += 1) {
      const geneA = genes[i];
      const geneB = genes[j];
      const statsA = byGene.get(geneA.name);
      const statsB = byGene.get(geneB.name);
      if (!statsA || !statsB) continue;
      for (const alleleA of allelesOf(geneA)) {
        const statA = statsA.get(alleleA);
        if (!statA) continue;
        for (const alleleB of allelesOf(geneB)) {
          const statB = statsB.get(alleleB);
          if (!statB) continue;
          const { n, coMean } = coCarrierStats(
            pop.counted,
            geneA,
            alleleA,
            geneB,
            alleleB,
          );
          if (n < minCount) continue;
          const synergy =
            coMean - (pop.populationMean + statA.lift + statB.lift);
          pairs.push({
            geneA: geneA.name,
            alleleA,
            geneB: geneB.name,
            alleleB,
            n,
            coMean,
            synergy,
          });
        }
      }
    }
  }

  pairs.sort((a, b) => b.synergy - a.synergy);
  return pairs;
}

export interface FrequencyPoint {
  generation: number;
  /** allele -> share (0..1) of that allele in the generation. */
  [allele: string]: number;
}

/**
 * Allele prevalence per generation for one gene, over ALL individuals with a
 * fitness (ignores the generation filter so the trend is visible end-to-end).
 * For categorical/boolean genes shares sum to ~1 (one allele per individual).
 * For multi_categorical genes each share is the carrier fraction, so they can
 * overlap and need not sum to 1.
 */
export function alleleFrequencyByGeneration(
  individuals: IndividualRecord[],
  gene: GeneSchema,
): { generations: number[]; alleles: string[]; points: FrequencyPoint[] } {
  const counted = filterCounted(individuals, "all");
  const alleles = allelesOf(gene);

  const byGen = new Map<number, IndividualRecord[]>();
  for (const ind of counted) {
    const list = byGen.get(ind.generation) ?? [];
    list.push(ind);
    byGen.set(ind.generation, list);
  }
  const generations = Array.from(byGen.keys()).sort((a, b) => a - b);

  const points = generations.map((g) => {
    const members = byGen.get(g)!;
    const point: FrequencyPoint = { generation: g };
    for (const allele of alleles) {
      const carriers = members.filter((ind) =>
        carries(ind, gene, allele),
      ).length;
      point[allele] = members.length === 0 ? 0 : carriers / members.length;
    }
    return point;
  });

  return { generations, alleles, points };
}
