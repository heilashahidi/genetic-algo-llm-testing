import { useState } from "react";
import type { GeneSchema } from "../types";

interface GeneEditorProps {
  gene: GeneSchema;
  /** Position among all genes in render_order; drives up/down availability. */
  isFirst: boolean;
  isLast: boolean;
  /** Replace this gene with an edited copy. */
  onChange: (next: GeneSchema) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const TYPE_LABELS: Record<GeneSchema["type"], string> = {
  categorical: "Single choice",
  multi_categorical: "Multiple choice",
  boolean: "On / off",
};

/**
 * Edits one gene of the draft schema. Only the fields the UI understands are
 * mutated; every other field on `gene` (render_full_override, empty_alias, and
 * any unknown keys) is spread through untouched on each change so prompt
 * rendering is never broken by an edit.
 */
export function GeneEditor({
  gene,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: GeneEditorProps) {
  const [newAllele, setNewAllele] = useState("");
  const [newAllelePrompt, setNewAllelePrompt] = useState("");

  const isCategorical =
    gene.type === "categorical" || gene.type === "multi_categorical";
  const alleles = gene.alleles ?? [];
  const render = gene.render ?? {};

  function setDescription(description: string): void {
    onChange({ ...gene, description });
  }

  function setCategoricalDefault(value: string): void {
    onChange({ ...gene, default: value });
  }

  function toggleMultiDefault(allele: string, checked: boolean): void {
    const current = Array.isArray(gene.default) ? gene.default : [];
    const next = checked
      ? [...current, allele]
      : current.filter((a) => a !== allele);
    onChange({ ...gene, default: next });
  }

  function setBooleanDefault(checked: boolean): void {
    onChange({ ...gene, default: checked });
  }

  function setRenderTrue(text: string): void {
    onChange({ ...gene, render_true: text });
  }

  function setAllelePrompt(allele: string, text: string): void {
    onChange({ ...gene, render: { ...render, [allele]: text } });
  }

  function addAllele(): void {
    const name = newAllele.trim();
    if (!name || alleles.includes(name)) return;
    onChange({
      ...gene,
      alleles: [...alleles, name],
      render: { ...render, [name]: newAllelePrompt },
    });
    setNewAllele("");
    setNewAllelePrompt("");
  }

  function removeAllele(allele: string): void {
    const nextAlleles = alleles.filter((a) => a !== allele);
    const nextRender = { ...render };
    delete nextRender[allele];

    // Keep `default` valid when the chosen allele disappears.
    let nextDefault = gene.default;
    if (gene.type === "categorical" && gene.default === allele) {
      nextDefault = nextAlleles[0] ?? "";
    } else if (gene.type === "multi_categorical" && Array.isArray(gene.default)) {
      nextDefault = gene.default.filter((a) => a !== allele);
    }

    onChange({
      ...gene,
      alleles: nextAlleles,
      render: nextRender,
      default: nextDefault,
    });
  }

  const hasAdvanced =
    gene.empty_alias !== undefined ||
    gene.render_full_override !== undefined;

  return (
    <div className="gene-card card">
      <div className="gene-card__head">
        <div className="gene-card__title">
          <code>{gene.name}</code>
          <span className="gene-card__type">{TYPE_LABELS[gene.type]}</span>
        </div>
        <div className="gene-card__actions">
          <button
            type="button"
            className="btn btn--icon"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`Move ${gene.name} earlier`}
            title="Move earlier in prompt order"
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn--icon"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Move ${gene.name} later`}
            title="Move later in prompt order"
          >
            ↓
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={onRemove}
          >
            Remove gene
          </button>
        </div>
      </div>

      <label className="field">
        <span>Description</span>
        <textarea
          rows={2}
          value={typeof gene.description === "string" ? gene.description : ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this gene controls"
        />
      </label>

      {gene.type === "boolean" && (
        <>
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={gene.default === true}
              onChange={(e) => setBooleanDefault(e.target.checked)}
            />
            <span>Default: on</span>
          </label>
          <label className="field">
            <span>Prompt text when on</span>
            <textarea
              rows={2}
              value={typeof gene.render_true === "string" ? gene.render_true : ""}
              onChange={(e) => setRenderTrue(e.target.value)}
              placeholder="Text emitted into the prompt when this gene is on"
            />
          </label>
        </>
      )}

      {isCategorical && (
        <div className="gene-card__alleles">
          <div className="gene-card__alleles-head">
            <h4>Alleles &amp; prompt text</h4>
            {gene.type === "categorical" && (
              <label className="field field--inline">
                <span>Default</span>
                <select
                  value={typeof gene.default === "string" ? gene.default : ""}
                  onChange={(e) => setCategoricalDefault(e.target.value)}
                  disabled={alleles.length === 0}
                >
                  {alleles.length === 0 && <option value="">—</option>}
                  {alleles.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {alleles.length === 0 ? (
            <p className="hint">
              No alleles yet. Add at least one below before saving.
            </p>
          ) : (
            <ul className="allele-list">
              {alleles.map((allele) => (
                <li key={allele} className="allele-row">
                  <div className="allele-row__head">
                    {gene.type === "multi_categorical" ? (
                      <label className="field field--checkbox">
                        <input
                          type="checkbox"
                          checked={
                            Array.isArray(gene.default) &&
                            gene.default.includes(allele)
                          }
                          onChange={(e) =>
                            toggleMultiDefault(allele, e.target.checked)
                          }
                        />
                        <span>
                          <code>{allele}</code>
                        </span>
                      </label>
                    ) : (
                      <code>{allele}</code>
                    )}
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={() => removeAllele(allele)}
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={render[allele] ?? ""}
                    onChange={(e) => setAllelePrompt(allele, e.target.value)}
                    placeholder="Prompt text for this allele (leave empty to render nothing)"
                    aria-label={`Prompt text for ${allele}`}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="allele-add">
            <label className="field">
              <span>New allele name</span>
              <input
                type="text"
                value={newAllele}
                onChange={(e) => setNewAllele(e.target.value)}
                placeholder="e.g. role_hijack"
              />
            </label>
            <label className="field">
              <span>Prompt text (optional)</span>
              <textarea
                rows={2}
                value={newAllelePrompt}
                onChange={(e) => setNewAllelePrompt(e.target.value)}
                placeholder="Text emitted when this allele is active"
              />
            </label>
            <button
              type="button"
              className="btn"
              onClick={addAllele}
              disabled={
                newAllele.trim() === "" ||
                alleles.includes(newAllele.trim())
              }
            >
              Add allele
            </button>
            {alleles.includes(newAllele.trim()) && newAllele.trim() !== "" && (
              <p className="hint">That allele already exists.</p>
            )}
          </div>
        </div>
      )}

      {hasAdvanced && (
        <details className="gene-card__advanced">
          <summary>Advanced (preserved, read-only)</summary>
          {gene.empty_alias !== undefined && (
            <p className="hint">
              <strong>Empty alias:</strong> <code>{String(gene.empty_alias)}</code>
            </p>
          )}
          {gene.render_full_override !== undefined && (
            <p className="hint">
              <strong>Full-override prompts:</strong> kept for{" "}
              {Object.keys(
                gene.render_full_override as Record<string, string>,
              ).join(", ") || "—"}
            </p>
          )}
        </details>
      )}
    </div>
  );
}
