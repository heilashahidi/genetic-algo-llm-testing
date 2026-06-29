import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";
import { LivingBackground } from "./LivingBackground";

interface PresentationProps {
  children: React.ReactNode[];
}

export const Presentation: React.FC<PresentationProps> = ({ children }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = children.length;
  const next = () => setCurrentSlide((p) => Math.min(p + 1, total - 1));
  const prev = () => setCurrentSlide((p) => Math.max(p - 1, 0));

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prev(); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFullscreen(); }
      else if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  const onMouseMove = () => {
    setControlsVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setControlsVisible(false), 3000);
  };
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      className="relative w-screen h-screen overflow-hidden bg-[#eef1f7]"
    >
      <LivingBackground />
      <div className="w-full h-full relative z-10">
        {children.map((slide, index) => {
          const active = index === currentSlide;
          // every slide stays mounted (content is cheap now that the background is shared),
          // so transitions are a clean directional fade with no content blink or re-animation.
          const offset = active ? 0 : index < currentSlide ? -20 : 20;
          return (
            <div
              key={index}
              style={{
                opacity: active ? 1 : 0,
                transform: `translateY(${offset}px)`,
                transition: "opacity 360ms ease, transform 540ms cubic-bezier(0.22,0.61,0.36,1)",
                willChange: "opacity, transform",
              }}
              className={`absolute inset-0 w-full h-full ${active ? "pointer-events-auto z-10" : "pointer-events-none z-0"}`}
            >
              {slide}
            </div>
          );
        })}
      </div>

      <div
        style={{ transition: "opacity 300ms ease-in-out" }}
        className={`absolute inset-x-0 bottom-0 pointer-events-none z-50 flex flex-col justify-end px-[2.4%] pb-[16px] ${controlsVisible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="w-full flex items-center justify-between pointer-events-auto px-[2.2%] py-[0.9%] rounded-full bg-white/75 backdrop-blur-md border border-slate-900/10 shadow-[0_6px_24px_rgba(15,23,42,0.10)] max-w-[95vw] mx-auto">
          <div className="text-slate-900/55 mono" style={{ fontSize: "12px", fontVariantNumeric: "tabular-nums" }}>
            {String(currentSlide + 1).padStart(2, "0")} <span className="text-slate-900/25">/</span> {String(total).padStart(2, "0")}
          </div>

          <div className="flex items-center gap-[7px]">
            {children.map((_, index) => (
              <div
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-[6px] rounded-full cursor-pointer transition-all duration-300 ${
                  index === currentSlide ? "w-[22px] bg-accent" : "w-[6px] bg-slate-900/25 hover:bg-slate-900/45"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-[10px]">
            <button onClick={prev} disabled={currentSlide === 0}
              className="p-[6px] rounded-full text-slate-900/55 hover:text-slate-900 hover:bg-slate-900/10 disabled:opacity-20 disabled:pointer-events-none transition-all">
              <ChevronLeft size={18} />
            </button>
            <button onClick={next} disabled={currentSlide === total - 1}
              className="p-[6px] rounded-full text-slate-900/55 hover:text-slate-900 hover:bg-slate-900/10 disabled:opacity-20 disabled:pointer-events-none transition-all">
              <ChevronRight size={18} />
            </button>
            <div className="w-[1px] h-[16px] bg-slate-900/15" />
            <button onClick={toggleFullscreen}
              className="p-[6px] rounded-full text-slate-900/55 hover:text-slate-900 hover:bg-slate-900/10 transition-all">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
