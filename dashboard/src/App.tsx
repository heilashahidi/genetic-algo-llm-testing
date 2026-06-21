import { useEffect, useMemo, useState, type ReactNode } from "react";
import Badge from "./components/Badge";
import Card from "./components/Card";
import * as agg from "./aggregate";
import BarChart from "./charts/BarChart";
import LineChart, { type Series } from "./charts/LineChart";
import LineageGraph from "./charts/LineageGraph";
import type { ResultRecord, Search } from "./contract";
import { fetchRecords, parseRecords, type Loaded } from "./load";

const ACCENT = "#4f5a78";
const MUTED = "#9a9da5";
const pct = (v: number) => `${Math.round(v * 100)}%`;

const SEARCH_LABEL: Record<Search, string> = { genetic: "genetic", random: "random" };

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; loaded: Loaded };

export default function App() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    fetchRecords()
      .then((loaded) => setState({ status: "ready", loaded }))
      .catch((e: unknown) => setState({ status: "error", message: e instanceof Error ? e.message : String(e) }));
  }, []);

  const onFile = async (file: File) => {
    setState({ status: "ready", loaded: parseRecords(await file.text()) });
  };

  return (
    <div className="relative min-h-full">
      <div className="dot-grid pointer-events-none fixed inset-0 z-0" />
      <main className="relative z-10 mx-auto max-w-[920px] px-6 py-14">
        <Header onFile={onFile} state={state} />
        {state.status === "loading" && <Note>Loading run store…</Note>}
        {state.status === "error" && <EmptyState message={state.message} />}
        {state.status === "ready" &&
          (state.loaded.records.length === 0 ? (
            <EmptyState message="The store is empty." />
          ) : (
            <Dashboard records={state.loaded.records} />
          ))}
      </main>
    </div>
  );
}

function Header({ onFile, state }: { onFile: (f: File) => void; state: State }) {
  const skipped = state.status === "ready" ? state.loaded.skipped : 0;
  return (
    <header className="mb-12 flex items-end justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <LogoMark />
        <div>
          <div className="font-mono text-[11px] text-muted-2">genome evolution</div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">LLM robustness — genetic search</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {skipped > 0 && (
          <Badge className="border-accent-amber/50 bg-accent-amber/10 text-accent-amber">{skipped} skipped</Badge>
        )}
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-[12px] font-medium text-ink-2 transition hover:border-accent/40 hover:bg-surface hover:text-ink">
          Load .jsonl
          <input
            type="file"
            accept=".jsonl,.json,application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      </div>
    </header>
  );
}

function Dashboard({ records }: { records: ResultRecord[] }) {
  const view = useMemo(() => {
    const searches = agg.searchesIn(records);
    const summaries = searches.map((s) => agg.summarize(records, s));
    const colors: Record<Search, string> = { genetic: ACCENT, random: MUTED };

    const fitness: Series[] = [];
    const success: Series[] = [];
    for (const s of searches) {
      const gen = agg.perGeneration(records, s);
      fitness.push({
        label: `${SEARCH_LABEL[s]} best`,
        color: colors[s],
        points: gen.map((g) => ({ x: g.generation, y: g.best })),
      });
      fitness.push({
        label: `${SEARCH_LABEL[s]} avg`,
        color: colors[s],
        dashed: true,
        points: gen.map((g) => ({ x: g.generation, y: g.avg })),
      });
      success.push({
        label: SEARCH_LABEL[s],
        color: colors[s],
        points: gen.map((g) => ({ x: g.generation, y: g.successRate })),
      });
    }

    const genes = agg.topGenesInViolations(records).map((g) => ({
      label: `${g.gene} = ${g.value}`,
      value: g.count,
      caption: `${g.count} · ${pct(g.share)}`,
    }));

    return {
      summaries,
      fitness,
      success,
      genes,
      lineage: agg.lineageOfBest(records),
      champion: agg.bestRecord(records, "genetic"),
    };
  }, [records]);

  return (
    <div className="flex flex-col gap-12">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {view.summaries.map((s) => (
          <SummaryCard key={s.search} summary={s} />
        ))}
      </section>

      <Section label="Fitness over generations — best (solid) · average (dashed)">
        <Card>
          <LineChart series={view.fitness} />
        </Card>
      </Section>

      <Section label="Attack success rate over generations">
        <Card>
          <LineChart series={view.success} yMax={1} formatY={pct} yTicks={[0, 0.25, 0.5, 0.75, 1]} />
        </Card>
      </Section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <Section label="Top genes in policy violations">
          <Card className="h-full">
            <BarChart bars={view.genes} />
          </Card>
        </Section>
        <Section label="Champion lineage — recent ancestry (parent → child)">
          <Card className="h-full">
            <LineageGraph nodes={view.lineage.nodes} edges={view.lineage.edges} />
          </Card>
        </Section>
      </div>

      {view.champion && <Champion record={view.champion} />}
    </div>
  );
}

