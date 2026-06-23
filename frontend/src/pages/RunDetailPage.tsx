import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
  const [run, setRun] = useState<RunRecord | null>(null);
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedGen, setSelectedGen] = useState<number | null>(null);
  const [userPickedGen, setUserPickedGen] = useState(false);
  const [individuals, setIndividuals] = useState<IndividualRecord[] | null>(null);
  const [individualsError, setIndividualsError] = useState<string | null>(null);
  const [selectedIndividual, setSelectedIndividual] =
    useState<IndividualRecord | null>(null);

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
            <RunControls
              runId={run.id}
              status={run.status}
              onChanged={refresh}
              onError={setError}
            />
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
                      <td>{ind.origin ?? "—"}</td>
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
          onClose={() => setSelectedIndividual(null)}
        />
      )}
    </section>
  );
}
