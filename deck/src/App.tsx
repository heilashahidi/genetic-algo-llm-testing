import { Presentation } from "./components/Presentation";
import { Cover, Problem, GAPrimer, Evolution } from "./slides/intro";
import { GenoPheno, Schema, Seed, Target, Pipeline, ExecLoop, Fitness } from "./slides/method";
import { HonestTest, Interpret, Models, Arch, Dashboard, Rigor, Takeaways } from "./slides/results";

export default function App() {
  return (
    <Presentation>
      <Cover />
      <Problem />
      <GAPrimer />
      <Evolution />
      <GenoPheno />
      <Schema />
      <Seed />
      <Target />
      <Pipeline />
      <ExecLoop />
      <Fitness />
      <HonestTest />
      <Interpret />
      <Models />
      <Arch />
      <Dashboard />
      <Rigor />
      <Takeaways />
    </Presentation>
  );
}
