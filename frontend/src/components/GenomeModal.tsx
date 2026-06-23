import type { IndividualRecord } from "../types";

interface Props {
  individual: IndividualRecord;
  onClose: () => void;
}

export function GenomeModal({ individual, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Individual genome"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3>Genome — {String(individual.individual_id)}</h3>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <dl className="kv">
          <dt>Generation</dt>
          <dd>{individual.generation}</dd>
          <dt>Origin</dt>
          <dd>{individual.origin ?? "—"}</dd>
          <dt>Fitness</dt>
          <dd>{individual.fitness ?? "—"}</dd>
          <dt>Phenotype length</dt>
          <dd>{individual.phenotype_char_length ?? "—"}</dd>
        </dl>
        <pre className="json-block">
          {JSON.stringify(individual.genome, null, 2)}
        </pre>
      </div>
    </div>
  );
}
