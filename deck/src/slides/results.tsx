import React from "react";
import { SlideShell, Kicker, Title, Glass } from "../components/SlideShell";
import { Chip, Arrow } from "./ui";

export const HonestTest: React.FC = () => {
  const cols: [string, string, string][] = [
    ["GENETIC", "selection + crossover + mutation + memory", "#7fb0ff"],
    ["RANDOM", "fresh draws at equal budget; no memory", "rgba(255,255,255,0.5)"],
    ["SEED-ONLY", "the 121 real attacks as-is, no evolution", "#ffc488"],
  ];
  return (
    <SlideShell bg="network" page="Page 11">
      <div className="mt-[2%]">
        <Kicker num="11" sec="The Honest Test" />
        <Title className="mt-[1.4%]">GA against <span className="text-accent">random</span> and <span className="text-warm">seed-only</span>, equal budget</Title>
      </div>
      <div className="flex gap-[2.4%] flex-grow mt-[2.5%]">
        <Glass className="flex-[2] relative flex flex-col items-center justify-center rise">
          <div className="absolute inset-[20px_26px] flex flex-col justify-between">
            {[1, 0.5, 0].map((g) => (
              <div key={g} className="relative" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="mono absolute text-white/40" style={{ left: -24, top: -7, fontSize: 9.5 }}>{g.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className="text-center z-10">
            <div className="mono font-bold text-white/55" style={{ fontSize: "clamp(15px,1.9vw,22px)" }}>best / avg fitness drops in here</div>
            <div className="mono text-white/40 mt-[8px]" style={{ fontSize: 12 }}>populated live from Postgres · one run per experiment</div>
          </div>
          <span className="mono text-white/40 absolute" style={{ left: 26, bottom: 7, fontSize: 9.5 }}>gen 0</span>
          <span className="mono text-white/40 absolute" style={{ right: 26, bottom: 7, fontSize: 9.5 }}>30</span>
        </Glass>
        <div className="flex-1 flex flex-col gap-[10px]">
          {cols.map(([t, d, c], i) => (
            <Glass key={t} className="rise p-[3.4%]" style={{ animationDelay: `${i * 0.1}s`, borderLeft: `3px solid ${c}` }}>
              <div className="mono font-bold" style={{ fontSize: 13, color: c }}>{t}</div>
              <div className="text-white/60 mt-[2px]" style={{ fontSize: "clamp(11px,1.2vw,15px)" }}>{d}</div>
            </Glass>
          ))}
          <Glass className="rise p-[3.4%]" style={{ animationDelay: "0.3s" }}>
            <div className="mono text-white/45 tracking-[0.08em] mb-[6px]" style={{ fontSize: 11 }}>METRICS</div>
            <p className="text-white/60" style={{ fontSize: "clamp(11px,1.2vw,15px)", lineHeight: 1.5 }}>attack success rate · best & avg fitness / gen · time-to-first-success</p>
          </Glass>
        </div>
      </div>
    </SlideShell>
  );
};

export const Interpret: React.FC = () => {
  const alleles = ["persona_archetype", "framing_type", "override_mechanism", "encoding_method", "formatting_style"];
  const qs = [
    "Does the GA discover stronger adversarial variants over time?",
    "Which prompt traits are most associated with policy failures?",
    "Are wins driven by semantic structure, surface perturbation, or their interaction?",
  ];
  return (
    <SlideShell bg="network" page="Page 12">
      <div className="mt-[2%]">
        <Kicker num="12" sec="Interpretability" />
        <Title className="mt-[1.4%]">Which <span className="text-accent">traits</span> drive successful attacks</Title>
      </div>
      <div className="grid grid-cols-2 gap-[4%] flex-grow mt-[2%]">
        <Glass className="rise p-[4%]">
          <div className="mono text-white/45 tracking-[0.1em] mb-[16px]" style={{ fontSize: 11.5 }}>ALLELE FREQUENCY AMONG WINNING GENOMES</div>
          {alleles.map((k) => (
            <div key={k} className="flex items-center gap-[12px] mb-[14px]">
              <span className="mono text-white/65 text-right" style={{ fontSize: 12.5, width: 152 }}>{k}</span>
              <div className="flex-1 h-[13px] rounded-full bg-white/10" />
              <span className="mono text-white/40" style={{ fontSize: 14, letterSpacing: "0.1em" }}>··</span>
            </div>
          ))}
          <Chip>from your run · Allele Explorer ranks genes most associated with high fitness</Chip>
        </Glass>
        <div className="rise" style={{ animationDelay: "0.15s" }}>
          <div className="mono text-white/45 tracking-[0.1em] mb-[12px]" style={{ fontSize: 11.5 }}>RESEARCH QUESTIONS</div>
          {qs.map((q, i) => (
            <Glass key={i} className="flex gap-[12px] mb-[10px] p-[3%] items-center">
              <div className="mono text-[#06122e] bg-accent inline-flex items-center justify-center font-bold rounded-[8px] shrink-0" style={{ width: 28, height: 28, fontSize: 13 }}>{i + 1}</div>
              <p style={{ fontSize: "clamp(12px,1.3vw,17px)" }}>{q}</p>
            </Glass>
          ))}
          <p className="text-white/60 mt-[2%]" style={{ fontSize: "clamp(11px,1.2vw,15px)" }}>
            <span className="text-accent font-semibold">Channel-aware crossover</span> keeps semantic & perturbation genes separable — so we can ask whether noise <i>actually</i> helps, or the strategy carries the win.
          </p>
        </div>
      </div>
    </SlideShell>
  );
};

export const Models: React.FC = () => {
  const rows: [string, string, string, string, number, string, string, boolean][] = [
    ["Mistral-7B-Instruct-v0.2", "7B", "26%", "90%", 90, "weakest", "Soft target — validate the GA loop fast", false],
    ["Llama-3.1-8B-Instruct", "8B", "4%", "40%", 40, "strong", "Headline GA-vs-random comparator", true],
    ["Qwen2.5-7B-Instruct", "7B", "10%", "60%", 60, "moderate", "Cross-family transfer target", false],
    ["Gemma-2-9B-it · stretch", "9B", "4%", "35%", 35, "strong", "Hard-target stress test", false],
  ];
  return (
    <SlideShell bg="dust" page="Page 13">
      <div className="mt-[2%]">
        <Kicker num="13" sec="Target Models" />
        <Title className="mt-[1.4%]">Small, local, aligned — an <span className="text-accent">easy → hard</span> gradient</Title>
      </div>
      <Glass className="rise p-[3%] mt-[2.5%]">
        <div className="grid items-center" style={{ gridTemplateColumns: "1.7fr 0.5fr 1.7fr 1.7fr", fontSize: "clamp(11px,1.2vw,15px)" }}>
          {["MODEL", "SIZE", "HARMBENCH ASR · MEDIAN / MAX", "ROLE"].map((h) => (
            <div key={h} className="mono text-white/40 pb-[10px] tracking-[0.06em]" style={{ fontSize: 11, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>{h}</div>
          ))}
          {rows.map((r, i) => (
            <React.Fragment key={r[0]}>
              <div className="py-[13px] font-semibold" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", borderLeft: r[7] ? "3px solid #7fb0ff" : "3px solid transparent", paddingLeft: 12 }}>
                {r[0]}{r[7] && <span className="mono ml-[8px] text-accent" style={{ fontSize: 11 }}>· headline</span>}
              </div>
              <div className="py-[13px] mono" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{r[1]}</div>
              <div className="py-[13px] flex items-center gap-[10px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="mono" style={{ minWidth: 84 }}><b className="text-white">{r[2]}</b> / <b className="text-warm">&gt;{r[3]}</b></span>
                <div className="flex-1 h-[9px] rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r[4]}%`, background: "linear-gradient(90deg,#c75f17,#ffc488)", transition: "width 1s", transitionDelay: `${i * 0.1}s` }} />
                </div>
              </div>
              <div className="py-[13px] text-white/55" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: "clamp(10px,1.1vw,14px)" }}>{r[5]} · {r[6]}</div>
            </React.Fragment>
          ))}
        </div>
      </Glass>
      <p className="text-white/70 rise mt-[2%]" style={{ fontSize: "clamp(11px,1.2vw,16px)", animationDelay: "0.3s" }}>
        <Arrow>→ </Arrow>Every model has a <span className="text-warm font-semibold">&gt;35% reachable max ASR</span> — real headroom to climb. One experiment is 20k–60k calls: vLLM for batch (≈16× Ollama), Ollama for the live demo.
      </p>
    </SlideShell>
  );
};

export const Arch: React.FC = () => {
  const nodes: [string, string][] = [
    ["Frontend", "React — create, start, stop & configure runs; live charts & lineage"],
    ["API plane", "stateless, no GA logic — actions → DB rows, streams changes back"],
    ["PostgreSQL", "single source of truth and the coordination channel"],
    ["Runner agent", "restartable, no HTTP/UI — claims a queued run, executes the GA loop"],
  ];
  return (
    <SlideShell bg="network" page="Page 14">
      <div className="mt-[2%]">
        <Kicker num="14" sec="System Architecture" />
        <Title className="mt-[1.4%]">The <span className="text-accent">database</span> is the control plane</Title>
      </div>
      <div className="flex flex-col justify-center flex-grow">
        <div className="flex items-stretch gap-[8px]">
          {nodes.map(([t, d], i) => (
            <React.Fragment key={t}>
              <Glass className="flex-1 rise p-[2%]" style={{ animationDelay: `${i * 0.12}s`, borderTop: "3px solid #7fb0ff", background: i === 2 ? "rgba(31,75,160,0.4)" : undefined }}>
                <div className="mono font-bold text-accent" style={{ fontSize: "clamp(12px,1.3vw,16px)" }}>{t}</div>
                <p className="text-white/65 mt-[6px]" style={{ fontSize: "clamp(10px,1.1vw,14px)" }}>{d}</p>
              </Glass>
              {i < 3 && <Arrow className="self-center text-[20px]">↔</Arrow>}
            </React.Fragment>
          ))}
        </div>
        <div className="text-center my-[1.6%] rise" style={{ animationDelay: "0.5s" }}>
          <Arrow>→ </Arrow><span className="mono text-white/55" style={{ fontSize: 13 }}>Target LLM · Ollama · LM Studio · vLLM · any OpenAI-compatible</span>
        </div>
        <div className="flex gap-[16px] rise" style={{ animationDelay: "0.58s" }}>
          <Glass className="flex-[2] p-[2.4%]" style={{ borderLeft: "3px solid #7fb0ff" }}>
            <p style={{ fontSize: "clamp(12px,1.3vw,17px)" }}>Components <span className="text-accent font-semibold">never call each other directly</span> — they coordinate only through Postgres. <span className="mono" style={{ fontSize: "0.9em" }}>SELECT … FOR UPDATE SKIP LOCKED</span> lets multiple runners coexist.</p>
          </Glass>
          <Glass className="flex-1 p-[2.4%] text-center" style={{ background: "linear-gradient(120deg, rgba(19,32,58,0.6), rgba(33,64,127,0.5))" }}>
            <div className="mono text-accent tracking-[0.12em]" style={{ fontSize: 11 }}>ONE COMMAND</div>
            <div className="mono font-bold my-[6px]" style={{ fontSize: "clamp(14px,1.6vw,20px)" }}>docker compose up</div>
            <div className="mono text-white/55" style={{ fontSize: 11 }}>postgres → migrate → api + runner + frontend</div>
          </Glass>
        </div>
      </div>
    </SlideShell>
  );
};

const LineageSVG: React.FC = () => {
  const champ = "M40,55 C140,55 150,150 240,140 C320,132 360,95 440,90";
  return (
    <svg viewBox="0 0 460 230" style={{ width: "100%", height: 200 }}>
      <path d="M55,55 C150,70 150,150 175,165" stroke="rgba(255,255,255,0.18)" strokeWidth="3" fill="none" />
      <path d="M175,165 C260,180 300,150 350,150" stroke="rgba(255,255,255,0.12)" strokeWidth="3" fill="none" />
      <path d="M175,165 C260,180 300,195 330,205" stroke="rgba(255,255,255,0.12)" strokeWidth="3" fill="none" />
      <path d={champ} stroke="#7fb0ff" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeDasharray="600" strokeDashoffset="600" style={{ animation: "draw 1.6s 0.3s ease forwards" }} />
      {([[40, 55, 9, "#bcd3ff"], [240, 140, 13, "#7fb0ff"], [350, 90, 16, "#5b8fe0"], [440, 90, 20, "#3a63b8"]] as [number, number, number, string][]).map(([x, y, r, c], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={c} style={{ opacity: 0, animation: `pop 0.4s ${0.4 + i * 0.25}s forwards` }} />
      ))}
      {([[175, 165, 11], [350, 150, 10], [330, 205, 10]] as [number, number, number][]).map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="rgba(255,255,255,0.35)" style={{ opacity: 0, animation: `pop 0.4s ${0.6 + i * 0.2}s forwards` }} />
      ))}
      <text x="34" y="36" className="mono" fontSize="14" fill="rgba(255,255,255,0.5)">gen 0</text>
      <text x="372" y="76" className="mono" fontSize="15" fill="#7fb0ff" fontWeight="700">champion</text>
      <style>{`@keyframes draw{to{stroke-dashoffset:0}}@keyframes pop{from{opacity:0;transform:scale(0.6)}to{opacity:1;transform:scale(1)}}`}</style>
    </svg>
  );
};
const FitnessChart: React.FC = () => {
  const pts: [number, number][] = [[0, 0.18], [5, 0.22], [10, 0.35], [14, 0.3], [18, 0.52], [22, 0.66], [26, 0.8], [30, 1.0]];
  const avg: [number, number][] = [[0, 0.12], [8, 0.18], [16, 0.3], [24, 0.42], [30, 0.55]];
  const W = 320, H = 130, P = 24;
  const x = (g: number) => P + (g / 30) * (W - 2 * P);
  const y = (f: number) => H - P - f * (H - 2 * P);
  const line = (a: [number, number][]) => a.map((p, i) => (i ? "L" : "M") + x(p[0]) + "," + y(p[1])).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={P} y1={y(g)} x2={W - P} y2={y(g)} stroke="rgba(255,255,255,0.08)" />
          <text x={4} y={y(g) + 3} className="mono" fontSize="9" fill="rgba(255,255,255,0.4)">{g.toFixed(1)}</text>
        </g>
      ))}
      <path d={line(avg)} stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" strokeDasharray="4 4" />
      <path d={line(pts)} stroke="#7fb0ff" strokeWidth="2.5" fill="none" strokeDasharray="500" strokeDashoffset="500" style={{ animation: "draw 1.4s 0.2s ease forwards" }} />
      <text x={P} y={H - 4} className="mono" fontSize="9" fill="rgba(255,255,255,0.4)">gen 0</text>
      <text x={W - P - 18} y={H - 4} className="mono" fontSize="9" fill="rgba(255,255,255,0.4)">30</text>
    </svg>
  );
};

