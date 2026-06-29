import React from "react";
import { SlideShell, Kicker, Title, Glass } from "../components/SlideShell";
import { Arrow } from "./ui";
import { MODELS, CLIMB, ORIGIN, STRATEGY, BASE_ASR } from "../runData";

const ClimbChart: React.FC = () => {
  const W = 460, H = 250, padL = 30, padR = 8, padT = 12, padB = 24;
  const pw = W - padL - padR, ph = H - padT - padB;
  const n = CLIMB[0].series.length;
  const x = (i: number) => padL + (pw * i) / (n - 1);
  const y = (v: number) => padT + ph * (1 - v / 100);
  const colorOf = (label: string, headline?: boolean) =>
    headline ? "#7fb0ff" : label.startsWith("mistral") ? "rgba(255,196,136,0.55)" : "rgba(255,255,255,0.28)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }}>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          <text x={padL - 6} y={y(g) + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" style={{ fontSize: 11, fontFamily: "monospace" }}>{g}</text>
        </g>
      ))}
      <text x={x(0)} y={H - 8} textAnchor="middle" fill="rgba(255,255,255,0.4)" style={{ fontSize: 11, fontFamily: "monospace" }}>seed</text>
      <text x={x(n - 1)} y={H - 8} textAnchor="middle" fill="rgba(255,255,255,0.4)" style={{ fontSize: 11, fontFamily: "monospace" }}>gen {n - 1}</text>
      {CLIMB.map((m) => {
        const c = colorOf(m.label, m.headline);
        const pts = m.series.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        return (
          <g key={m.label}>
            <polyline points={pts} fill="none" stroke={c} strokeWidth={m.headline ? 2.6 : 1.5} strokeLinejoin="round" strokeLinecap="round" />
            {m.headline && m.series.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.4} fill={c} />)}
            <text x={x(n - 1) + 6} y={y(m.series[n - 1]) + 4} fill={c} style={{ fontSize: 11, fontWeight: m.headline ? 700 : 400, fontFamily: "monospace" }}>{m.label.split(":")[0]}</text>
          </g>
        );
      })}
    </svg>
  );
};

