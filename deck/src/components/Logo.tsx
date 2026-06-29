import React from "react";

export const Logo: React.FC = () => (
  <div className="flex items-center gap-[10px]">
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <rect width="26" height="26" rx="7" fill="rgba(15,23,42,0.06)" />
      {[0, 1, 2, 3].map((i) => {
        const y = 5 + i * 5.2;
        const a = i * 0.9;
        const x1 = 13 + 6 * Math.sin(a);
        const x2 = 13 - 6 * Math.sin(a);
        return (
          <g key={i}>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke="rgba(37,99,235,0.55)" strokeWidth="1.2" />
            <circle cx={x1} cy={y} r="1.8" fill={i % 2 ? "#b45309" : "#2563eb"} />
            <circle cx={x2} cy={y} r="1.8" fill="#7da2e8" />
          </g>
        );
      })}
    </svg>
    <span className="mono font-bold tracking-wide" style={{ fontSize: "13px" }}>
      GENOME<span className="text-accent">·</span>RT
    </span>
  </div>
);