export const Dashboard: React.FC = () => (
  <SlideShell bg="network" page="Page 15">
    <div className="mt-[2%]">
      <Kicker num="15" sec="The Dashboard" />
      <Title className="mt-[1.4%]">Runs are driven <span className="text-accent">live from the browser</span></Title>
    </div>
    <div className="grid gap-[2.4%] flex-grow mt-[2%]" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
      <Glass className="rise p-[3.4%] overflow-hidden">
        <div className="mono font-bold text-accent mb-[2px]" style={{ fontSize: 12 }}>Lineage Tree — signature view</div>
        <div className="text-white/55 mb-[6px]" style={{ fontSize: 12 }}>fitness-encoded nodes · champion bloodline highlighted</div>
        <LineageSVG />
      </Glass>
      <div className="flex flex-col gap-[14px]">
        <Glass className="rise p-[4%] flex-1" style={{ animationDelay: "0.12s" }}>
          <div className="mono font-bold text-accent mb-[8px]" style={{ fontSize: 12 }}>Run detail — fitness over generations</div>
          <FitnessChart />
        </Glass>
        <div className="rise flex gap-[10px] flex-wrap" style={{ animationDelay: "0.24s" }}>
          {["Allele Explorer", "Runs list", "New run", "Schema editor"].map((t) => <Chip key={t}>{t}</Chip>)}
        </div>
      </div>
    </div>
  </SlideShell>
);

