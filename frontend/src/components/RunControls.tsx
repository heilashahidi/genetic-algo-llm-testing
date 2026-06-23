import { useState } from "react";
import { api } from "../api";
import type { RunStatus } from "../types";

type Action = "stop" | "pause" | "resume";

interface Props {
  runId: string;
  status: RunStatus;
  /** Called after a control action succeeds so the parent can refresh. */
  onChanged?: () => void;
  onError?: (message: string) => void;
}

/**
 * Renders only the control actions valid for the current status:
 * pause + stop while running, resume while paused, nothing when terminal.
 */
export function RunControls({ runId, status, onChanged, onError }: Props) {
  const [busy, setBusy] = useState<Action | null>(null);

  async function send(action: Action) {
    if (action === "stop" && !window.confirm("Stop this run? It cannot be resumed.")) {
      return;
    }
    setBusy(action);
    try {
      await api.controlRun(runId, action);
      onChanged?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Control action failed.");
    } finally {
      setBusy(null);
    }
  }

  const showPause = status === "running";
  const showStop = status === "running" || status === "paused" || status === "queued";
  const showResume = status === "paused";

  if (!showPause && !showStop && !showResume) {
    return null;
  }

  return (
    <div className="controls">
      {showResume && (
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy !== null}
          onClick={() => send("resume")}
        >
          {busy === "resume" ? "Resuming…" : "Resume"}
        </button>
      )}
      {showPause && (
        <button
          type="button"
          className="btn"
          disabled={busy !== null}
          onClick={() => send("pause")}
        >
          {busy === "pause" ? "Pausing…" : "Pause"}
        </button>
      )}
      {showStop && (
        <button
          type="button"
          className="btn btn--danger"
          disabled={busy !== null}
          onClick={() => send("stop")}
        >
          {busy === "stop" ? "Stopping…" : "Stop"}
        </button>
      )}
    </div>
  );
}
