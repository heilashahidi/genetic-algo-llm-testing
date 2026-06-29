import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { GeneChannel, GeneSchema, GeneType, GenomeSchema } from "../types";
import { GeneEditor } from "../components/GeneEditor";
import { StatTile } from "../components/StatTile";
import { useCountUp } from "../useCountUp";

const CHANNELS: { key: GeneChannel; label: string }[] = [
  { key: "semantic", label: "Semantic" },
  { key: "perturbation", label: "Perturbation" },
];

const NEW_GENE_TYPES: { value: GeneType; label: string }[] = [
  { value: "categorical", label: "Single choice" },
  { value: "multi_categorical", label: "Multiple choice" },
  { value: "boolean", label: "On / off" },
];

const SPACE_FMT = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Distinct prompts this genome can express — the headline "design space". */
function genomeSpace(genes: GeneSchema[]): number {
  let space = 1;
  for (const g of genes) {
    const k = g.alleles?.length ?? 0;
    if (g.type === "boolean") space *= 2;
    else if (g.type === "multi_categorical") space *= 2 ** k;
    else space *= Math.max(1, k);
  }
  return space;
}

function formatSpace(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  if (n < 1000) return Math.round(n).toLocaleString();
  if (n < 1e15) return SPACE_FMT.format(n);
  const exp = Math.floor(Math.log10(n));
  return `${(n / 10 ** exp).toFixed(1)}e${exp}`;
}

/** Count-up "genome space" tile — the genome's accent-spotlit headline stat. */
function SpaceTile({ value }: { value: number }) {
  const shown = useCountUp(value);
  return (
    <div className="kpi kpi--hero">
      <span className="kpi__num">{formatSpace(shown)}</span>
      <span className="kpi__label">genome space</span>
    </div>
  );
}

/** Build an empty gene with sensible defaults for its type. */
function makeGene(name: string, channel: GeneChannel, type: GeneType): GeneSchema {
  if (type === "boolean") {
    return { name, channel, type, default: false, render_true: "" };
  }
  if (type === "multi_categorical") {
    return { name, channel, type, default: [], alleles: [], render: {} };
  }
  return { name, channel, type, default: "", alleles: [], render: {} };
}

/** Client-side validation mirroring the server's rules; returns first error. */
function validate(schema: GenomeSchema): string | null {
  const names = new Set<string>();
  for (const gene of schema.genes) {
    const name = gene.name.trim();
    if (name === "") return "Every gene needs a non-empty name.";
    if (names.has(name)) return `Duplicate gene name: "${name}".`;
    names.add(name);

    if (gene.type === "categorical" || gene.type === "multi_categorical") {
      const alleles = gene.alleles ?? [];
      if (alleles.length === 0) {
        return `Gene "${name}" needs at least one allele.`;
      }
      if (
        gene.type === "categorical" &&
        !alleles.includes(gene.default as string)
      ) {
        return `Gene "${name}" default must be one of its alleles.`;
      }
    }
  }
  for (const name of schema.render_order) {
    if (!names.has(name)) {
      return `render_order references unknown gene "${name}".`;
    }
  }
  for (const gene of schema.genes) {
    if (!schema.render_order.includes(gene.name)) {
      return `Gene "${gene.name}" is missing from render_order.`;
    }
  }
  return null;
}

