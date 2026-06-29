import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { RunRecord, TraitLeaderboardEntry } from "../types";
import { usePolling } from "../usePolling";
import { StatusBadge } from "../components/StatusBadge";
import { RunControls } from "../components/RunControls";
import { TraitLeaderboard } from "../components/TraitLeaderboard";
import { ModelTag } from "../components/ModelTag";

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

/** A run with work in flight — gets the accent "live" rail in the table. */
function isLive(status: RunRecord["status"]): boolean {
  return status === "running" || status === "queued" || status === "paused";
}

export function RunsListPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<TraitLeaderboardEntry[] | null>(
    null,
  );
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .listRuns()
      .then((data) => {
        setRuns(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load runs."),
      );
    // Secondary, historical view: its failure must not blank the runs list.
    api
      .getLeaderboard(10)
      .then((data) => {
        setLeaderboard(data);
        setLeaderboardError(null);
      })
      .catch((err: unknown) =>
        setLeaderboardError(
          err instanceof Error ? err.message : "Failed to load leaderboard.",
        ),
      );
  }, []);

  usePolling(refresh, 3000, true);

  const handleDelete = useCallback(
    async (runId: string) => {
      if (
        !window.confirm("Delete this run and all its data? This cannot be undone.")
      ) {
        return;
      }
      setDeleting(runId);
      try {
        await api.deleteRun(runId);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete run.");
      } finally {
        setDeleting(null);
      }
    },
    [refresh],
  );

  // Distinct target models broken across the shown traits — a headline KPI.
  const modelsBroken =
    leaderboard === null
      ? 0
      : new Set(leaderboard.flatMap((e) => e.models.map((m) => m.model))).size;

  return (
    <section>
      <div className="page-head">
        <h1>Runs</h1>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <section className="lb-panel">
        <header className="lb-panel__head">
          <div className="lb-panel__title">
            <h2>Trait leaderboard</h2>
            <p className="lb-panel__sub">
              The traits breaking models hardest — present in successful
              jailbreaks (fitness ≥ 1.0) across every run, and the targets
              they've taken down.
            </p>
          </div>
          {leaderboard !== null && leaderboard.length > 0 && (
            <div className="lb-panel__kpis">
              <div className="lb-kpi">
                <span className="lb-kpi__num">{leaderboard.length}</span>
                <span className="lb-kpi__label">top traits</span>
              </div>
              <div className="lb-kpi">
                <span className="lb-kpi__num">{modelsBroken}</span>
                <span className="lb-kpi__label">models broken</span>
              </div>
            </div>
          )}
        </header>
        {leaderboardError && (
          <div className="alert alert--error">{leaderboardError}</div>
        )}
        {leaderboard === null && !leaderboardError && (
          <p className="muted">Loading leaderboard…</p>
        )}
        {leaderboard !== null && <TraitLeaderboard entries={leaderboard} />}
      </section>

      {runs === null && !error && <p className="muted">Loading runs…</p>}

      {runs !== null && runs.length === 0 && (
        <div className="empty">
          <p>No runs yet.</p>
          <Link to="/runs/new" className="btn btn--primary">
            Start your first run
          </Link>
        </div>
      )}

      {runs !== null && runs.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Target model</th>
              <th>Status</th>
              <th>Generation</th>
              <th>Created</th>
              <th className="table__actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                className={`table__row--clickable${
                  isLive(run.status) ? " is-live" : ""
                }`}
                onClick={() => navigate(`/runs/${run.id}`)}
              >
                <td>
                  <code title={run.id}>{shortId(run.id)}</code>
                </td>
                <td>
                  <ModelTag model={run.model} />
                </td>
                <td>
                  <StatusBadge status={run.status} />
                </td>
                <td>
                  {run.current_generation == null ? (
                    "—"
                  ) : (
                    <span className="gen-pill">
                      <span className="gen-pill__k">gen</span>
                      <span className="gen-pill__v">
                        {run.current_generation}
                      </span>
                    </span>
                  )}
                </td>
                <td>{formatTime(run.created_at)}</td>
                <td
                  className="table__actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <RunControls
                    runId={run.id}
                    status={run.status}
                    onChanged={refresh}
                    onError={setError}
                  />
                  <button
                    type="button"
                    className="btn btn--danger"
                    disabled={deleting === run.id}
                    onClick={() => handleDelete(run.id)}
                  >
                    {deleting === run.id ? "Deleting…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
