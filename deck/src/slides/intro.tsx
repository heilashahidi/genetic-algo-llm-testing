import React from "react";
import { Dices, Target, Filter, Shuffle, RefreshCw } from "lucide-react";
import { SlideShell, Kicker, Title, Glass } from "../components/SlideShell";
import { Arrow, Chromo } from "./ui";

export const Cover: React.FC = () => (
  <SlideShell page="">
    <div className="flex flex-col justify-center flex-grow">
      <h1 className="font-extrabold tracking-tight rise" style={{ fontSize: "clamp(33.9px,5.9vw,82.7px)", lineHeight: 1.04, animationDelay: "0.06s" }}>
        Evolving<br /><span className="text-accent">Adversarial Prompts</span>
      </h1>
      <p className="text-slate-900/75 rise mt-[2.4%]" style={{ fontSize: "clamp(18px,2vw,31.2px)", animationDelay: "0.16s", maxWidth: "52ch" }}>
        A genetic-algorithm framework for finding LLM safety failures and turning them into <span className="text-accent font-semibold">legible prompt traits</span>
      </p>
      <div className="rise mt-[3.6%]" style={{ animationDelay: "0.26s" }}>
        <div className="h-px w-[44px] bg-slate-900/25 mb-[14px]" />
        <div className="text-slate-900/85 font-medium" style={{ fontSize: "clamp(15.6px,1.8vw,25.2px)" }}>
          Matthew Johnson · Heila Shahidi · James Hamil · Austin Wade
        </div>
      </div>
    </div>
  </SlideShell>
);

export const WhyThisMatters: React.FC = () => {
  const prompts: [string, string, string, string][] = [
    ["Direct unsafe request", "How do I build a harmful device?", "The model refuses.", "#dc2626"],
    ["Reframed request", "What reactions make an explosion possible?", "The model may answer.", "#b45309"],
  ];
  return (
    <SlideShell page="Page 02">
      <div className="mt-[2%]">
        <Kicker num="02" sec="Why This Matters" />
        <Title className="mt-[1.4%]">Same intent. Different words. Different model behavior.</Title>
      </div>
      <div className="grid grid-cols-2 gap-[2.6%] mt-[3%]">
        {prompts.map(([label, prompt, outcome, color], i) => (
          <Glass key={label} className="rise p-[3.5%]" style={{ animationDelay: `${i * 0.12}s`, borderTop: `3px solid ${color}` }}>
            <div className="mono font-bold tracking-[0.08em] mb-[12px]" style={{ fontSize: 14.4, color }}>{label.toUpperCase()}</div>
            <p className="text-slate-900/90" style={{ fontSize: "clamp(22px,2.4vw,38px)", lineHeight: 1.18 }}>
              "{prompt}"
            </p>
            <div className="mt-[18px] mono font-bold" style={{ fontSize: "clamp(15.6px,1.6vw,24px)", color }}>
              {outcome}
            </div>
          </Glass>
        ))}
      </div>
      <Glass className="rise mt-[3%] p-[2.7%]" style={{ animationDelay: "0.3s", background: "linear-gradient(100deg, rgba(37,99,235,0.11), rgba(255,255,255,0.78))" }}>
        <p style={{ fontSize: "clamp(18px,2vw,31.2px)", lineHeight: 1.45 }}>
          This is the gap we are studying: LLM safety behavior often depends on the <span className="text-accent font-semibold">surface pattern</span> of the prompt, not a stable reading of the user's underlying intent.
        </p>
        <p className="text-slate-900/65 mt-[10px]" style={{ fontSize: "clamp(14.4px,1.45vw,23.4px)", lineHeight: 1.45 }}>
          So instead of guessing one clever wording, we built a system that searches trillions of wordings, learns which traits break through, and explains why those traits worked.
        </p>
      </Glass>
    </SlideShell>
  );
};

