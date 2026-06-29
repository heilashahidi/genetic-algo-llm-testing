import { useMemo, useState } from "react";
import type { IndividualRecord } from "../types";
import { fitnessColor, formatFitness, originClass } from "./IndividualDetail";

const SOLVE = 1; // fitness at/above the solve bar means the model was cracked
const MAX_SHOWN = 10;

/** Genome entries that actually contribute to the prompt (active genes only). */
function buildChips(genome: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const [gene, v] of Object.entries(genome)) {
    if (typeof v === "boolean") {
      if (v) out.push([gene, "on"]);
    } else if (Array.isArray(v)) {
      if (v.length > 0) out.push([gene, v.join("+")]);
    } else if (v != null && v !== "") {
      out.push([gene, String(v)]);
    }
  }
  return out;
}

function CrackCard({ ind, rank }: { ind: IndividualRecord; rank: number }) {
  const [copied, setCopied] = useState(false);
  const phenotype = ind.phenotype ?? "";
  const chips = buildChips(ind.genome);

  async function copyPrompt() {
    if (!phenotype) return;
    try {
      await navigator.clipboard.writeText(phenotype);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context or denied) — leave it be
    }
  }

  return (
    <li className="crack">
      <div className="crack__bar">
        <span className="crack__rank">{String(rank).padStart(2, "0")}</span>
        <span
          className="fitness-chip"
          style={{ background: fitnessColor(ind.fitness) }}
        >
          {formatFitness(ind.fitness)}
        </span>
        <span className="crack__tag">gen {ind.generation}</span>
        {ind.origin && (
          <span className={originClass(ind.origin)}>{ind.origin}</span>
        )}
        <code className="crack__id">{String(ind.individual_id)}</code>
        <button
          type="button"
          className="btn btn--small crack__copy"
          onClick={copyPrompt}
          disabled={!phenotype}
        >
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>

      {phenotype ? (
        <pre className="scroll-block crack__prompt">{phenotype}</pre>
      ) : (
        <p className="muted crack__nostore">
          Prompt text wasn't stored for this run.
        </p>
      )}

      {chips.length > 0 && (
        <div className="crack__build">
          <span className="crack__build-label">build</span>
          {chips.map(([gene, val]) => (
            <span key={gene} className="crack__chip">
              <span className="crack__chip-gene">{gene}</span>
              {val}
            </span>
          ))}
        </div>
      )}

      {ind.model_response && (
        <details className="collapsible crack__resp">
          <summary>Model response — the leak</summary>
          <div className="collapsible__body">
            <pre className="scroll-block scroll-block--short">
              {ind.model_response}
            </pre>
          </div>
        </details>
      )}
    </li>
  );
}

/**
 * The run's headline output: the prompts that broke the model. Surfaces every
 * distinct successful jailbreak (fitness >= solve bar) with the actual prompt
 * front-and-center and copyable, deduping the elites that carry one crack
 * forward across generations. Renders nothing until the model is first cracked.
 */
export function CracksPanel({
  individuals,
}: {
  individuals: IndividualRecord[];
}) {
  const cracks = useMemo(() => {
    const solved = individuals.filter((i) => (i.fitness ?? 0) >= SOLVE);
    // Earliest first — the breakthrough order — then dedupe by the prompt text
    // (elites repeat the same crack), falling back to the genome when unstored.
    solved.sort((a, b) => {
      if (a.generation !== b.generation) return a.generation - b.generation;
      return String(a.individual_id).localeCompare(String(b.individual_id));
    });
    const seen = new Set<string>();
    const distinct: IndividualRecord[] = [];
    for (const ind of solved) {
      const key = ind.phenotype ?? JSON.stringify(ind.genome);
      if (seen.has(key)) continue;
      seen.add(key);
      distinct.push(ind);
    }
    return distinct;
  }, [individuals]);

  if (cracks.length === 0) return null;

  const shown = cracks.slice(0, MAX_SHOWN);
  const hidden = cracks.length - shown.length;

  return (
    <section className="cracks">
      <header className="cracks__head">
        <div className="cracks__title">
          <span className="cracks__icon" aria-hidden>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 7.5-2" />
            </svg>
          </span>
          <div>
            <h2>Cracks</h2>
            <p className="cracks__sub">
              The prompts that broke the model (fitness ≥ 1.0). Copy any to reuse
              it.
            </p>
          </div>
        </div>
        <div className="cracks__count">
          <span className="cracks__count-num">{cracks.length}</span>
          <span className="cracks__count-label">winning prompts</span>
        </div>
      </header>

      <ol className="cracks__list">
        {shown.map((ind, i) => (
          <CrackCard key={String(ind.individual_id)} ind={ind} rank={i + 1} />
        ))}
      </ol>

      {hidden > 0 && (
        <p className="cracks__more">
          +{hidden} more distinct {hidden === 1 ? "crack" : "cracks"} — open the
          Table view to browse every solved individual.
        </p>
      )}
    </section>
  );
}
