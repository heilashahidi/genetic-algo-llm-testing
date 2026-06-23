import { useState } from "react";
import type { ReactNode } from "react";
import type { IndividualRecord } from "../types";

/**
 * Map a fitness value (0..1, may be null) to a red → amber → green color.
 * Shared by the lineage-tree nodes and the detail panel so the scale stays
 * consistent. null / untested → gray.
 */
export function fitnessColor(fitness: number | null | undefined): string {
  if (fitness == null || Number.isNaN(fitness)) return "#94a3b8"; // gray
  const t = Math.max(0, Math.min(1, fitness));
  // Two-stop interpolation: red(#d1495b) → amber(#f0a202) → green(#2a9d8f).
  const red = { r: 0xd1, g: 0x49, b: 0x5b };
  const amber = { r: 0xf0, g: 0xa2, b: 0x02 };
  const green = { r: 0x2a, g: 0x9d, b: 0x8f };
  let from: { r: number; g: number; b: number };
  let to: { r: number; g: number; b: number };
  let local: number;
  if (t < 0.5) {
    from = red;
    to = amber;
    local = t / 0.5;
  } else {
    from = amber;
    to = green;
    local = (t - 0.5) / 0.5;
  }
  const mix = (a: number, b: number) => Math.round(a + (b - a) * local);
  return `rgb(${mix(from.r, to.r)}, ${mix(from.g, to.g)}, ${mix(from.b, to.b)})`;
}