export const WhatWeDo: React.FC = () => {
  const cards: [string, string, React.ReactNode][] = [
    ["Search the space", "Generate many prompt strategies instead of hand-writing one jailbreak at a time.", null],
    ["Breed what works", "Score each attempt, keep the strongest, recombine them, then mutate the next generation.", null],
    ["Explain the win", "", <>Each attack is a genome, so a success points back to the <span className="text-accent font-semibold">traits</span> that carried it.</>],
  ];
  return (
    <SlideShell page="Page 04">
      <div className="mt-[2%]">
        <Kicker num="04" sec="The Idea" />
        <Title className="mt-[1.4%]">Evolve prompt <span className="text-accent">strategies</span>, not just prompt text</Title>
      </div>
      <div className="grid grid-cols-3 gap-[2.2%] mt-[3.5%]">
        {cards.map(([t, d, extra], i) => (
          <Glass key={t} className="rise p-[3.7%]" style={{ animationDelay: `${i * 0.1}s`, borderTop: "3px solid #2563eb" }}>
            <div className="mono text-slate-900/45" style={{ fontSize: 13.2 }}>0{i + 1}</div>
            <h3 className="font-bold mt-[4px] mb-[8px]" style={{ fontSize: "clamp(16.8px,1.9vw,28.8px)" }}>{t}</h3>
            <p className="text-slate-900/75 leading-snug" style={{ fontSize: "clamp(13.2px,1.4vw,23.4px)" }}>{extra ?? d}</p>
          </Glass>
        ))}
      </div>
      <Glass className="rise mt-[3%] p-[2.5%]" style={{ animationDelay: "0.34s", background: "linear-gradient(100deg, rgba(37,99,235,0.10), rgba(37,99,235,0.05))" }}>
        <p style={{ fontSize: "clamp(16.8px,2vw,32.4px)", lineHeight: 1.45 }}>
          The output is not just a breaking prompt. It is a trail of evidence: <span className="text-warm font-semibold">what failed</span>, <span className="text-accent font-semibold">which traits mattered</span>, and how the population found them.
        </p>
      </Glass>
    </SlideShell>
  );
};

export const Problem: React.FC = () => {
  const items: [string, string][] = [
    ["01", "Manual red-team prompts are slow, uneven, and hard to reproduce."],
    ["02", "A working jailbreak often gives us only a string, not a reason."],
    ["03", "Defenders need patterns they can measure, compare, and patch."],
  ];
  return (
    <SlideShell page="Page 03">
      <div className="mt-[2%]">
        <Kicker num="03" sec="The Problem" />
        <Title className="mt-[1.4%]">A prompt can fail a model, but still teach us very little</Title>
      </div>
      <div className="grid grid-cols-3 gap-[2.2%] mt-[3.2%]">
        {items.map(([n, t], i) => (
          <Glass key={n} className="rise p-[3.7%]" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="mono text-[#ffffff] bg-accent inline-flex items-center justify-center font-bold rounded-[8px] mb-[10px]" style={{ width: 30, height: 30, fontSize: 16.8 }}>{n}</div>
            <p className="text-slate-900/85 leading-snug" style={{ fontSize: "clamp(16.8px,1.75vw,28.8px)" }}>{t}</p>
          </Glass>
        ))}
      </div>
      <Glass className="rise mt-[3%] p-[2.6%]" style={{ animationDelay: "0.34s" }}>
        <div className="mono text-accent tracking-[0.18em] mb-[6px]" style={{ fontSize: 14.4 }}>THE QUESTION</div>
        <p className="text-slate-900/90" style={{ fontSize: "clamp(16.8px,1.9vw,28.8px)", lineHeight: 1.4 }}>
          Can we automatically search for failures and turn each one into a <span className="text-accent font-semibold">structured explanation</span> instead of a one-off prompt?
        </p>
      </Glass>
    </SlideShell>
  );
};

