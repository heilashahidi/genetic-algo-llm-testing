import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  buildConfig,
  DEFAULT_FORM,
  deriveSeedCounts,
  loadLastBaseUrl,
  loadModels,
  mergeConfig,
  saveLastBaseUrl,
  saveModels,
  type FormFields,
} from "../experimentConfig";
import type { HarnessProvider, RunMode } from "../types";

export function NewRunPage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<string[]>(() => loadModels());
  const [newModel, setNewModel] = useState("");
  const [fields, setFields] = useState<FormFields>(() => ({
    ...DEFAULT_FORM,
    base_url: loadLastBaseUrl(),
    model: loadModels()[0] ?? DEFAULT_FORM.model,
  }));

  function addModel() {
    const tag = newModel.trim();
    if (!tag || models.includes(tag)) {
      setNewModel("");
      return;
    }
    const next = [...models, tag];
    setModels(next);
    saveModels(next);
    update("model", tag);
    setNewModel("");
  }

  function removeModel(tag: string) {
    const next = models.filter((m) => m !== tag);
    setModels(next);
    saveModels(next);
    if (fields.model === tag) {
      update("model", next[0] ?? "");
    }
  }
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seeds = useMemo(
    () => deriveSeedCounts(fields.population_size),
    [fields.population_size],
  );

  function update<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function num(key: keyof FormFields) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.valueAsNumber;
      update(key, (Number.isNaN(value) ? 0 : value) as FormFields[typeof key]);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (fields.population_size < 2) {
      setError("Population size must be at least 2.");
      return;
    }
    if (fields.elite_count >= fields.population_size) {
      setError("Elite count must be less than population size.");
      return;
    }

    let config = buildConfig(fields);

    if (advancedOpen && rawJson.trim()) {
      let override: unknown;
      try {
        override = JSON.parse(rawJson);
      } catch {
        setError("Advanced JSON is not valid JSON.");
        return;
      }
      if (typeof override !== "object" || override === null || Array.isArray(override)) {
        setError("Advanced JSON must be a JSON object.");
        return;
      }
      config = mergeConfig(config, override as Record<string, unknown>);
    }

    setSubmitting(true);
    try {
      saveLastBaseUrl(fields.base_url);
      const experimentId = await api.createExperiment(fields.name, config);
      const runId = await api.createRun(experimentId);
      navigate(`/runs/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run.");
      setSubmitting(false);
    }
  }

  return (
    <section className="form-page">
      <div className="page-head">
        <h1>New run</h1>
      </div>
      <p className="muted">
        Defaults run against ollama. Pick a model and base URL (the last base
        URL you used is pre-filled). Enable "Dry run" for a quick mock run with
        no real LLM.
      </p>

      {error && <div className="alert alert--error">{error}</div>}

      <form onSubmit={handleSubmit} className="form">
        <fieldset className="card">
          <legend>Experiment</legend>
          <label className="field">
            <span>Run name</span>
            <input
              type="text"
              value={fields.name}
              onChange={(e) => update("name", e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Target query</span>
            <input
              type="text"
              value={fields.target_query}
              onChange={(e) => update("target_query", e.target.value)}
              required
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Run mode</span>
              <select
                value={fields.run_mode}
                onChange={(e) => update("run_mode", e.target.value as RunMode)}
              >
                <option value="ga">ga</option>
                <option value="random">random</option>
                <option value="seed-only">seed-only</option>
              </select>
            </label>
            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={fields.dry_run}
                onChange={(e) => update("dry_run", e.target.checked)}
              />
              <span>Dry run (mock harness, no real LLM)</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>Harness</legend>
          <div className="field-row">
            <label className="field">
              <span>Provider</span>
              <select
                value={fields.provider}
                onChange={(e) =>
                  update("provider", e.target.value as HarnessProvider)
                }
              >
                <option value="mock">mock</option>
                <option value="ollama">ollama</option>
                <option value="lmstudio">lmstudio</option>
              </select>
            </label>
            <label className="field">
              <span>Model</span>
              <select
                value={fields.model}
                onChange={(e) => update("model", e.target.value)}
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {fields.model && !models.includes(fields.model) && (
                  <option value={fields.model}>{fields.model}</option>
                )}
                {models.length === 0 && <option value="">(no models)</option>}
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Add model</span>
              <div className="input-with-button">
                <input
                  type="text"
                  value={newModel}
                  placeholder="e.g. llama3.2:latest"
                  onChange={(e) => setNewModel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addModel();
                    }
                  }}
                />
                <button type="button" className="btn" onClick={addModel}>
                  Add
                </button>
              </div>
            </label>
            <div className="field">
              <span>Manage models</span>
              <div className="model-chips">
                {models.map((m) => (
                  <span key={m} className="model-chip">
                    {m}
                    <button
                      type="button"
                      className="model-chip__remove"
                      title={`Remove ${m}`}
                      onClick={() => removeModel(m)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {models.length === 0 && (
                  <span className="muted">No models — add one above.</span>
                )}
              </div>
            </div>
          </div>
          <label className="field">
            <span>Base URL</span>
            <input
              type="text"
              value={fields.base_url}
              onChange={(e) => update("base_url", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Max parallel requests</span>
            <input
              type="number"
              min={1}
              value={fields.max_parallel_requests}
              onChange={num("max_parallel_requests")}
            />
            <small className="field__hint">
              How many individuals are evaluated at once per generation. The
              shared ollama server handles up to ~48 concurrent requests; any
              extra are queued, not dropped, so a higher value safely takes
              maximum advantage of whatever capacity is free.
            </small>
          </label>
        </fieldset>

        <fieldset className="card">
          <legend>Genetic algorithm</legend>
          <div className="field-row">
            <label className="field">
              <span>Population size</span>
              <input
                type="number"
                min={2}
                value={fields.population_size}
                onChange={num("population_size")}
              />
            </label>
            <label className="field">
              <span>Max generations</span>
              <input
                type="number"
                min={1}
                value={fields.max_generations}
                onChange={num("max_generations")}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Min generations</span>
              <input
                type="number"
                min={0}
                value={fields.min_generations}
                onChange={num("min_generations")}
              />
              <small className="field__hint">
                Run at least this many generations even if a success is found
                early (0 = no minimum).
              </small>
            </label>
            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={fields.stop_on_success}
                onChange={(e) => update("stop_on_success", e.target.checked)}
              />
              <span>Stop on first success</span>
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Elite count</span>
              <input
                type="number"
                min={0}
                value={fields.elite_count}
                onChange={num("elite_count")}
              />
            </label>
            <label className="field">
              <span>Random seed</span>
              <input
                type="number"
                value={fields.random_seed}
                onChange={num("random_seed")}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Mutation rate</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={fields.mutation_rate}
                onChange={num("mutation_rate")}
              />
            </label>
            <label className="field">
              <span>Crossover rate</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={fields.crossover_rate}
                onChange={num("crossover_rate")}
              />
            </label>
          </div>
          <p className="hint">
            Seeds (auto-derived by the backend): ~
            {seeds.seed_stratified_count} real attacks + ~
            {seeds.seed_recombinant_count} combinations ({seeds.seed_random_count}{" "}
            random).
          </p>
        </fieldset>

        <div className="card">
          <button
            type="button"
            className="link-button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
          >
            {advancedOpen ? "▾" : "▸"} Advanced (raw JSON override)
          </button>
          {advancedOpen && (
            <label className="field">
              <span>
                Deep-merged over the structured config above. Use it to set
                fitness rules, timeouts, or any field not in the form.
              </span>
              <textarea
                rows={8}
                spellCheck={false}
                placeholder={'{\n  "fitness": { "success_threshold": 0.9 }\n}'}
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
              />
            </label>
          )}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => navigate("/runs")}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting ? "Creating…" : "Create and start run"}
          </button>
        </div>
      </form>
    </section>
  );
}
