import React, { useEffect, useState } from "react";

// Plain dotted text token (no pill background/border).
export const Chip: React.FC<{ children: React.ReactNode; tone?: "blue" | "warm" }> = ({ children, tone = "blue" }) => (
  <span
    className="mono inline-flex items-center gap-[7px]"
    style={{ fontSize: "clamp(10px,0.95vw,13px)", color: tone === "warm" ? "#b45309" : "rgba(15,23,42,0.72)" }}
  >
    <span style={{ color: tone === "warm" ? "rgba(180,83,9,0.55)" : "rgba(37,99,235,0.6)" }}>·</span>
    {children}
  </span>
);

export const Arrow: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children = "→", className = "" }) => (
  <span className={`text-accent mono font-bold ${className}`}>{children}</span>
);

/** animated horizontal bar that fills on mount */
export const BarRow: React.FC<{ label: string; value: string; pct: number; tone?: "blue" | "warm"; delay?: number }> = ({
  label, value, pct, tone = "blue", delay = 0,
}) => {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 150 + delay); return () => clearTimeout(t); }, [pct, delay]);
  return (
    <div className="mb-[3.2%]">
      <div className="flex justify-between mono mb-[5px]" style={{ fontSize: "clamp(11px,1.1vw,15px)" }}>
        <span className="text-slate-900/70">{label}</span>
        <span className={tone === "warm" ? "text-warm font-bold" : "text-accent font-bold"}>{value}</span>
      </div>
      <div className="h-[11px] rounded-full bg-slate-900/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${w}%`,
            transition: "width 1.1s cubic-bezier(0.2,0.8,0.2,1)",
            background: tone === "warm"
              ? "linear-gradient(90deg,#c75f17,#b45309)"
              : "linear-gradient(90deg,#1f4ba0,#2563eb)",
          }}
        />
      </div>
    </div>
  );
};

export function useCountUp(to: number, dur = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);
  return v;
}

/** crossover + mutation chromosome diagram */
export const Chromo: React.FC = () => {
  const A = "#2563eb", Al = "rgba(37,99,235,0.3)", Gl = "rgba(15,23,42,0.12)", G = "rgba(15,23,42,0.4)", O = "#b45309";
  const rows: [string, string[], boolean][] = [
    ["parent A", [A, A, A, A, Al, Al, Al, Al], false],
    ["parent B", [Gl, Gl, Gl, Gl, G, G, G, G], false],
    ["child", [A, A, A, A, G, O, G, G], true],
  ];
  const Row = ([label, cells, bold]: [string, string[], boolean]) => (
    <div key={label} className="flex items-center gap-[12px] my-[7px]">
      <div className="mono shrink-0" style={{ width: 58, fontSize: 12, fontWeight: bold ? 700 : 500, color: bold ? "#2563eb" : "rgba(15,23,42,0.6)" }}>{label}</div>
      <div className="flex gap-[6px]">
        {cells.map((c, i) => (
          <div key={i} style={{ width: 24, height: 24, borderRadius: 6, background: c, boxShadow: c === O ? "0 0 0 2px rgba(180,83,9,0.4)" : "none" }} />
        ))}
      </div>
    </div>
  );
  return (
    <div>
      <div className="mono text-slate-900/45 tracking-[0.08em] mb-[10px]" style={{ fontSize: 11.5 }}>CROSSOVER &amp; MUTATION ON A CHROMOSOME</div>
      {Row(rows[0])}
      {Row(rows[1])}
      <div className="mono text-slate-900/45 my-[8px] ml-[70px]" style={{ fontSize: 12 }}>↓ crossover at midpoint · then one mutation</div>
      {Row(rows[2])}
      <div className="mono flex gap-[18px] mt-[13px] ml-[70px] text-slate-900/60" style={{ fontSize: 11.5 }}>
        {[[A, "from A"], [G, "from B"], [O, "mutated"]].map(([c, t]) => (
          <span key={t} className="inline-flex items-center gap-[5px]">
            <span style={{ width: 11, height: 11, background: c, borderRadius: 3, display: "inline-block" }} />{t}
          </span>
        ))}
      </div>
    </div>
  );
};