export const Rigor: React.FC = () => {
  const items: [string, string, string][] = [
    ["01", "Seeded & reproducible", "Fixed seed (42) reproduces a run exactly; the chromosome codec round-trips losslessly (encode ↔ decode tested)."],
    ["02", "Broad test suite", "pytest across codec, operators, phenotype rendering (golden-file), population init, fitness, storage, and API."],
    ["03", "Offline by default", "A deterministic mock harness + synthetic scorer run the whole loop with no model; real-model runs are opt-in."],
    ["04", "Clean-architecture boundaries", "The GA core knows nothing of HTTP, UI, or the database; every external value crosses a typed seam."],
  ];
  return (
    <SlideShell bg="dust" page="Page 16">
      <div className="mt-[2%]">
        <Kicker num="16" sec="Engineering Rigor" />
        <Title className="mt-[1.4%]">Reproducible, tested, <span className="text-accent">architecturally disciplined</span></Title>
      </div>
      <div className="grid gap-[2.4%] flex-grow mt-[2.5%]" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        <div className="grid grid-cols-2 gap-[18px]">
          {items.map(([n, t, d], i) => (
            <Glass key={n} className="rise p-[4%]" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="mono text-[#06122e] bg-accent inline-flex items-center justify-center font-bold rounded-[8px] mb-[10px]" style={{ width: 30, height: 30, fontSize: 14 }}>{n}</div>
              <h3 className="font-bold" style={{ fontSize: "clamp(13px,1.4vw,18px)" }}>{t}</h3>
              <p className="text-white/65 mt-[4px]" style={{ fontSize: "clamp(11px,1.15vw,15px)" }}>{d}</p>
            </Glass>
          ))}
        </div>
        <Glass className="rise p-[5%]" style={{ animationDelay: "0.3s", background: "rgba(5,9,20,0.55)" }}>
          <div className="mono text-accent tracking-[0.12em] mb-[14px]" style={{ fontSize: 12 }}>CI · HERMETIC & FAST</div>
          {["codec round-trip", "evolution operators", "phenotype golden-file", "fitness & storage", "API integration"].map((t) => (
            <div key={t} className="mono flex gap-[10px] mb-[11px] text-white/85" style={{ fontSize: "clamp(11px,1.2vw,15px)" }}>
              <span style={{ color: "#5fd99a" }}>✓</span>{t}
            </div>
          ))}
          <div className="mono text-white/45 mt-[8px]" style={{ fontSize: 12 }}>no model needed to pass.</div>
        </Glass>
      </div>
    </SlideShell>
  );
};