function SummaryCard({ summary }: { summary: agg.Summary }) {
  const isGA = summary.search === "genetic";
  return (
    <Card className={isGA ? "border-accent/30" : ""}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] font-semibold capitalize">{SEARCH_LABEL[summary.search]} search</div>
        <Badge
          className={
            summary.violations > 0
              ? "border-accent-green/50 bg-accent-green/10 text-accent-green"
              : "border-line bg-card text-muted"
          }
        >
          {summary.violations} violations
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat label="evaluations" value={String(summary.evals)} />
        <Stat label="best fitness" value={summary.best.toFixed(3)} />
        <Stat label="success rate" value={pct(summary.successRate)} />
        <Stat label="first violation" value={summary.firstViolation === null ? "—" : `eval ${summary.firstViolation}`} />
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[18px] font-semibold tracking-[-0.01em] tabular-nums">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-2">{label}</div>
    </div>
  );
}

function Champion({ record }: { record: ResultRecord }) {
  const genes = [
    ...Object.entries(record.genome.semantic_channel),
    ...Object.entries(record.genome.perturbation_channel),
  ];
  return (
    <Section label="Champion genome — phenotype & response">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge className="border-accent-green/50 bg-accent-green/10 text-accent-green">{record.outcome}</Badge>
          <span className="font-mono text-[11px] text-muted-2">{record.genome_id}</span>
          <span className="text-[11px] text-muted">fitness {record.fitness.toFixed(3)}</span>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {genes.map(([k, v]) => (
            <Badge key={k} className="font-mono">
              {k}: {String(v)}
            </Badge>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Pane title="rendered prompt (phenotype)" body={record.rendered_prompt} />
          <Pane title="model response" body={record.response} />
        </div>
      </Card>
    </Section>
  );
}

function Pane({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-2">{title}</div>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-card border border-line bg-surface p-3 font-mono text-[11px] leading-relaxed text-ink-2 scrollbar-none">
        {body}
      </pre>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="animate-riseIn">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-2">{label}</h2>
      {children}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div className="text-[13px] text-muted">{children}</div>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="text-[14px] font-semibold">No run to display</div>
      <div className="max-w-[420px] text-balance text-[12.5px] text-muted">{message}</div>
      <div className="mt-1 rounded-card border border-line bg-surface px-3 py-2 font-mono text-[11px] text-ink-2">
        python -m ga.run --search compare
      </div>
      <div className="text-[11px] text-muted-2">…then reload, or use “Load .jsonl” to open any run’s records.</div>
    </Card>
  );
}

function LogoMark() {
  return (
    <div className="group [perspective:140px]">
      <div className="grid h-7 w-7 place-items-center rounded-[8px] bg-ink shadow-card transition-transform duration-300 ease-out group-hover:[transform:rotateX(18deg)_rotateY(-22deg)_scale(1.06)]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <g stroke="#0b0b0d" strokeWidth="0.5" strokeLinejoin="round">
            <path d="M12 3 L19 7 L12 11 L5 7 Z" fill="#ffffff" fillOpacity="0.95" />
            <path d="M5 7 L12 11 L12 19.5 L5 15.5 Z" fill="#ffffff" fillOpacity="0.42" />
            <path d="M19 7 L12 11 L12 19.5 L19 15.5 Z" fill="#ffffff" fillOpacity="0.24" />
          </g>
        </svg>
      </div>
    </div>
  );
}
