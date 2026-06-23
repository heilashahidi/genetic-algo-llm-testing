import { useEffect, useRef } from "react";

/**
 * Calls `callback` on an interval while `active` is true. The callback is also
 * invoked once immediately when polling (re)starts. Cleans up on unmount or
 * whenever polling is deactivated (e.g. once a run reaches a terminal status).
 */
export function usePolling(
  callback: () => void,
  intervalMs: number,
  active: boolean,
): void {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!active) {
      return;
    }
    savedCallback.current();
    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
}
