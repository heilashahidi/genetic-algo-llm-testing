import { Presentation } from "./components/Presentation";
import { Cover, WhatWeDo, Problem, GAPrimer, Evolution } from "./slides/intro";
import { TwoProblems, GenoPheno, Schema, Seed, Target, Pipeline, ExecLoop, Fitness } from "./slides/method";
import { ReviewTable, HonestTest, Interpret, Models, Verify, Takeaways } from "./slides/results";

export default function App() {
  return (
    <Presentation>
      <Cover />
      <WhatWeDo />
      <Problem />
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
      <ReviewTable />
      <HonestTest />
      <Interpret />
      <Models />
      <Verify />
      <Takeaways />
    </Presentation>
  );
}
