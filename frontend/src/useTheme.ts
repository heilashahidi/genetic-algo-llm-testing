import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ga.theme";
const TRANSITION_MS = 320;

/** Read the theme the no-flash init script already applied to <html>. */
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Light/dark theme state. The initial value is whatever the inline script in
 * index.html resolved (stored choice → system preference) before first paint,
 * so there is no flash. Toggling persists the choice, flips the data-theme
 * attribute that drives every CSS token, and adds a short-lived class so the
 * whole UI cross-fades once rather than snapping.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      const root = document.documentElement;
      root.classList.add("theme-transition");
      root.dataset.theme = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage may be unavailable; the in-memory toggle still works.
      }
      window.setTimeout(
        () => root.classList.remove("theme-transition"),
        TRANSITION_MS,
      );
      return next;
    });
  }, []);

  return [theme, toggle];
}
