import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";

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
      className="relative w-screen h-screen overflow-hidden bg-black"
    >
      <div className="w-full h-full relative">
        {children.map((slide, index) => {
          const active = index === currentSlide;
          const transform = active ? "scale(1)" : index < currentSlide ? "scale(0.95)" : "scale(1.05)";
          return (
            <div
              key={index}
              style={{ transform, transition: "opacity 500ms ease-in-out, transform 500ms ease-in-out" }}
              className={`absolute inset-0 w-full h-full ${active ? "opacity-100 pointer-events-auto z-10" : "opacity-0 pointer-events-none"}`}
            >
              {active ? slide : null}
            </div>
          );
        })}
      </div>

      <div
        style={{ transition: "opacity 300ms ease-in-out" }}
        className={`absolute inset-0 pointer-events-none z-50 flex flex-col justify-end p-[2.5%] ${controlsVisible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="w-full flex items-center justify-between pointer-events-auto px-[2.2%] py-[0.9%] rounded-full bg-black/25 backdrop-blur-md border border-white/10 max-w-[95vw] mx-auto">
          <div className="text-white/55 mono" style={{ fontSize: "12px", fontVariantNumeric: "tabular-nums" }}>
            {String(currentSlide + 1).padStart(2, "0")} <span className="text-white/25">/</span> {String(total).padStart(2, "0")}
          </div>

          <div className="flex items-center gap-[7px]">
            {children.map((_, index) => (
              <div
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-[6px] rounded-full cursor-pointer transition-all duration-300 ${
                  index === currentSlide ? "w-[22px] bg-accent" : "w-[6px] bg-white/30 hover:bg-white/55"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-[10px]">
            <button onClick={prev} disabled={currentSlide === 0}
              className="p-[6px] rounded-full text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition-all">
              <ChevronLeft size={18} />
            </button>
            <button onClick={next} disabled={currentSlide === total - 1}
              className="p-[6px] rounded-full text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition-all">
              <ChevronRight size={18} />
            </button>
            <div className="w-[1px] h-[16px] bg-white/15" />
            <button onClick={toggleFullscreen}
              className="p-[6px] rounded-full text-white/55 hover:text-white hover:bg-white/10 transition-all">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
