import React from "react";
import { Logo } from "./Logo";

export const Kicker: React.FC<{ num: string; sec: string }> = ({ num, sec }) => (
  <div className="flex items-center gap-[10px] mono rise" style={{ fontSize: "clamp(10px,1vw,13px)" }}>
    <span className="px-[9px] py-[3px] rounded-md bg-accent text-[#06122e] font-bold tracking-wide">{num}</span>
    <span className="text-white/45 tracking-[0.22em] uppercase">{sec}</span>
  </div>
);

interface ShellProps {
  page?: string;
  children: React.ReactNode;
  className?: string;
  /** when true, no header chrome (used for the cover) */
  bare?: boolean;
}

// Transparent slide frame — the shared LivingBackground shows through from behind.
export const SlideShell: React.FC<ShellProps> = ({ page, children, className = "", bare }) => (
  <div className="relative w-full h-full text-white overflow-hidden flex flex-col px-[5.2%] py-[3.6%]">
    {!bare && (
      <header className="relative z-10 w-full flex justify-between items-center">
        <Logo />
        <span className="text-white/55 font-medium tracking-wide" style={{ fontSize: "clamp(11px,1.1vw,15px)" }}>
          Red-Team Research
        </span>
        <span className="mono text-white/40" style={{ fontSize: "clamp(10px,1vw,13px)" }}>{page ?? ""}</span>
      </header>
    )}
    <main className={`relative z-10 flex-grow min-h-0 flex flex-col ${className}`}>{children}</main>
  </div>
);

/** Headline used under the kicker on content slides */
export const Title: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <h2 className={`font-bold tracking-tight rise ${className}`} style={{ fontSize: "clamp(22px,3.1vw,46px)", lineHeight: 1.08, animationDelay: "0.05s" }}>
    {children}
  </h2>
);

/** frosted content card */
export const Glass: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = "", style }) => (
  <div className={`liquid-glass rounded-[16px] ${className}`} style={style}>{children}</div>
);