export const HonestTest: React.FC = () => (
  <SlideShell page="Page 14">
    <div className="mt-[2%]">
      <Kicker num="14" sec="The Honest Test" />
      <Title className="mt-[1.4%]">Evolution beats the <span className="text-accent">seed it grew from</span>, on live models</Title>
    </div>
    <div className="grid gap-[2.6%] flex-grow mt-[2.4%] items-center" style={{ gridTemplateColumns: "1fr 1.25fr" }}>
      <div className="rise">
        <div className="mono text-white/45 tracking-[0.1em] mb-[12px]" style={{ fontSize: 13.8 }}>SUCCESS RATE BY GENOME ORIGIN</div>
        {ORIGIN.map((o, i) => (
          <div key={o.label} className="flex items-center gap-[12px] mb-[10px]">
            <span className="mono text-white/70" style={{ width: 116, fontSize: "clamp(12px,1.3vw,17px)" }}>{o.label}</span>
            <div className="flex-1 h-[14px] rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${o.asr}%`, background: o.label === "seed" ? "linear-gradient(90deg,#c75f17,#e09a5a)" : "linear-gradient(90deg,#3a6bd6,#7fb0ff)", transition: "width 1s", transitionDelay: `${i * 0.1}s` }} />
            </div>
            <span className="mono font-bold" style={{ width: 58, fontSize: "clamp(12px,1.3vw,17px)", color: o.label === "seed" ? "#ffc488" : "#7fb0ff" }}>{o.asr}%</span>
          </div>
        ))}
        <p className="text-white/55 mt-[3%]" style={{ fontSize: "clamp(12px,1.3vw,20.4px)" }}>Real seed attacks leak the secret <span className="text-warm font-semibold">45%</span> of the time; the elites the GA breeds reach <span className="text-accent font-semibold">99.5%</span>.</p>
      </div>
      <div className="rise" style={{ animationDelay: "0.15s" }}>
        <div className="mono text-white/45 tracking-[0.1em] mb-[8px]" style={{ fontSize: 13.8 }}>SUCCESS RATE PER GENERATION · 5 LIVE MODELS</div>
        <ClimbChart />
      </div>
    </div>
    <p className="text-white/70 rise mt-[1.6%]" style={{ fontSize: "clamp(13.2px,1.4vw,23.4px)", animationDelay: "0.3s" }}>
      <Arrow>→ </Arrow>8 GA runs · 2,500 genomes · live Ollama, no synthetic stand-in. On Llama-3.1 the GA climbed from a <span className="text-warm font-semibold">10%</span> seed population to a <span className="text-accent font-semibold">95%</span> peak generation. The genome is finding attacks the seed library never held.
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
    <SlideShell page="Page 15">
      <div className="mt-[2%]">
        <Kicker num="15" sec="Interpretability" />
        <Title className="mt-[1.4%]">Which <span className="text-accent">traits</span> drive successful attacks</Title>
      </div>
      <div className="grid grid-cols-2 gap-[4%] flex-grow mt-[2%] items-center">
        <div className="rise">
          <div className="mono text-white/45 tracking-[0.1em] mb-[12px]" style={{ fontSize: 13.8 }}>ALLELE EXPLORER · ATTACK SUCCESS BY STRATEGY GENE</div>
          {STRATEGY.map((s, i) => {
            const above = s.asr >= BASE_ASR;
            return (
              <div key={s.label} className="flex items-center gap-[10px] mb-[8px]">
                <span className="mono text-white/70 text-right shrink-0" style={{ width: 176, fontSize: "clamp(10px,1.05vw,14px)" }}>{s.label}</span>
                <div className="flex-1 relative h-[15px] rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.asr}%`, background: above ? "linear-gradient(90deg,#3a6bd6,#7fb0ff)" : "linear-gradient(90deg,#8a4a16,#c75f17)", transition: "width 1s", transitionDelay: `${i * 0.08}s` }} />
                  <div className="absolute top-0 bottom-0" style={{ left: `${BASE_ASR}%`, width: 1.5, background: "rgba(255,255,255,0.55)" }} />
                </div>
                <span className="mono font-bold" style={{ width: 40, fontSize: "clamp(11px,1.15vw,18px)", color: above ? "#7fb0ff" : "#ffc488" }}>{s.asr}%</span>
              </div>
            );
          })}
          <p className="text-white/50 mt-[3%]" style={{ fontSize: "clamp(11px,1.2vw,18px)" }}>White line = <span className="mono">{BASE_ASR}%</span> base rate across all 2,500 genomes. <span className="text-accent">hypothetical_framing</span> clears it; <span className="text-warm">multi_turn</span> and <span className="text-warm">payload_smuggling</span> drag below.</p>
        </div>
        <div className="rise" style={{ animationDelay: "0.15s" }}>
          <div className="mono text-white/45 tracking-[0.1em] mb-[12px]" style={{ fontSize: 13.8 }}>RESEARCH QUESTIONS</div>
          {qs.map((q, i) => (
            <Glass key={i} className="flex gap-[12px] mb-[10px] p-[2.3%] items-center">
              <div className="mono text-[#06122e] bg-accent inline-flex items-center justify-center font-bold rounded-[8px] shrink-0" style={{ width: 28, height: 28, fontSize: 15.6 }}>{i + 1}</div>
              <p style={{ fontSize: "clamp(14.4px,1.7vw,26.4px)" }}>{q}</p>
            </Glass>
          ))}
          <p className="text-white/60 mt-[2%]" style={{ fontSize: "clamp(13.2px,1.4vw,22px)" }}>
            <span className="text-accent font-semibold">Channel-aware crossover</span> keeps semantic & perturbation genes separable, so we can ask whether noise <i>actually</i> helps, or the strategy carries the win.
          </p>
        </div>
      </div>
    </SlideShell>
  );
};

export const Models: React.FC = () => (
  <SlideShell page="Page 16">
    <div className="mt-[2%]">
      <Kicker num="16" sec="Target Models" />
      <Title className="mt-[1.4%]">Five local models, one <span className="text-accent">measured</span> hard → soft gradient</Title>
    </div>
    <Glass className="rise p-[2.3%] mt-[2.5%]">
      <div className="grid items-center" style={{ gridTemplateColumns: "1.9fr 0.5fr 1.1fr 2.4fr", fontSize: "clamp(13.2px,1.4vw,22px)" }}>
        {["MODEL", "SIZE", "SUSCEPTIBILITY", "MEASURED ATTACK SUCCESS RATE"].map((h) => (
          <div key={h} className="mono text-white/40 pb-[10px] tracking-[0.06em]" style={{ fontSize: 13.2, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>{h}</div>
        ))}
        {MODELS.map((m, i) => (
          <React.Fragment key={m.label}>
            <div className="py-[13px] font-semibold mono" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", borderLeft: m.headline ? "3px solid #7fb0ff" : "3px solid transparent", paddingLeft: 12, fontSize: "clamp(13.2px,1.4vw,22px)" }}>
              {m.label}{m.headline && <span className="ml-[8px] text-accent" style={{ fontSize: 13.2 }}>· headline</span>}
            </div>
            <div className="py-[13px] mono" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{m.size}</div>
            <div className="py-[13px] text-white/65" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: "clamp(12px,1.3vw,20.4px)" }}>{m.band}</div>
            <div className="py-[13px] flex items-center gap-[12px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="mono text-warm font-bold" style={{ minWidth: 46 }}>{m.asr}%</span>
              <div className="flex-1 h-[9px] rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${m.asr}%`, background: "linear-gradient(90deg,#c75f17,#ffc488)", transition: "width 1s", transitionDelay: `${i * 0.1}s` }} />
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </Glass>
    <p className="text-white/70 rise mt-[2%]" style={{ fontSize: "clamp(13.2px,1.4vw,23.4px)", animationDelay: "0.3s" }}>
      <Arrow>→ </Arrow>Real GA runs against live Ollama: <span className="text-white font-semibold">every</span> model leaked the secret, from Gemma at <span className="text-warm font-semibold">53%</span> to Mistral at <span className="text-warm font-semibold">91%</span>. The ordering is the safety gradient; the numbers are ours, not borrowed benchmarks.
    </p>
  </SlideShell>
);

export const Verify: React.FC = () => {
  const stats: [string, string][] = [
    ["24", "primary sources"],
    ["105", "claims extracted"],
    ["25", "adversarially verified"],
    ["20 / 5", "confirmed / killed"],
  ];
  const held: string[] = [
    "Llama 3.3 ships 70B-only; 3.1-8B is the strongest small Llama",
    "vLLM runs 16–19× Ollama under concurrent batched load",
    "temp = 0 ≠ deterministic; batch size silently corrupts fitness",
    "All 5 target models are real Ollama SKUs at the sizes we cite",
  ];
  return (
    <SlideShell page="Page 17">
      <div className="mt-[2%]">
        <Kicker num="17" sec="Verification" />
        <Title className="mt-[1.4%]">Every claim <span className="text-accent">adversarially fact-checked</span> before it shipped</Title>
      </div>
      <p className="text-white/65 rise mt-[1.2%]" style={{ fontSize: "clamp(13.2px,1.4vw,22px)", lineHeight: 1.4, animationDelay: "0.08s" }}>
        Before this deck shipped, every factual claim behind it was traced to a source and challenged by independent skeptics across <span className="text-white font-semibold">6 search angles</span>. A claim survived only if <span className="text-accent font-semibold">≤1 of 3</span> skeptics could refute it. Below is the scoreboard.
      </p>
      <div className="grid grid-cols-4 gap-[2%] mt-[1.8%]">
        {stats.map(([n, l], i) => (
          <Glass key={l} className="rise p-[2.6%] text-center" style={{ animationDelay: `${i * 0.1}s`, borderBottom: "3px solid #7fb0ff" }}>
            <div className="font-bold text-accent" style={{ fontSize: "clamp(28px,3.6vw,52px)", lineHeight: 1 }}>{n}</div>
            <div className="mono text-white/55 mt-[8px] tracking-[0.04em]" style={{ fontSize: "clamp(11px,1.2vw,18px)" }}>{l}</div>
          </Glass>
        ))}
      </div>
      <div className="grid gap-[2.4%] flex-grow mt-[2%] items-stretch" style={{ gridTemplateColumns: "1.25fr 1fr" }}>
        <Glass className="rise p-[2.6%]" style={{ animationDelay: "0.2s", borderTop: "3px solid #2fb46a" }}>
          <div className="mono font-bold tracking-[0.1em] mb-[12px]" style={{ fontSize: 14.4, color: "#5fd99a" }}>✓ HELD · 3-0</div>
          {held.map((h) => (
            <p key={h} className="text-white/80 mb-[9px] flex gap-[10px]" style={{ fontSize: "clamp(13.2px,1.5vw,23.4px)" }}>
              <span style={{ color: "#5fd99a" }}>✓</span>{h}
            </p>
          ))}
        </Glass>
        <Glass className="rise p-[2.6%]" style={{ animationDelay: "0.3s", borderTop: "3px solid #e06b67" }}>
          <div className="mono font-bold tracking-[0.1em] mb-[12px]" style={{ fontSize: 14.4, color: "#f08a86" }}>✗ KILLED · 5</div>
          <p className="text-white/80" style={{ fontSize: "clamp(13.2px,1.5vw,23.4px)" }}>
            The precise <span className="text-warm font-semibold">HarmBench ASR figures</span> (26% / 90% …), unverifiable, predating every model we test and swinging <span className="text-warm font-semibold">~3×</span> across attack harnesses.
          </p>
          <p className="text-white/55 mt-[12px]" style={{ fontSize: "clamp(12px,1.3vw,20.4px)" }}>
            → That kill is exactly why the Target Models slide uses our <span className="text-accent">own measured</span> numbers, not borrowed benchmarks.
          </p>
        </Glass>
      </div>
    </SlideShell>
  );
};

export const Takeaways: React.FC = () => {
  const results: [string, string, React.ReactNode][] = [
    ["5 / 5", "Every model leaked", <>From <span className="text-warm font-semibold">53%</span> (Gemma) to <span className="text-warm font-semibold">91%</span> (Mistral) attack success on live Ollama: the whole hard→soft gradient broke.</>],
    ["45% → 99.5%", "Evolution beats its seed", <>Real seed attacks leak <span className="text-warm font-semibold">45%</span> of the time; the elites the GA breeds reach <span className="text-accent font-semibold">99.5%</span>. On Llama-3.1 a 10% seed climbed to a <span className="text-accent font-semibold">95%</span> peak.</>],
    ["83% vs 45%", "Traits are legible", <>Different strategies, very different odds: <span className="text-accent">hypothetical framing</span> beats the 76% average, while <span className="text-warm">multi-turn</span> falls well short. Every win points back to the genes behind it.</>],
  ];
  return (
    <SlideShell page="Page 18">
      <div className="mt-[2%]">
        <Kicker num="18" sec="Results" />
        <Title className="mt-[1.4%]">Every model broke, and the genome can <span className="text-accent">explain why</span></Title>
      </div>
      <div className="grid grid-cols-3 gap-[2.4%] mt-[2.6%]">
        {results.map(([n, t, d], i) => (
          <Glass key={t} className="rise p-[3.1%]" style={{ animationDelay: `${i * 0.12}s`, borderTop: "3px solid #7fb0ff" }}>
            <div className="font-bold text-accent" style={{ fontSize: "clamp(24px,2.9vw,42px)", lineHeight: 1 }}>{n}</div>
            <h3 className="font-bold mt-[10px]" style={{ fontSize: "clamp(15.6px,1.8vw,27.6px)" }}>{t}</h3>
            <p className="text-white/70 mt-[6px] leading-snug" style={{ fontSize: "clamp(13.2px,1.4vw,22px)" }}>{d}</p>
          </Glass>
        ))}
      </div>
      <Glass className="rise mt-[2.4%] p-[2.3%] text-center" style={{ animationDelay: "0.4s", background: "linear-gradient(100deg, rgba(19,32,58,0.6), rgba(33,64,127,0.5))" }}>
        <p style={{ fontSize: "clamp(17px,2.2vw,31.2px)", lineHeight: 1.45 }}>
          A <span className="text-accent font-semibold">safe, interpretable microscope</span> for adversarial prompting: it measures <span className="text-warm font-semibold">which</span> traits cause failures, not just <span className="text-warm font-semibold">that</span> they do. <span className="text-white font-semibold">Now, let's watch it run live.</span>
        </p>
      </Glass>
    </SlideShell>
  );
};
