import React from "react";
import { SlideShell, Kicker, Title, Glass } from "../components/SlideShell";
import { Arrow, Shot } from "./ui";

export const HonestTest: React.FC = () => (
  <SlideShell page="Page 11">
    <div className="mt-[2%]">
      <Kicker num="11" sec="The Honest Test" />
      <Title className="mt-[1.4%]">GA vs. random at <span className="text-accent">equal budget</span> — and evolution wins</Title>
    </div>
    <div className="grid grid-cols-2 gap-[2.6%] flex-grow mt-[2.6%] items-center">
      <div className="rise">
        <div className="mono text-white/45 tracking-[0.1em] mb-[10px]" style={{ fontSize: 11.5 }}>HEADLINE RESULT · 720 ATTEMPTS EACH</div>
        <Shot src="verdict.png" alt="Evolution beat random search: genetic 13% jailbreak rate vs random 0%" className="w-full" />
      </div>
      <div className="rise" style={{ animationDelay: "0.15s" }}>
        <div className="mono text-white/45 tracking-[0.1em] mb-[10px]" style={{ fontSize: 11.5 }}>JAILBREAK RATE PER GENERATION</div>
        <Shot src="ga-vs-random.png" alt="Jailbreak rate per generation: the genetic algorithm climbs while random search stays at zero" className="w-full" />
      </div>
    </div>
    <p className="text-white/70 rise mt-[2.2%]" style={{ fontSize: "clamp(11px,1.2vw,16px)", animationDelay: "0.3s" }}>
      <Arrow>→ </Arrow>Real run on the deterministic synthetic policy (reveal a secret token), <span className="text-white font-semibold">equal budget &amp; seed 42</span>: genetic search broke it <span className="text-accent font-semibold">92×</span> (first at eval 339); random search <span className="text-warm font-semibold">never did</span>.
    </p>
  </SlideShell>
);

export const Interpret: React.FC = () => {
  const qs = [
    "Does the GA discover stronger adversarial variants over time?",
    "Which prompt traits are most associated with policy failures?",
    "Are wins driven by semantic structure, surface perturbation, or their interaction?",
  ];
  return (
    <SlideShell page="Page 12">
      <div className="mt-[2%]">
        <Kicker num="12" sec="Interpretability" />
        <Title className="mt-[1.4%]">Which <span className="text-accent">traits</span> drive successful attacks</Title>
      </div>
      <div className="grid grid-cols-2 gap-[4%] flex-grow mt-[2%] items-center">
        <div className="rise">
          <div className="mono text-white/45 tracking-[0.1em] mb-[12px]" style={{ fontSize: 11.5 }}>ALLELE EXPLORER · TRAIT FREQUENCY AMONG WINNING ATTEMPTS</div>
          <Shot src="allele-explorer.png" alt="Allele Explorer: format=json 19%, persona=auditor 18%, noise_type=encoding_like 18% — bars past the overall-rate baseline raise success" className="w-full" />
        </div>
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
    <SlideShell page="Page 13">
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

export const Takeaways: React.FC = () => {
  const pillars: [string, string, string][] = [
    ["Structured & interpretable", "A 16-gene genome (~20-trillion search space) seeded from 121 real attacks — every win traceable gene-by-gene and across its lineage.", "🧬"],
    ["Honest methodology", "GA measured against random and seed-only baselines at equal budget, across a real easy→hard model gradient.", "⚖️"],
    ["Real, controllable system", "Postgres control plane, live dashboard, Dockerized, reproducible, offline-testable — not a one-shot script.", "⚙️"],
  ];
  return (
    <SlideShell page="Page 14">
      <div className="mt-[2%]">
        <Kicker num="14" sec="Takeaways" />
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
