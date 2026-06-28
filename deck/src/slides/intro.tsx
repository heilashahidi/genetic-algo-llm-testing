import React from "react";
import { SlideShell, Kicker, Title, Glass } from "../components/SlideShell";
import { Chip, Arrow, Chromo } from "./ui";

export const Cover: React.FC = () => (
  <SlideShell bg="warp" page="">
    <div className="flex flex-col justify-center flex-grow">
      <div className="flex gap-[10px] mb-[3%] rise">
        <Chip tone="warm">RED-TEAM RESEARCH</Chip>
        <Chip>INTERPRETABLE BY DESIGN</Chip>
      </div>
      <h1 className="font-extrabold tracking-tight rise" style={{ fontSize: "clamp(34px,6.4vw,92px)", lineHeight: 1.02, animationDelay: "0.06s" }}>
        Evolving prompts<br />to <span className="text-accent">break an LLM</span>
      </h1>
      <p className="text-white/75 rise mt-[2%]" style={{ fontSize: "clamp(15px,1.7vw,26px)", animationDelay: "0.16s", maxWidth: "44ch" }}>
        A genetic-algorithm framework for <span className="text-white font-semibold">interpretable</span> LLM robustness testing.
      </p>
      <div className="flex gap-[12px] mt-[3%] flex-wrap rise" style={{ animationDelay: "0.26s" }}>
        {["local open-weight models", "a 121-attack seed library", "full lineage tracking"].map((t) => <Chip key={t}>{t}</Chip>)}
      </div>
    </div>
    <footer className="relative z-10 mono text-white/45 rise" style={{ fontSize: "clamp(11px,1.2vw,16px)", animationDelay: "0.36s" }}>
      Matthew Johnson · Heila Shahidi · James Hamil · Austin Wade
    </footer>
  </SlideShell>
);

export const Problem: React.FC = () => {
  const items: [string, string][] = [
    ["01", "Adversarial prompts can make a model ignore instructions, leak protected information, or produce content it's aligned to refuse."],
    ["02", "Today's testing is mostly manual, inconsistent, and hard to analyze at scale — people hand-write jailbreaks one at a time."],
    ["03", "When an attack works, raw prompt text gives little insight into which trait caused the failure."],
  ];
  return (
    <SlideShell bg="network" page="Page 01">
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
          Can we <span className="text-accent font-semibold">automatically search</span> for the prompt patterns that bypass safety alignment — and explain, <span className="text-warm font-semibold">gene by gene</span>, why they work?
        </p>
      </Glass>
    </SlideShell>
  );
};

export const GAPrimer: React.FC = () => {
  const steps: [string, string, string][] = [
    ["Population", "Start with many candidate solutions — here, attack strategies.", "🎲"],
    ["Score", "A fitness function rates each one: how well does it work?", "🎯"],
    ["Select", "Keep the fittest; the weak ones drop out.", "✅"],
    ["Breed + vary", "Combine two survivors (crossover) and add small random changes (mutation).", "🧬"],
    ["Repeat", "Over many generations the population keeps getting better.", "↻"],
  ];
  return (
    <SlideShell bg="dust" page="Page 02">
      <div className="mt-[2%]">
        <Kicker num="02" sec="Genetic Algorithms" />
        <Title className="mt-[1.4%]">A search method <span className="text-accent">borrowed from evolution</span></Title>
      </div>
      <Glass className="rise mt-[2.4%] p-[2.4%]" style={{ animationDelay: "0.05s" }}>
        <p className="text-white/90" style={{ fontSize: "clamp(13px,1.5vw,21px)", lineHeight: 1.5 }}>
          🧬 Think <span className="text-accent font-semibold">selective breeding</span>: keep the best, mix them, sprinkle in random change — then repeat. Do that to candidate <span className="text-warm font-semibold">answers</span> instead of animals, and you have a <span className="font-semibold">genetic algorithm</span>.
        </p>
      </Glass>
      <div className="flex items-stretch gap-[1.4%] mt-[3%]">
        {steps.map(([t, d, e], i) => (
          <React.Fragment key={t}>
            <Glass className="flex-1 rise p-[3.4%] text-center" style={{ animationDelay: `${0.12 + i * 0.1}s` }}>
              <div style={{ fontSize: "clamp(20px,2.4vw,34px)" }} className="mb-[8px]">{e}</div>
              <div className="mono text-white/45" style={{ fontSize: 11 }}>0{i + 1}</div>
              <h3 className="font-bold mt-[2px]" style={{ fontSize: "clamp(13px,1.4vw,20px)" }}>{t}</h3>
              <p className="text-white/70 mt-[4px] leading-snug" style={{ fontSize: "clamp(11px,1.05vw,15px)" }}>{d}</p>
            </Glass>
            {i < 4 && <Arrow className="self-center" >{i === 3 ? "↻" : "→"}</Arrow>}
          </React.Fragment>
        ))}
      </div>
      <p className="text-white/75 rise mt-[2.6%]" style={{ fontSize: "clamp(12px,1.3vw,18px)", animationDelay: "0.7s", lineHeight: 1.5 }}>
        <Arrow>→ </Arrow>Why it fits here: we can easily <span className="text-accent font-semibold">score</span> whether a prompt broke the model, but we can't <span className="text-warm font-semibold">calculate</span> the perfect jailbreak. GAs shine exactly there — a measurable goal, a huge search space, and no gradient to follow.
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
    ["selection", "keep the fitter genomes"],
    ["crossover", "blend two parents' genes"],
    ["mutation", "flip a gene to explore"],
    ["generation", "one full cycle, repeat 30×"],
    ["elitism", "carry the best forward intact"],
  ];
  return (
    <SlideShell bg="network" page="Page 03">
      <div className="mt-[2%]">
        <Kicker num="03" sec="Evolution as Search" />
        <Title className="mt-[1.4%]">Borrow natural selection — and keep every result <span className="text-accent">analyzable</span></Title>
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
