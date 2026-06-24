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

// House-style chart chrome shared by both panels.
const GRID = "#e7e8ea";
const AXIS = "#9a9da5";
const TICK = { fill: "#6b6e76", fontSize: 12 };
const AXIS_LABEL = { fill: "#9a9da5", fontSize: 11 };
const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid #e7e8ea",
  boxShadow: "0 2px 4px -1px rgb(16 17 26 / 0.06), 0 8px 24px -6px rgb(16 17 26 / 0.08)",
  fontSize: 12,
} as const;
const LEGEND_STYLE = { fontSize: 12 } as const;

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
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis
              dataKey="generation"
              type="number"
              allowDecimals={false}
              stroke={AXIS}
              tick={TICK}
              label={{ value: "generation", position: "insideBottom", offset: -4, ...AXIS_LABEL }}
            />
            <YAxis stroke={AXIS} tick={TICK} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Line
              type="monotone"
              dataKey="best_fitness"
              name="best"
              stroke="#3b6ef6"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="avg_fitness"
              name="avg"
              stroke="#8b5cf6"
              strokeWidth={2}
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
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis
              dataKey="generation"
              type="number"
              allowDecimals={false}
              stroke={AXIS}
              tick={TICK}
              label={{ value: "generation", position: "insideBottom", offset: -4, ...AXIS_LABEL }}
            />
            <YAxis domain={[0, 1]} stroke={AXIS} tick={TICK} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Line
              type="monotone"
              dataKey="success_rate"
              name="success rate"
              stroke="#30a46c"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
