import type {
  ControlResponse,
  GenerationRecord,
  GenomeSchema,
  IndividualRecord,
  RunRecord,
  TraitLeaderboardEntry,
} from "./types";

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the API at ${BASE_URL}. Is the control plane running?`,
    );
  }

  if (!response.ok) {
    throw new ApiError(response.status, await describeError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function describeError(response: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      detail = body.detail;
    } else if (body.detail) {
      detail = JSON.stringify(body.detail);
    }
  } catch {
    // body was not JSON; fall through to a generic message
  }

  if (response.status === 404) {
    return detail || "Not found.";
  }
  if (response.status === 422) {
    return `Invalid configuration: ${detail || "the API rejected the request."}`;
  }
  return detail || `Request failed (HTTP ${response.status}).`;
}

export const api = {
  baseUrl: BASE_URL,

  health(): Promise<{ status: string }> {
    return request("/health");
  },

  async createExperiment(
    name: string,
    config: Record<string, unknown>,
  ): Promise<string> {
    const body = await request<{ experiment_id: string }>("/experiments", {
      method: "POST",
      body: JSON.stringify({ name, config }),
    });
    return body.experiment_id;
  },

  async createRun(experimentId: string): Promise<string> {
    const body = await request<{ run_id: string }>(
      `/experiments/${encodeURIComponent(experimentId)}/runs`,
      { method: "POST" },
    );
    return body.run_id;
  },

  listRuns(): Promise<RunRecord[]> {
    return request("/runs");
  },

  getLeaderboard(limit = 25): Promise<TraitLeaderboardEntry[]> {
    return request(`/leaderboard?limit=${limit}`);
  },

  getRun(runId: string): Promise<RunRecord> {
    return request(`/runs/${encodeURIComponent(runId)}`);
  },

  controlRun(
    runId: string,
    action: "stop" | "pause" | "resume",
  ): Promise<ControlResponse> {
    return request(`/runs/${encodeURIComponent(runId)}/${action}`, {
      method: "POST",
    });
  },

  async deleteRun(runId: string): Promise<void> {
    await request<void>(`/runs/${encodeURIComponent(runId)}`, {
      method: "DELETE",
    });
  },

  getSchema(): Promise<GenomeSchema> {
    return request("/schema");
  },

  putSchema(schema: GenomeSchema): Promise<GenomeSchema> {
    return request("/schema", {
      method: "PUT",
      body: JSON.stringify(schema),
    });
  },

  getRunSchema(runId: string): Promise<GenomeSchema> {
    return request(`/runs/${encodeURIComponent(runId)}/schema`);
  },

  getGenerations(runId: string): Promise<GenerationRecord[]> {
    return request(`/runs/${encodeURIComponent(runId)}/generations`);
  },

  getIndividuals(
    runId: string,
    generation?: number,
  ): Promise<IndividualRecord[]> {
    const query =
      generation === undefined ? "" : `?generation=${generation}`;
    return request(`/runs/${encodeURIComponent(runId)}/individuals${query}`);
  },
};
