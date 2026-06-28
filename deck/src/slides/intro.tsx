import React from "react";
import { Dices, Target, Filter, Shuffle, RefreshCw } from "lucide-react";
import { SlideShell, Kicker, Title, Glass } from "../components/SlideShell";
import { Arrow, Chromo } from "./ui";

export const Cover: React.FC = () => (
  <SlideShell page="">
    <div className="flex flex-col justify-center flex-grow">
      <h1 className="font-extrabold tracking-tight rise" style={{ fontSize: "clamp(32px,5.6vw,78px)", lineHeight: 1.04, animationDelay: "0.06s" }}>
        Evolving<br /><span className="text-accent">Adversarial Prompts</span>
      </h1>
      <p className="text-white/75 rise mt-[2.4%]" style={{ fontSize: "clamp(15px,1.7vw,26px)", animationDelay: "0.16s", maxWidth: "48ch" }}>
        A <span className="text-white font-semibold">Genetic-Algorithm Framework</span> for LLM Robustness Testing
      </p>
      <div className="rise mt-[3.6%]" style={{ animationDelay: "0.26s" }}>
        <div className="h-px w-[44px] bg-white/25 mb-[14px]" />
        <div className="text-white/85 font-medium" style={{ fontSize: "clamp(13px,1.5vw,21px)" }}>
          Matthew Johnson · Heila Shahidi · James Hamil · Austin Wade
        </div>
      </div>
    </div>
  </SlideShell>
);

export const Problem: React.FC = () => {
  const items: [string, string][] = [
    ["01", "Deployed LLMs gate real money, data, and safety decisions — yet one crafted prompt can make a model ignore its instructions, leak protected information, or produce content it's aligned to refuse."],
    ["02", "Today's testing is mostly manual, inconsistent, and hard to analyze at scale — people hand-write adversarial prompts one at a time."],
    ["03", "When an attack works, the raw prompt text gives little insight into which trait actually caused the failure."],
  ];
  return (
    <SlideShell page="Page 01">
      <div className="mt-[2%]">
        <Kicker num="01" sec="The Problem" />
        <Title className="mt-[1.4%]">Robustness testing tells us a prompt <span className="text-warm">worked</span>, not <span className="text-accent">why</span></Title>
      </div>
      <div className="grid grid-cols-3 gap-[2.2%] mt-[3.5%]">
        {items.map(([n, t], i) => (
          <Glass key={n} className="rise p-[5%]" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="mono text-[#06122e] bg-accent inline-flex items-center justify-center font-bold rounded-[8px] mb-[12px]" style={{ width: 30, height: 30, fontSize: 14 }}>{n}</div>
            <p className="text-white/85 leading-snug" style={{ fontSize: "clamp(12px,1.25vw,18px)" }}>{t}</p>
          </Glass>
        ))}
      </div>
      <Glass className="rise mt-[2.4%] p-[2.6%]" style={{ animationDelay: "0.34s" }}>
        <div className="mono text-accent tracking-[0.18em] mb-[6px]" style={{ fontSize: 12 }}>THE QUESTION</div>
        <p className="text-white/90" style={{ fontSize: "clamp(14px,1.55vw,22px)", lineHeight: 1.45 }}>
          Can we <span className="text-accent font-semibold">automatically search</span> for the prompt patterns that bypass safety alignment — and explain <span className="text-warm font-semibold">why</span> they work?
        </p>
      </Glass>
    </SlideShell>
  );
};

const EvolveGraphic: React.FC = () => {
  const gens = [
    [70, 82, 90, 98, 105],
    [55, 68, 78, 88, 96],
    [38, 50, 62, 72, 82],
    [20, 30, 42, 54, 66],
  ];
  const xs = [34, 108, 182, 256];
  const col = (y: number) => {
    const f = (110 - y) / 90;
    return f > 0.6 ? "#7fb0ff" : f > 0.4 ? "rgba(127,176,255,0.55)" : "rgba(255,255,255,0.3)";
  };
  return (
    <svg viewBox="0 0 300 132" style={{ width: "clamp(170px,17vw,290px)", flex: "none" }} aria-label="population fitness rising over generations">
      <path d={`M${xs[0]},${gens[0][0]} L${xs[1]},${gens[1][0]} L${xs[2]},${gens[2][0]} L${xs[3]},${gens[3][0]}`} stroke="#7fb0ff" strokeWidth="1.5" strokeDasharray="3 3" fill="none" opacity="0.7" />
      {gens.map((ys, g) => ys.map((y, i) => (
        <circle key={`${g}-${i}`} cx={xs[g]} cy={y} r={g === 3 && i === 0 ? 5 : 4} fill={col(y)} stroke={g === 3 && i === 0 ? "#fff" : "none"} strokeWidth="1" />
      )))}
      <text x="34" y="126" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" className="mono">gen 0</text>
      <text x="256" y="126" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" className="mono">later</text>
    </svg>
  );
};

