import { useState } from "react";
import type { ReactNode } from "react";
import type { IndividualRecord } from "../types";

interface Props {
  individual: IndividualRecord;
  /**
   * Resolve a parent by its individual_id, searching near the child's
   * generation. Returns null when the parent cannot be located.
   */
  resolveParent: (
    parentId: string,
    childGeneration: number,
  ) => Promise<IndividualRecord | null>;
  onClose: () => void;
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

function originClass(origin: string | null): string {
  const key = origin && KNOWN_ORIGINS.has(origin) ? origin : "unknown";
  return `origin-badge origin-badge--${key}`;
}

/** A clickable parent id that asks the parent panel to navigate. */
function ParentLink({
  label,
  parentId,
  onNavigate,
}: {
  label: string;
  parentId: unknown;
  onNavigate: (id: string) => void;
}) {
  if (parentId == null) {
    return (
      <span>
        {label}: <span className="muted">none</span>
      </span>
    );
  }
  const id = String(parentId);
  return (
    <span>
      {label}:{" "}
      <button
        type="button"
        className="link-button"
        onClick={() => onNavigate(id)}
        title="Open this parent"
      >
        <code>{id}</code>
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
          <ParentLink label="parent" parentId={a} onNavigate={onNavigate} />.
        </>
      );
      break;
    case "crossover":
      sentence = (
        <>
          Crossover of{" "}
          <ParentLink label="A" parentId={a} onNavigate={onNavigate} /> and{" "}
          <ParentLink label="B" parentId={b} onNavigate={onNavigate} />. Each
          gene below is tagged with the parent that donated it.
        </>
      );
      break;
    case "mutation":
      sentence = (
        <>
          Mutated from{" "}
          <ParentLink label="parent" parentId={a} onNavigate={onNavigate} />;
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
          Recombined from{" "}
          <ParentLink label="A" parentId={a} onNavigate={onNavigate} /> and{" "}
          <ParentLink label="B" parentId={b} onNavigate={onNavigate} />.
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

function IndividualDetail({
  individual,
  onNavigate,
}: {
  individual: IndividualRecord;
  onNavigate: (id: string) => void;
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
        <dd>{individual.fitness ?? "—"}</dd>
        <dt>Generation</dt>
        <dd>{individual.generation}</dd>
        <dt>Created</dt>
        <dd>{formatTime(individual.created_at)}</dd>
      </dl>

      <section className="detail-block">
        <h4>Lineage</h4>
        <div className="lineage-ids">
          <ParentLink
            label="Parent A"
            parentId={individual.parent_a_id}
            onNavigate={onNavigate}
          />
          <ParentLink
            label="Parent B"
            parentId={individual.parent_b_id}
            onNavigate={onNavigate}
          />
        </div>
        <StepExplanation individual={individual} onNavigate={onNavigate} />
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

export function GenomeModal({ individual, resolveParent, onClose }: Props) {
  // Navigation stack: the last entry is the currently shown individual.
  const [stack, setStack] = useState<IndividualRecord[]>([individual]);
  const [loading, setLoading] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);

  const current = stack[stack.length - 1];
  const canGoBack = stack.length > 1;

  const navigateToParent = (parentId: string) => {
    setNavError(null);
    setLoading(true);
    resolveParent(parentId, current.generation)
      .then((parent) => {
        if (parent) {
          setStack((s) => [...s, parent]);
        } else {
          setNavError(`Could not find parent ${parentId} in this run.`);
        }
      })
      .catch((err: unknown) =>
        setNavError(
          err instanceof Error ? err.message : "Failed to load parent.",
        ),
      )
      .finally(() => setLoading(false));
  };

  const goBack = () => {
    setNavError(null);
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Individual detail"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div className="modal__head-left">
            {canGoBack && (
              <button type="button" className="btn" onClick={goBack}>
                ← Back
              </button>
            )}
            <h3>Individual detail</h3>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        {navError && <div className="alert alert--error">{navError}</div>}
        {loading && <p className="muted">Loading parent…</p>}

        <IndividualDetail individual={current} onNavigate={navigateToParent} />
      </div>
    </div>
  );
}
