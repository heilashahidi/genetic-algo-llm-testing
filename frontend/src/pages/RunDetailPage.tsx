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
import {
  IndividualDetail,
  fitnessColor,
  formatFitness,
} from "../components/IndividualDetail";
import { AlleleExplorer } from "../components/AlleleExplorer";
import { StatTile } from "../components/StatTile";
import { ModelTag } from "../components/ModelTag";
import { useCountUp } from "../useCountUp";

type ViewTab = "tree" | "table" | "alleles";

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/** Generation rendered as a count-up "level" — it ticks up as the run evolves. */
function GenerationLevel({ value }: { value: number | null }) {
  const shown = useCountUp(value ?? 0);
  return (
    <strong className="meta-gen">
      {value == null ? "—" : Math.round(shown)}
    </strong>
  );
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

  // Genome schema — the SNAPSHOT frozen into this run's experiment, which may
  // differ from the current editable draft. Fetched once for the lineage tree
  // and Alleles tab so the view reflects the schema the run actually used.
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

  // The run's own schema snapshot is fixed once the run exists; fetch it once.
  useEffect(() => {
    let cancelled = false;
    api
      .getRunSchema(runId)
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
  }, [runId]);

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

  // Per-generation roster ranked by fitness for the Table view.
  const rosterRanked = useMemo(() => {
    if (!individuals) return [];
    return [...individuals].sort((a, b) => {
      const fa = a.fitness ?? -1;
      const fb = b.fitness ?? -1;
      if (fb !== fa) return fb - fa;
      return String(a.individual_id).localeCompare(String(b.individual_id));
    });
  }, [individuals]);

  const genStats = useMemo(() => {
    if (!individuals || individuals.length === 0) return null;
    const fits = individuals.map((i) => i.fitness ?? 0);
    const best = Math.max(...fits);
    const avg = fits.reduce((s, v) => s + v, 0) / fits.length;
    const solved = individuals.filter((i) => (i.fitness ?? 0) >= 1).length;
    return { count: individuals.length, best, avg, solved };
  }, [individuals]);

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

          <div
            className={`meta-grid card${
              isTerminal(run.status) ? "" : " meta-card--live"
            }`}
          >
            <div>
              <span className="meta-label">Status</span>
              <StatusBadge status={run.status} />
            </div>
            <div>
              <span className="meta-label">Target model</span>
              <ModelTag model={run.model} />
            </div>
            <div>
              <span className="meta-label">Generation</span>
              <GenerationLevel value={run.current_generation ?? null} />
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

          <FitnessCharts data={generations} />

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
            <div
              className={`ga-explorer${
                selectedIndividual ? " ga-explorer--split" : ""
              }`}
            >
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

              {selectedIndividual && (
                <aside className="card ga-explorer__panel">
                  <div className="ga-explorer__panel-head">
                    <h2 className="ga-explorer__panel-title">Selected Genome</h2>
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => setSelectedId(null)}
                    >
                      Close
                    </button>
                  </div>
                  <IndividualDetail
                    individual={selectedIndividual}
                    onNavigate={setSelectedId}
                    offspring={offspring}
                  />
                </aside>
              )}
            </div>
          )}

          {view === "table" && (
            <div className="roster">
              <div className="roster__head">
                <div className="roster__title">
                  <h2>
                    {selectedGen !== null
                      ? `Generation ${selectedGen} roster`
                      : "Roster"}
                  </h2>
                  <p className="roster__sub">
                    Every individual this generation, ranked by fitness — click
                    one to inspect its genome.
                  </p>
                </div>
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

              {genStats && (
                <div className="roster__kpis">
                  <StatTile value={genStats.count} label="individuals" />
                  <StatTile
                    value={genStats.best}
                    label="best fitness"
                    format={(v) => v.toFixed(2)}
                  />
                  <StatTile
                    value={genStats.avg}
                    label="avg fitness"
                    format={(v) => v.toFixed(2)}
                  />
                  <StatTile value={genStats.solved} label="solved" />
                </div>
              )}

              {individualsError && (
                <div className="alert alert--error">{individualsError}</div>
              )}

              {selectedGen === null && (
                <p className="muted">No generations available yet.</p>
              )}

              {selectedGen !== null && individuals === null && (
                <p className="muted">Loading individuals…</p>
              )}

              {individuals !== null && individuals.length === 0 && (
                <p className="muted">No individuals for this generation.</p>
              )}

              {rosterRanked.length > 0 && (
                <ol className="roster-list">
                  {rosterRanked.map((ind, i) => {
                    const rank = i + 1;
                    const fitness = ind.fitness;
                    const positive = (fitness ?? 0) > 0;
                    const champ = rank === 1 && positive;
                    const pct = Math.max(0, Math.min(1, fitness ?? 0)) * 100;
                    return (
                      <li key={String(ind.individual_id)}>
                        <button
                          type="button"
                          className={`roster-row${
                            champ ? " roster-row--champ" : ""
                          }`}
                          style={{ animationDelay: `${Math.min(i, 24) * 25}ms` }}
                          onClick={() => setModalIndividual(ind)}
                          aria-label={`Individual ${String(
                            ind.individual_id,
                          )}, rank ${rank}, fitness ${formatFitness(fitness)}`}
                        >
                          <span className="roster-row__rank">
                            {String(rank).padStart(2, "0")}
                          </span>
                          <div className="roster-row__body">
                            <div className="roster-row__head">
                              <code className="roster-row__id">
                                {String(ind.individual_id)}
                              </code>
                              {ind.origin && (
                                <span
                                  className={`origin-badge origin-badge--${ind.origin}`}
                                >
                                  {ind.origin}
                                </span>
                              )}
                            </div>
                            <div className="roster-row__meter">
                              <span
                                className="roster-row__fill"
                                style={{
                                  width: `${pct}%`,
                                  background: fitnessColor(fitness),
                                }}
                              />
                            </div>
                            <div className="roster-row__meta">
                              <span>
                                parents:{" "}
                                <code>
                                  {ind.parent_a_id == null
                                    ? "—"
                                    : String(ind.parent_a_id)}
                                </code>
                                {ind.parent_b_id != null && (
                                  <>
                                    {" · "}
                                    <code>{String(ind.parent_b_id)}</code>
                                  </>
                                )}
                              </span>
                              <span>φ {ind.phenotype_char_length ?? "—"}</span>
                            </div>
                          </div>
                          <span className="roster-row__fitness">
                            <span
                              className="fitness-chip"
                              style={{ background: fitnessColor(fitness) }}
                            >
                              {formatFitness(fitness)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
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