export const GAPrimer: React.FC = () => {
  const steps = [
    { t: "Population", d: "Start with many candidate solutions — here, attack strategies.", Icon: Dices },
    { t: "Score", d: "A fitness function rates each one: how well does it work?", Icon: Target },
    { t: "Select", d: "Keep the fittest; the weak ones drop out.", Icon: Filter },
    { t: "Breed + vary", d: "Combine two survivors (crossover) and add small random changes (mutation).", Icon: Shuffle },
    { t: "Repeat", d: "Over many generations the population keeps getting better.", Icon: RefreshCw },
  ];
  return (
    <SlideShell page="Page 02">
      <div className="mt-[2%]">
        <Kicker num="02" sec="Genetic Algorithms" />
        <Title className="mt-[1.4%]">How a genetic algorithm <span className="text-accent">works</span></Title>
      </div>
      <Glass className="rise mt-[1.6%] p-[2%] flex items-center gap-[4%]" style={{ animationDelay: "0.05s" }}>
        <p className="text-white/90 flex-1" style={{ fontSize: "clamp(12px,1.4vw,20px)", lineHeight: 1.45 }}>
          Think <span className="text-accent font-semibold">natural selection</span>: keep the fittest, recombine them, add a little random variation — then repeat. Do that to candidate <span className="text-warm font-semibold">answers</span> instead of organisms, and you have a <span className="font-semibold">genetic algorithm</span>.
        </p>
        <EvolveGraphic />
      </Glass>
      <div className="flex items-stretch gap-[1.4%] mt-[1.8%]">
        {steps.map((s, i) => (
          <React.Fragment key={s.t}>
            <Glass className="flex-1 rise p-[2.4%] text-center" style={{ animationDelay: `${0.12 + i * 0.1}s` }}>
              <s.Icon strokeWidth={1.5} className="mx-auto mb-[7px] text-accent" style={{ width: "clamp(20px,2.2vw,28px)", height: "clamp(20px,2.2vw,28px)" }} />
              <div className="mono text-white/45" style={{ fontSize: 11 }}>0{i + 1}</div>
              <h3 className="font-bold mt-[2px]" style={{ fontSize: "clamp(12px,1.3vw,19px)" }}>{s.t}</h3>
              <p className="text-white/70 mt-[3px] leading-snug" style={{ fontSize: "clamp(10px,1vw,14px)" }}>{s.d}</p>
            </Glass>
            {i < 4 && <Arrow className="self-center">{i === 3 ? "↻" : "→"}</Arrow>}
          </React.Fragment>
        ))}
      </div>
      <p className="text-white/75 rise mt-[1.1%]" style={{ fontSize: "clamp(11px,1.2vw,16px)", animationDelay: "0.7s", lineHeight: 1.45 }}>
        <Arrow>→ </Arrow>Why it fits here: we can easily <span className="text-accent font-semibold">score</span> whether a prompt broke the model, but we can't <span className="text-warm font-semibold">calculate</span> the perfect attack. GAs shine exactly there — a measurable goal, a huge search space, and no gradient to follow.
      </p>
    </SlideShell>
  );
};

export const Evolution: React.FC = () => {
  const terms: [string, string][] = [
    ["gene", "one decision knob — e.g. persona"],
    ["allele", "a value it takes — persona = DAN"],
    ["genome", "all 16 genes = one attack"],
    ["population", "100 genomes per generation"],
    ["fitness", "how well it breaks the model"],
    ["generation", "one full cycle, repeat 30×"],
    ["elitism", "carry the best forward intact"],
  ];
  return (
    <SlideShell page="Page 03">
      <div className="mt-[2%]">
        <Kicker num="03" sec="Evolution as Search" />
        <Title className="mt-[1.4%]">How evolution maps onto our <span className="text-accent">attack genome</span></Title>
      </div>
      <p className="text-white/80 rise mt-[1.6%]" style={{ fontSize: "clamp(12px,1.35vw,19px)", lineHeight: 1.5, animationDelay: "0.04s" }}>
        Keep a <span className="font-semibold">population</span> of candidate strategies, score each with a <span className="text-accent font-semibold">fitness</span> function, then <span className="font-semibold">select</span>, <span className="font-semibold">recombine</span>, and <span className="font-semibold">mutate</span> so better solutions survive. The twist: we <span className="text-warm font-semibold">evolve structure, not text</span> — so every win has an ancestry you can trace gene by gene.
      </p>
      <div className="grid grid-cols-2 gap-[3%] items-center flex-grow mt-[1.5%]">
        <Glass className="rise p-[4%]" style={{ animationDelay: "0.1s" }}>
          <div className="mono text-white/45 tracking-[0.1em] mb-[12px]" style={{ fontSize: 11 }}>THE VOCABULARY · MAPPED TO THIS SYSTEM</div>
          <div className="grid grid-cols-2 gap-x-[22px] gap-y-[11px]">
            {terms.map(([k, v]) => (
              <div key={k}>
                <div className="mono font-bold text-accent" style={{ fontSize: "clamp(12px,1.2vw,15px)" }}>{k}</div>
                <div className="text-white/65 leading-tight" style={{ fontSize: "clamp(10px,1.05vw,14px)" }}>{v}</div>
              </div>
            ))}
          </div>
        </Glass>
        <Glass className="rise p-[4%]" style={{ animationDelay: "0.2s" }}><Chromo /></Glass>
      </div>
    </SlideShell>
  );
};