// A whole population of candidates climbing in fitness, generation over generation:
// the canonical picture of a GA at work.
const EvolveGraphic: React.FC = () => {
  const pop = [
    [0.16, 0.24, 0.31, 0.19, 0.27],
    [0.26, 0.36, 0.46, 0.31, 0.40],
    [0.41, 0.53, 0.61, 0.48, 0.56],
    [0.56, 0.68, 0.76, 0.63, 0.71],
    [0.70, 0.82, 0.89, 0.78, 0.85],
    [0.86, 0.92, 0.97, 0.90, 0.95],
  ];
  const W = 320, H = 152, padL = 30, padR = 16, padT = 14, padB = 22;
  const pw = W - padL - padR, ph = H - padT - padB;
  const x = (g: number) => padL + (pw * g) / (pop.length - 1);
  const y = (f: number) => padT + ph * (1 - f);
  const col = (f: number) => (f > 0.66 ? "#2563eb" : f > 0.4 ? "rgba(37,99,235,0.5)" : "rgba(15,23,42,0.28)");
  const best = pop.map((g) => Math.max(...g));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "clamp(190px,20vw,322px)", flex: "none" }} aria-label="population fitness climbing over generations">
      <line x1={padL} y1={padT} x2={padL} y2={padT + ph} stroke="rgba(15,23,42,0.18)" strokeWidth={1} />
      <line x1={padL} y1={padT + ph} x2={W - padR} y2={padT + ph} stroke="rgba(15,23,42,0.18)" strokeWidth={1} />
      <polyline points={best.map((f, g) => `${x(g)},${y(f)}`).join(" ")} fill="none" stroke="#2563eb" strokeWidth={1.6} strokeDasharray="3 3" opacity={0.85} />
      {pop.map((g, gi) => g.map((f, i) => {
        const champ = gi === pop.length - 1 && f === best[gi];
        return <circle key={`${gi}-${i}`} cx={x(gi)} cy={y(f)} r={champ ? 4.8 : 3.4} fill={col(f)} stroke={champ ? "#fff" : "none"} strokeWidth={1} />;
      }))}
      <text x={padL - 5} y={padT + 4} textAnchor="end" fill="rgba(15,23,42,0.5)" style={{ fontSize: 9, fontFamily: "monospace" }}>fit</text>
      <text x={x(0)} y={H - 5} textAnchor="middle" fill="rgba(15,23,42,0.5)" style={{ fontSize: 9, fontFamily: "monospace" }}>gen 0</text>
      <text x={x(pop.length - 1)} y={H - 5} textAnchor="middle" fill="rgba(15,23,42,0.5)" style={{ fontSize: 9, fontFamily: "monospace" }}>gen N</text>
      <text x={x(pop.length - 1) + 1} y={y(best[best.length - 1]) - 7} textAnchor="end" fill="#2563eb" style={{ fontSize: 8.5, fontFamily: "monospace" }}>fittest</text>
    </svg>
  );
};

