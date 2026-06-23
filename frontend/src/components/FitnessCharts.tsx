import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { GenerationRecord } from "../types";

export function FitnessCharts({ data }: { data: GenerationRecord[] }) {
  if (data.length === 0) {
    return <p className="muted">No generations recorded yet.</p>;
  }

  return (
    <div className="charts">
      <div className="chart-block">
        <h3>Fitness by generation</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="generation"
              type="number"
              allowDecimals={false}
              label={{ value: "generation", position: "insideBottom", offset: -4 }}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="best_fitness"
              name="best"
              stroke="#2563eb"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="avg_fitness"
              name="avg"
              stroke="#7c3aed"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-block">
        <h3>Success rate by generation</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="generation"
              type="number"
              allowDecimals={false}
              label={{ value: "generation", position: "insideBottom", offset: -4 }}
            />
            <YAxis domain={[0, 1]} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="success_rate"
              name="success rate"
              stroke="#16a34a"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
