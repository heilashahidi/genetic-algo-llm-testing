import { Presentation } from "./components/Presentation";
import { Cover, GAPrimer, Problem, WhatWeDo, WhyThisMatters } from "./slides/intro";
import { AllelePatterns, ExecLoop, Fitness, GenoPheno, LiveDemo, Schema, Seed, Target, TwoProblems } from "./slides/method";
import { HonestTest, Interpret, Models, Takeaways } from "./slides/results";

export default function App() {
  return (
    <Presentation>
      <Cover />
      <WhyThisMatters />
      <Problem />
      <WhatWeDo />
      <Target />
      <GAPrimer />
      <TwoProblems />
      <GenoPheno />
      <Schema />
      <Seed />
      <Fitness />
      <ExecLoop />
      <AllelePatterns />
      <LiveDemo />
      <HonestTest />
      <Models />
      <Interpret />
      <Takeaways />
    </Presentation>
  );
}