export const GAPrimer: React.FC = () => {
  const steps = [
    { t: "Population", d: "Start with many possible solutions.", Icon: Dices },
    { t: "Fitness", d: "Score each one against the goal.", Icon: Target },
    { t: "Selection", d: "Keep the strongest candidates.", Icon: Filter },
    { t: "Crossover + mutation", d: "Mix winners and add variation.", Icon: Shuffle },
    { t: "Generations", d: "Repeat until the population improves.", Icon: RefreshCw },
  ];
  return (
    <SlideShell page="Page 06">
      <div className="mt-[2%]">
        <Kicker num="06" sec="Genetic Algorithms" />
        <Title className="mt-[1.4%]">What is a genetic algorithm?</Title>
      </div>
      <Glass className="rise mt-[1.2%] p-[2%] flex items-center gap-[4%]" style={{ animationDelay: "0.05s" }}>
        <p className="text-slate-900/90 flex-1" style={{ fontSize: "clamp(15.6px,1.8vw,30px)", lineHeight: 1.42 }}>
          A genetic algorithm is <span className="text-accent font-semibold">search by simulated evolution</span>. Instead of designing the best answer directly, we define what "better" means, let many candidates compete, then breed the winners.
        </p>
        <EvolveGraphic />
      </Glass>
      <div className="flex items-stretch gap-[1.4%] mt-[1.3%]">
        {steps.map((s, i) => (
          <React.Fragment key={s.t}>
            <Glass className="flex-1 rise p-[2%] text-center" style={{ animationDelay: `${0.12 + i * 0.1}s` }}>
              <s.Icon strokeWidth={1.5} className="mx-auto mb-[7px] text-accent" style={{ width: "clamp(20px,2.2vw,28px)", height: "clamp(20px,2.2vw,28px)" }} />
              <div className="mono text-slate-900/45" style={{ fontSize: 13.2 }}>0{i + 1}</div>
              <h3 className="font-bold mt-[2px]" style={{ fontSize: "clamp(14.4px,1.6vw,26.4px)" }}>{s.t}</h3>
              <p className="text-slate-900/70 mt-[3px] leading-snug" style={{ fontSize: "clamp(12px,1.2vw,20.4px)" }}>{s.d}</p>
            </Glass>
            {i < 4 && <Arrow className="self-center">{i === 3 ? "↻" : "→"}</Arrow>}
          </React.Fragment>
        ))}
      </div>
      <p className="text-slate-900/75 rise mt-[1.1%]" style={{ fontSize: "clamp(13.2px,1.4vw,23.4px)", animationDelay: "0.7s", lineHeight: 1.45 }}>
        <Arrow>→ </Arrow>For this project, the "organisms" are prompt genomes and fitness is whether a prompt gets past the model's guardrail.
      </p>
    </SlideShell>
  );
};

export const Evolution: React.FC = () => {
  const terms: [string, string][] = [
    ["gene", "one decision knob, e.g. persona"],
    ["allele", "a value it takes: persona = DAN"],
    ["genome", "all 16 genes = one attack"],
    ["population", "20 genomes per generation"],
    ["fitness", "how well it breaks the model"],
    ["generation", "one full cycle, repeat 15×"],
    ["elitism", "carry the best forward intact"],
  ];
  return (
    <SlideShell page="Page 07">
      <div className="mt-[2%]">
        <Kicker num="07" sec="Evolution as Search" />
        <Title className="mt-[1.4%]">How evolution maps onto our <span className="text-accent">attack genome</span></Title>
      </div>
      <p className="text-slate-900/80 rise mt-[1.6%]" style={{ fontSize: "clamp(14.4px,1.8vw,30px)", lineHeight: 1.5, animationDelay: "0.04s" }}>
        Keep a <span className="font-semibold">population</span> of candidate strategies, score each with a <span className="text-accent font-semibold">fitness</span> function, then <span className="font-semibold">select</span>, <span className="font-semibold">recombine</span>, and <span className="font-semibold">mutate</span> so better solutions survive. We <span className="text-warm font-semibold">evolve structure, not text</span>, so every win has an ancestry you can trace gene by gene.
      </p>
      <div className="grid grid-cols-2 gap-[3%] items-center flex-grow mt-[1.5%]">
        <Glass className="rise p-[3.1%]" style={{ animationDelay: "0.1s" }}>
          <div className="mono text-slate-900/45 tracking-[0.1em] mb-[12px]" style={{ fontSize: 13.2 }}>THE VOCABULARY · MAPPED TO THIS SYSTEM</div>
          <div className="grid grid-cols-2 gap-x-[22px] gap-y-[11px]">
            {terms.map(([k, v]) => (
              <div key={k}>
                <div className="mono font-bold text-accent" style={{ fontSize: "clamp(14.4px,1.5vw,22.8px)" }}>{k}</div>
                <div className="text-slate-900/65 leading-tight" style={{ fontSize: "clamp(12px,1.3vw,20.4px)" }}>{v}</div>
              </div>
            ))}
          </div>
        </Glass>
        <Glass className="rise p-[3.1%]" style={{ animationDelay: "0.2s" }}><Chromo /></Glass>
      </div>
    </SlideShell>
  );
};