export function SchemaEditorPage() {
  const [schema, setSchema] = useState<GenomeSchema | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add-gene form.
  const [newName, setNewName] = useState("");
  const [newChannel, setNewChannel] = useState<GeneChannel>("semantic");
  const [newType, setNewType] = useState<GeneType>("categorical");

  useEffect(() => {
    let cancelled = false;
    api
      .getSchema()
      .then((data) => {
        if (!cancelled) {
          // Deep clone so local edits never mutate the fetched object.
          setSchema(structuredClone(data));
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load schema.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Index genes by name so we can render them in render_order.
  const genesByName = useMemo(() => {
    const map = new Map<string, GeneSchema>();
    if (schema) for (const g of schema.genes) map.set(g.name, g);
    return map;
  }, [schema]);

  // Genes in render_order, grouped by channel. Any gene not in render_order is
  // appended (defensive — the editor keeps them in sync, but never hide one).
  const ordered = useMemo(() => {
    if (!schema) return [] as GeneSchema[];
    const seen = new Set<string>();
    const list: GeneSchema[] = [];
    for (const name of schema.render_order) {
      const g = genesByName.get(name);
      if (g) {
        list.push(g);
        seen.add(name);
      }
    }
    for (const g of schema.genes) if (!seen.has(g.name)) list.push(g);
    return list;
  }, [schema, genesByName]);

  function dirtySave(): void {
    setSaved(false);
    setSaveError(null);
  }

  function replaceGene(name: string, next: GeneSchema): void {
    if (!schema) return;
    dirtySave();
    setSchema({
      ...schema,
      genes: schema.genes.map((g) => (g.name === name ? next : g)),
    });
  }

  function removeGene(name: string): void {
    if (!schema) return;
    if (!window.confirm(`Remove gene "${name}"? This also removes its prompts.`)) {
      return;
    }
    dirtySave();
    setSchema({
      ...schema,
      genes: schema.genes.filter((g) => g.name !== name),
      render_order: schema.render_order.filter((n) => n !== name),
    });
  }

  // Reorder by swapping the gene with its neighbour in render_order.
  function moveGene(name: string, direction: -1 | 1): void {
    if (!schema) return;
    const order = [...schema.render_order];
    const i = order.indexOf(name);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    dirtySave();
    setSchema({ ...schema, render_order: order });
  }

  function addGene(): void {
    if (!schema) return;
    const name = newName.trim();
    if (name === "") return;
    if (genesByName.has(name)) {
      setSaveError(`A gene named "${name}" already exists.`);
      return;
    }
    dirtySave();
    setSchema({
      ...schema,
      genes: [...schema.genes, makeGene(name, newChannel, newType)],
      render_order: [...schema.render_order, name],
    });
    setNewName("");
  }

  async function save(): Promise<void> {
    if (!schema) return;
    const problem = validate(schema);
    if (problem) {
      setSaved(false);
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await api.putSchema(schema);
      setSchema(structuredClone(result));
      setSaved(true);
    } catch (err) {
      setSaved(false);
      if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        setSaveError(err instanceof Error ? err.message : "Failed to save schema.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <section>
        <div className="page-head">
          <h1>Genome</h1>
        </div>
        <div className="alert alert--error">{loadError}</div>
      </section>
    );
  }

  if (!schema) {
    return (
      <section>
        <div className="page-head">
          <h1>Genome</h1>
        </div>
        <p className="muted">Loading genome schema…</p>
      </section>
    );
  }

  const orderIndex = (name: string): number => schema.render_order.indexOf(name);

  return (
    <section>
      <div className="page-head">
        <h1>Genome</h1>
        <button
          type="button"
          className="btn btn--primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save draft genome"}
        </button>
      </div>

      <section className="genome-hero">
        <p className="genome-hero__sub">
          The gene blueprint every new run is built from. Edits apply to{" "}
          <strong>new runs</strong> you start after saving; existing runs keep
          their own snapshot.
        </p>
        <div className="genome-hero__kpis">
          <SpaceTile value={genomeSpace(schema.genes)} />
          <StatTile value={schema.genes.length} label="genes" />
          <StatTile
            value={schema.genes.reduce(
              (sum, g) => sum + (g.alleles?.length ?? 0),
              0,
            )}
            label="alleles"
          />
        </div>
      </section>

      {saveError && <div className="alert alert--error">{saveError}</div>}
      {saved && (
        <div className="alert alert--success">Draft genome saved.</div>
      )}

      {CHANNELS.map((channel) => {
        const channelGenes = ordered.filter((g) => g.channel === channel.key);
        return (
          <div key={channel.key} className="gene-group">
            <div className="gene-group__head">
              <h2 className="gene-group__title">{channel.label}</h2>
              <span className="gene-group__count">
                {channelGenes.length}{" "}
                {channelGenes.length === 1 ? "gene" : "genes"}
              </span>
            </div>
            {channelGenes.length === 0 ? (
              <p className="muted">No {channel.label.toLowerCase()} genes.</p>
            ) : (
              channelGenes.map((gene) => {
                const idx = orderIndex(gene.name);
                return (
                  <GeneEditor
                    key={gene.name}
                    gene={gene}
                    position={idx + 1}
                    isFirst={idx === 0}
                    isLast={idx === schema.render_order.length - 1}
                    onChange={(next) => replaceGene(gene.name, next)}
                    onRemove={() => removeGene(gene.name)}
                    onMoveUp={() => moveGene(gene.name, -1)}
                    onMoveDown={() => moveGene(gene.name, 1)}
                  />
                );
              })
            )}
          </div>
        );
      })}

      <div className="card add-gene">
        <h2>Add a gene</h2>
        <p className="hint">
          The new gene is appended to the prompt order; reorder it with the
          ↑ / ↓ buttons after creating it.
        </p>
        <div className="add-gene__fields">
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. tone_shift"
            />
          </label>
          <label className="field">
            <span>Channel</span>
            <select
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value as GeneChannel)}
            >
              {CHANNELS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Type</span>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as GeneType)}
            >
              {NEW_GENE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            onClick={addGene}
            disabled={newName.trim() === "" || genesByName.has(newName.trim())}
          >
            Add gene
          </button>
        </div>
      </div>
    </section>
  );
}
