import { useCountUp } from "../useCountUp";

/**
 * A HUD stat tile with a count-up value, shared across the gamified views.
 * Pass `format` for non-integer values (e.g. fixed-point fitness).
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
    <div className="lb-kpi">
      <span className="lb-kpi__num">
        {format ? format(shown) : Math.round(shown).toLocaleString()}
      </span>
      <span className="lb-kpi__label">{label}</span>
    </div>
  );
}
