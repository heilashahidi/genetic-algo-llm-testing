import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { isTerminal } from "../types";
import type {
  GenerationRecord,
  IndividualRecord,
  RunRecord,
} from "../types";
import { usePolling } from "../usePolling";
import { StatusBadge } from "../components/StatusBadge";
import { RunControls } from "../components/RunControls";
import { FitnessCharts } from "../components/FitnessCharts";
import { GenomeModal } from "../components/GenomeModal";

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function RunDetailPage() {
  const { runId = "" } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState<RunRecord | null>(null);
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedGen, setSelectedGen] = useState<number | null>(null);
  const [userPickedGen, setUserPickedGen] = useState(false);
  const [individuals, setIndividuals] = useState<IndividualRecord[] | null>(null);
  const [individualsError, setIndividualsError] = useState<string | null>(null);
  const [selectedIndividual, setSelectedIndividual] =
    useState<IndividualRecord | null>(null);

  // Cache of individuals per generation so walking ancestry stays cheap.
  const genCache = useRef<Map<number, IndividualRecord[]>>(new Map());

  const loadGeneration = useCallback(
    async (generation: number): Promise<IndividualRecord[]> => {
      const cached = genCache.current.get(generation);
      if (cached) return cached;
      const data = await api.getIndividuals(runId, generation);
      genCache.current.set(generation, data);
      return data;
    },
    [runId],
  );

  // Resolve a parent by id, searching near the child's generation outward.
  const resolveParent = useCallback(
    async (
      parentId: string,
      childGeneration: number,
    ): Promise<IndividualRecord | null> => {
      const tried = new Set<number>();
      const candidates = [
        childGeneration - 1,
        childGeneration,
        ...Array.from({ length: childGeneration + 1 }, (_, g) => g),
      ];
      for (const gen of candidates) {
        if (gen < 0 || tried.has(gen)) continue;
        tried.add(gen);
        const list = await loadGeneration(gen);
        const match = list.find(
          (ind) => String(ind.individual_id) === parentId,
        );
        if (match) return match;
      }
      return null;
    },
    [loadGeneration],
  );

  const polling = run === null || !isTerminal(run.status);

  const refresh = useCallback(() => {
    Promise.all([api.getRun(runId), api.getGenerations(runId)])
      .then(([runData, genData]) => {
        setRun(runData);
        setGenerations(genData);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load run."),
      );
  }, [runId]);

  usePolling(refresh, 3000, polling);

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm("Delete this run and all its data? This cannot be undone.")
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteRun(runId);
      navigate("/runs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete run.");
      setDeleting(false);
    }
  }, [runId, navigate]);

  const latestGen = useMemo(
    () =>
      generations.length === 0
        ? null
        : generations[generations.length - 1].generation,
    [generations],
  );

  // Follow the latest generation until the user explicitly picks one.
  useEffect(() => {
    if (!userPickedGen && latestGen !== null) {
      setSelectedGen(latestGen);
    }
  }, [latestGen, userPickedGen]);

  // Load individuals for the selected generation.
  useEffect(() => {
    if (selectedGen === null) {
      setIndividuals(null);
      return;
    }
    let cancelled = false;
    api
      .getIndividuals(runId, selectedGen)
      .then((data) => {
        if (!cancelled) {
          setIndividuals(data);
          setIndividualsError(null);
          // Keep the lineage cache fresh for the generation being viewed.
          genCache.current.set(selectedGen, data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setIndividualsError(
            err instanceof Error ? err.message : "Failed to load individuals.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch when the run advances so a followed generation stays fresh.
  }, [runId, selectedGen, run?.current_generation]);

  if (error && run === null) {
    return (
      <section>
        <Link to="/runs" className="back-link">
          ← All runs
        </Link>
        <div className="alert alert--error">{error}</div>
      </section>
    );
  }

  return (
    <section>
      <Link to="/runs" className="back-link">
        ← All runs
      </Link>

      {error && <div className="alert alert--error">{error}</div>}

      {run === null ? (
        <p className="muted">Loading run…</p>
      ) : (
        <>
          <div className="page-head">
            <h1>
              Run <code>{run.id}</code>
            </h1>
            <div className="controls">
              <RunControls
                runId={run.id}
                status={run.status}
                onChanged={refresh}
                onError={setError}
              />
              <button
                type="button"
                className="btn btn--danger"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Delete run"}
              </button>
            </div>
          </div>

          <div className="meta-grid card">
            <div>
              <span className="meta-label">Status</span>
              <StatusBadge status={run.status} />
            </div>
            <div>
              <span className="meta-label">Generation</span>
              <strong>{run.current_generation ?? "—"}</strong>
            </div>
            <div>
              <span className="meta-label">Heartbeat</span>
              <span>{formatTime(run.heartbeat_at)}</span>
            </div>
            <div>
              <span className="meta-label">Experiment</span>
              <code>{run.experiment_id}</code>
            </div>
          </div>

          {run.error && (
            <div className="alert alert--error">
              <strong>Run error:</strong> {run.error}
            </div>
          )}

          <div className="card">
            <FitnessCharts data={generations} />
          </div>

          <div className="card">
            <div className="page-head">
              <h2>Individuals</h2>
              <label className="field field--inline">
                <span>Generation</span>
                <select
                  value={selectedGen ?? ""}
                  disabled={generations.length === 0}
                  onChange={(e) => {
                    setUserPickedGen(true);
                    setSelectedGen(Number(e.target.value));
                  }}
                >
                  {generations.map((g) => (
                    <option key={g.generation} value={g.generation}>
                      Generation {g.generation}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {individualsError && (
              <div className="alert alert--error">{individualsError}</div>
            )}

            {selectedGen === null && (
              <p className="muted">No generations available yet.</p>
            )}

            {individuals !== null && individuals.length === 0 && (
              <p className="muted">No individuals for this generation.</p>
            )}

            {individuals !== null && individuals.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Individual</th>
                    <th>Origin</th>
                    <th>Fitness</th>
                    <th>Parent A</th>
                    <th>Parent B</th>
                    <th>Phenotype length</th>
                  </tr>
                </thead>
                <tbody>
                  {individuals.map((ind, i) => (
                    <tr
                      key={`${String(ind.individual_id)}-${i}`}
                      className="table__row--clickable"
                      onClick={() => setSelectedIndividual(ind)}
                    >
                      <td>
                        <code>{String(ind.individual_id)}</code>
                      </td>
                      <td>
                        {ind.origin ? (
                          <span
                            className={`origin-badge origin-badge--${ind.origin}`}
                          >
                            {ind.origin}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{ind.fitness ?? "—"}</td>
                      <td>{ind.parent_a_id == null ? "—" : String(ind.parent_a_id)}</td>
                      <td>{ind.parent_b_id == null ? "—" : String(ind.parent_b_id)}</td>
                      <td>{ind.phenotype_char_length ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {selectedIndividual && (
        <GenomeModal
          individual={selectedIndividual}
          resolveParent={resolveParent}
          onClose={() => setSelectedIndividual(null)}
        />
      )}
    </section>
  );
}