export const Takeaways: React.FC = () => {
  const pillars: [string, string, string][] = [
    ["Structured & interpretable", "A 16-gene genome (~20-trillion search space) seeded from 121 real attacks — every win traceable gene-by-gene and across its lineage.", "🧬"],
    ["Honest methodology", "GA measured against random and seed-only baselines at equal budget, across a real easy→hard model gradient.", "⚖️"],
    ["Real, controllable system", "Postgres control plane, live dashboard, Dockerized, reproducible, offline-testable — not a one-shot script.", "⚙️"],
  ];
  return (
    <SlideShell bg="warp" page="Page 17">
      <div className="mt-[2%]">
        <Kicker num="17" sec="Takeaways" />
        <Title className="mt-[1.4%]">Which traits broke it — <span className="text-accent">seeded real, evolved beyond</span></Title>
      </div>
      <div className="grid grid-cols-3 gap-[2.4%] mt-[3%]">
        {pillars.map(([t, d, e], i) => (
          <Glass key={t} className="rise p-[5%]" style={{ animationDelay: `${i * 0.12}s`, borderTop: "3px solid #7fb0ff" }}>
            <div style={{ fontSize: "clamp(22px,2.6vw,32px)" }} className="mb-[10px]">{e}</div>
            <div className="mono text-white/45" style={{ fontSize: 12 }}>0{i + 1}</div>
            <h3 className="font-bold mt-[4px]" style={{ fontSize: "clamp(14px,1.6vw,20px)" }}>{t}</h3>
            <p className="text-white/70 mt-[6px]" style={{ fontSize: "clamp(11px,1.2vw,16px)" }}>{d}</p>
          </Glass>
        ))}
      </div>
      <Glass className="rise mt-[2.4%] p-[3%] text-center" style={{ animationDelay: "0.4s", background: "linear-gradient(100deg, rgba(19,32,58,0.6), rgba(33,64,127,0.5))" }}>
        <p style={{ fontSize: "clamp(15px,1.8vw,24px)", lineHeight: 1.45 }}>
          A <span className="text-accent font-semibold">safe, interpretable microscope</span> for adversarial prompting — measure <span className="text-warm font-semibold">which</span> prompt traits cause failures, not just <span className="text-warm font-semibold">that</span> they do.
        </p>
      </Glass>
    </SlideShell>
  );
};
