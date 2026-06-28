import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Tween a number from its previously shown value to `value` whenever `value`
 * changes — so polling that leaves a value unchanged does not re-trigger the
 * animation, but a real change animates. First mount counts up from zero.
 * Returns the raw (un-rounded) tweened value; the caller formats it.
 */
export function useCountUp(value: number, durationMs = 800): number {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  shownRef.current = shown;
  const rafRef = useRef<number>();

  useEffect(() => {
    if (shownRef.current === value) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const from = shownRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setShown(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return shown;
}