export function formatFitness(fitness: number | null | undefined): string {
  if (fitness == null || Number.isNaN(fitness)) return "—";
  return fitness.toFixed(2);
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const KNOWN_ORIGINS = new Set([
  "seed",
  "random",
  "recombinant",
  "elite",
  "crossover",
  "mutation",
]);

export function originClass(origin: string | null): string {
  const key = origin && KNOWN_ORIGINS.has(origin) ? origin : "unknown";
  return `origin-badge origin-badge--${key}`;
}

/** A clickable individual id that asks the panel to navigate. */
function NavLink({
  label,
  id,
  onNavigate,
}: {
  label: string;
  id: unknown;
  onNavigate: (id: string) => void;
}) {
  if (id == null) {
    return (
      <span>
        {label}: <span className="muted">none</span>
      </span>
    );
  }
  const str = String(id);
  return (
    <span>
      {label}:{" "}
      <button
        type="button"
        className="link-button"
        onClick={() => onNavigate(str)}
        title="Select this individual"
      >
        <code>{str}</code>
      </button>
    </span>
  );
}

/** Human sentence describing how this individual came to be. */
function StepExplanation({
  individual,
  onNavigate,
}: {
  individual: IndividualRecord;
  onNavigate: (id: string) => void;
}) {
  const a = individual.parent_a_id;
  const b = individual.parent_b_id;
  const mutated =
    individual.mutated_genes && individual.mutated_genes.length > 0
      ? individual.mutated_genes.join(", ")
      : "none";

  let sentence: ReactNode;
  switch (individual.origin) {
    case "elite":
      sentence = (
        <>
          Carried over unchanged from{" "}
          <NavLink label="parent" id={a} onNavigate={onNavigate} />.
        </>
      );
      break;
    case "crossover":
      sentence = (
        <>
          Crossover of <NavLink label="A" id={a} onNavigate={onNavigate} /> and{" "}
          <NavLink label="B" id={b} onNavigate={onNavigate} />. Each gene below
          is tagged with the parent that donated it.
        </>
      );
      break;
    case "mutation":
      sentence = (
        <>
          Mutated from <NavLink label="parent" id={a} onNavigate={onNavigate} />;
          changed genes: <strong>{mutated}</strong>.
        </>
      );
      break;
    case "seed":
      sentence = <>Hand-authored seed individual (no parents).</>;
      break;
    case "random":
      sentence = <>Randomly generated individual (no parents).</>;
      break;
    case "recombinant":
      sentence = (
        <>
          Recombined from <NavLink label="A" id={a} onNavigate={onNavigate} />{" "}
          and <NavLink label="B" id={b} onNavigate={onNavigate} />.
        </>
      );
      break;
    default:
      sentence = <>Origin: {individual.origin ?? "unknown"}.</>;
  }

  return <p className="step-explain">{sentence}</p>;
}

/** Genome rendered as a gene -> value table with provenance highlighting. */
function GenomeTable({ individual }: { individual: IndividualRecord }) {
  const mask = individual.crossover_mask ?? null;
  const mutatedSet = new Set(individual.mutated_genes ?? []);
  const entries = Object.entries(individual.genome);

  return (
    <table className="table genome-table">
      <thead>
        <tr>
          <th>Gene</th>
          <th>Value</th>
          <th>Provenance</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([gene, value]) => {
          const donor = mask ? mask[gene] : undefined;
          const isMutated = mutatedSet.has(gene);
          const rowClass = donor
            ? `genome-row--donor-${donor}`
            : isMutated
              ? "genome-row--mutated"
              : "";
          return (
            <tr key={gene} className={rowClass}>
              <td>
                <code>{gene}</code>
              </td>
              <td className="genome-table__value">
                {typeof value === "object" && value !== null
                  ? JSON.stringify(value)
                  : String(value)}
              </td>
              <td>
                {donor === "a" && (
                  <span className="prov-tag prov-tag--a">Parent A</span>
                )}
                {donor === "b" && (
                  <span className="prov-tag prov-tag--b">Parent B</span>
                )}
                {isMutated && (
                  <span className="prov-tag prov-tag--mutated">mutated</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A collapsible labelled section. */
function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="collapsible" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="collapsible__body">{children}</div>
    </details>
  );
}

/**
 * Shared body for the individual detail — used by both the modal (Table view)
 * and the lineage-tree side panel. `onNavigate` selects another individual by
 * id (a parent or a child); `offspring` is the precomputed list of children.
 */
export function IndividualDetail({
  individual,
  onNavigate,
  offspring = [],
}: {
  individual: IndividualRecord;
  onNavigate: (id: string) => void;
  offspring?: IndividualRecord[];
}) {
  const [showRawJson, setShowRawJson] = useState(false);
  const hasMask = !!individual.crossover_mask;
  const hasMutations =
    !!individual.mutated_genes && individual.mutated_genes.length > 0;

  return (
    <div className="indiv-detail">
      <dl className="kv">
        <dt>Individual</dt>
        <dd>
          <code>{String(individual.individual_id)}</code>
        </dd>
        <dt>Origin</dt>
        <dd>
          <span className={originClass(individual.origin)}>
            {individual.origin ?? "unknown"}
          </span>
        </dd>
        <dt>Fitness</dt>
        <dd>
          <span
            className="fitness-chip"
            style={{ background: fitnessColor(individual.fitness) }}
          >
            {formatFitness(individual.fitness)}
          </span>
        </dd>
        <dt>Generation</dt>
        <dd>{individual.generation}</dd>
        <dt>Created</dt>
        <dd>{formatTime(individual.created_at)}</dd>
      </dl>

      <section className="detail-block">
        <h4>Lineage</h4>
        <div className="lineage-ids">
          <NavLink
            label="Parent A"
            id={individual.parent_a_id}
            onNavigate={onNavigate}
          />
          <NavLink
            label="Parent B"
            id={individual.parent_b_id}
            onNavigate={onNavigate}
          />
        </div>
        <StepExplanation individual={individual} onNavigate={onNavigate} />
      </section>

      <section className="detail-block">
        <h4>Offspring ({offspring.length})</h4>
        {offspring.length === 0 ? (
          <p className="muted">No children reference this individual.</p>
        ) : (
          <ul className="offspring-list">
            {offspring.map((child) => (
              <li key={String(child.individual_id)}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => onNavigate(String(child.individual_id))}
                  title="Select this child"
                >
                  <code>{String(child.individual_id)}</code>
                </button>{" "}
                <span className="muted">gen {child.generation}</span>{" "}
                <span
                  className="fitness-chip fitness-chip--sm"
                  style={{ background: fitnessColor(child.fitness) }}
                >
                  {formatFitness(child.fitness)}
                </span>{" "}
                {child.origin && (
                  <span className={originClass(child.origin)}>
                    {child.origin}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="detail-block">
        <div className="detail-block__head">
          <h4>Genome</h4>
          <button
            type="button"
            className="link-button"
            onClick={() => setShowRawJson((v) => !v)}
          >
            {showRawJson ? "Show gene table" : "Show raw JSON"}
          </button>
        </div>
        {(hasMask || hasMutations) && (
          <div className="prov-legend">
            {hasMask && (
              <>
                <span className="prov-tag prov-tag--a">Parent A</span>
                <span className="prov-tag prov-tag--b">Parent B</span>
              </>
            )}
            {hasMutations && (
              <span className="prov-tag prov-tag--mutated">mutated</span>
            )}
          </div>
        )}
        {showRawJson ? (
          <pre className="json-block">
            {JSON.stringify(individual.genome, null, 2)}
          </pre>
        ) : (
          <GenomeTable individual={individual} />
        )}
      </section>

      <section className="detail-block">
        <Collapsible
          title={`Phenotype — full prompt sent${
            individual.phenotype_char_length != null
              ? ` (${individual.phenotype_char_length} chars)`
              : ""
          }`}
        >
          {individual.phenotype ? (
            <pre className="scroll-block">{individual.phenotype}</pre>
          ) : (
            <p className="muted">Phenotype text was not stored for this run.</p>
          )}
        </Collapsible>
      </section>

      <section className="detail-block">
        <h4>Model response</h4>
        {individual.model_response ? (
          <pre className="scroll-block">{individual.model_response}</pre>
        ) : (
          <p className="muted">
            Full response text not stored.
            {individual.model_response_hash && (
              <>
                {" "}
                Response hash: <code>{individual.model_response_hash}</code>
              </>
            )}
          </p>
        )}
      </section>

      {individual.vector_indices && individual.vector_indices.length > 0 && (
        <section className="detail-block">
          <Collapsible
            title={`Encoded vector (${individual.vector_indices.length} ints)`}
          >
            <pre className="scroll-block scroll-block--short">
              {individual.vector_indices.join(", ")}
            </pre>
          </Collapsible>
        </section>
      )}
    </div>
  );
}
