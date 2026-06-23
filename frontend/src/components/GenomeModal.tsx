import { useState } from "react";
import type { IndividualRecord } from "../types";
import { IndividualDetail } from "./IndividualDetail";

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
          setNavError(`Could not find ${parentId} in this run.`);
        }
      })
      .catch((err: unknown) =>
        setNavError(
          err instanceof Error ? err.message : "Failed to load individual.",
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
        {loading && <p className="muted">Loading individual…</p>}

        <IndividualDetail individual={current} onNavigate={navigateToParent} />
      </div>
    </div>
  );
}
