import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { RunRecord } from "../types";
import { usePolling } from "../usePolling";
import { StatusBadge } from "../components/StatusBadge";
import { RunControls } from "../components/RunControls";

function formatTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function RunsListPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  usePolling(refresh, 3000, true);

  return (
    <section>
      <div className="page-head">
        <h1>Runs</h1>
        <Link to="/runs/new" className="btn btn--primary">
          New run
        </Link>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

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
                className="table__row--clickable"
                onClick={() => navigate(`/runs/${run.id}`)}
              >
                <td>
                  <code title={run.id}>{shortId(run.id)}</code>
                </td>
                <td>
                  <StatusBadge status={run.status} />
                </td>
                <td>{run.current_generation ?? "—"}</td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
