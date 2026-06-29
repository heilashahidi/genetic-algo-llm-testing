import { Presentation } from "./components/Presentation";
import { Cover, WhatWeDo, Problem, GAPrimer, Evolution } from "./slides/intro";
import { TwoProblems, GenoPheno, Schema, Seed, Target, Pipeline, ExecLoop, Fitness } from "./slides/method";
import { HonestTest, Interpret, Models, Verify, Takeaways } from "./slides/results";

export default function App() {
  return (
    <Presentation>
      <Cover />
      <Problem />
      <WhatWeDo />
      <Pipeline />
      <Target />
      <GAPrimer />
      <Evolution />
      <TwoProblems />
      <GenoPheno />
      <Schema />
      <Seed />
      <Fitness />
      <ExecLoop />
      <HonestTest />
      <Interpret />
      <Models />
      <Verify />
      <Takeaways />
    </Presentation>
  );
}
