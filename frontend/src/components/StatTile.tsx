import { useCountUp } from "../useCountUp";

/**
 * A flat hairline KPI tile with a count-up value, shared across the detail
 * panels. Pass `format` for non-integer values (e.g. fixed-point fitness).
 */
export function StatTile({
  value,
  label,
  format,
}: {
  value: number;
  label: string;
  format?: (v: number) => string;
}) {
  const shown = useCountUp(value);
  return (
    <div className="kpi">
      <span className="kpi__num">
        {format ? format(shown) : Math.round(shown).toLocaleString()}
      </span>
      <span className="kpi__label">{label}</span>
    </div>
  );
}
