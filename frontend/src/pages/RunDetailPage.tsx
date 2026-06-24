import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { isTerminal } from "../types";
import type {
  GenerationRecord,
  GenomeSchema,
  IndividualRecord,
  RunRecord,
} from "../types";
import { usePolling } from "../usePolling";
import { StatusBadge } from "../components/StatusBadge";
import { RunControls } from "../components/RunControls";
import { FitnessCharts } from "../components/FitnessCharts";
import { GenomeModal } from "../components/GenomeModal";
import { LineageTree } from "../components/LineageTree";
import { IndividualDetail } from "../components/IndividualDetail";
import { AlleleExplorer } from "../components/AlleleExplorer";

type ViewTab = "tree" | "table" | "alleles";

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

  const [view, setView] = useState<ViewTab>("tree");

  // All individuals across every generation — powers the tree + offspring.
  const [allIndividuals, setAllIndividuals] = useState<IndividualRecord[]>([]);
  const [allError, setAllError] = useState<string | null>(null);

  // Genome schema — static for the run, fetched once for the Alleles tab.
  const [schema, setSchema] = useState<GenomeSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Single source of truth for which individual is selected (by id).
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Table-view state (per-generation listing).
  const [selectedGen, setSelectedGen] = useState<number | null>(null);
  const [userPickedGen, setUserPickedGen] = useState(false);
  const [individuals, setIndividuals] = useState<IndividualRecord[] | null>(null);
  const [individualsError, setIndividualsError] = useState<string | null>(null);
  const [modalIndividual, setModalIndividual] =
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
    Promise.all([
      api.getRun(runId),
      api.getGenerations(runId),
      api.getIndividuals(runId), // ALL individuals across all generations
    ])
      .then(([runData, genData, allData]) => {
        setRun(runData);
        setGenerations(genData);
        setAllIndividuals(allData);
        setAllError(null);
        setError(null);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load run.";
        setError(msg);
        setAllError(msg);
      });
  }, [runId]);

  usePolling(refresh, 3000, polling);

  // Genome schema is fixed per deployment; fetch it once.
  useEffect(() => {
    let cancelled = false;
    api
      .getSchema()
      .then((data) => {
        if (!cancelled) {
          setSchema(data);
          setSchemaError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSchemaError(
            err instanceof Error ? err.message : "Failed to load genome schema.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Load individuals for the selected generation (Table view).
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
  }, [runId, selectedGen, run?.current_generation]);

  // Index of every individual by id, and children index for offspring.
  const byId = useMemo(() => {
    const map = new Map<string, IndividualRecord>();
    for (const ind of allIndividuals) map.set(String(ind.individual_id), ind);
    return map;
  }, [allIndividuals]);

  const selectedIndividual = selectedId ? byId.get(selectedId) ?? null : null;

  const offspring = useMemo(() => {
    if (!selectedId) return [];
    return allIndividuals
      .filter(
        (ind) =>
          String(ind.parent_a_id) === selectedId ||
          String(ind.parent_b_id) === selectedId,
      )
      .sort((a, b) => {
        if (a.generation !== b.generation) return a.generation - b.generation;
        return String(a.individual_id).localeCompare(String(b.individual_id));
      });
  }, [selectedId, allIndividuals]);

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

          <div className="tabs">
            <button
              type="button"
              className={`tab${view === "tree" ? " tab--active" : ""}`}
              onClick={() => setView("tree")}
            >
              Lineage Tree
            </button>
            <button
              type="button"
              className={`tab${view === "table" ? " tab--active" : ""}`}
              onClick={() => setView("table")}
            >
              Table
            </button>
            <button
              type="button"
              className={`tab${view === "alleles" ? " tab--active" : ""}`}
              onClick={() => setView("alleles")}
            >
              Alleles
            </button>
          </div>

          {view === "tree" && (
            <div className="ga-explorer">
              <div className="card ga-explorer__graph">
                {allError && (
                  <div className="alert alert--error">{allError}</div>
                )}
                <LineageTree
                  individuals={allIndividuals}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>

              <aside className="card ga-explorer__panel">
                <h2 className="ga-explorer__panel-title">Selected Genome</h2>
                {selectedIndividual ? (
                  <IndividualDetail
                    individual={selectedIndividual}
                    onNavigate={setSelectedId}
                    offspring={offspring}
                  />
                ) : (
                  <p className="muted">
                    Click a node in the tree to inspect that individual.
                  </p>
                )}
              </aside>
            </div>
          )}

          {view === "table" && (
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
                        onClick={() => setModalIndividual(ind)}
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
                        <td>
                          {ind.parent_a_id == null
                            ? "—"
                            : String(ind.parent_a_id)}
                        </td>
                        <td>
                          {ind.parent_b_id == null
                            ? "—"
                            : String(ind.parent_b_id)}
                        </td>
                        <td>{ind.phenotype_char_length ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {view === "alleles" && (
            <>
              {allError && <div className="alert alert--error">{allError}</div>}
              {schemaError ? (
                <div className="alert alert--error">{schemaError}</div>
              ) : schema === null ? (
                <div className="card">
                  <p className="muted">Loading genome schema…</p>
                </div>
              ) : allIndividuals.length === 0 ? (
                <div className="card">
                  <p className="muted">Waiting for data — no individuals yet.</p>
                </div>
              ) : (
                <AlleleExplorer
                  individuals={allIndividuals}
                  schema={schema}
                />
              )}
            </>
          )}
        </>
      )}

      {modalIndividual && (
        <GenomeModal
          individual={modalIndividual}
          resolveParent={resolveParent}
          onClose={() => setModalIndividual(null)}
        />
      )}
    </section>
  );
}
