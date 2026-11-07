export type ThemeMode = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";

const THEME_KEY = "dup.theme.v1";
const DENSITY_KEY = "dup.density.v1";

export function loadTheme(): ThemeMode {
  const v = localStorage.getItem(THEME_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function saveTheme(mode: ThemeMode) {
  localStorage.setItem(THEME_KEY, mode);
  applyTheme(mode);
}

export function loadDensity(): Density {
  return localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
}

export function saveDensity(d: Density) {
  localStorage.setItem(DENSITY_KEY, d);
  applyDensity(d);
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "dark" : "light");
}

export function applyDensity(d: Density) {
  document.documentElement.setAttribute("data-density", d);
}

export function initAppearance() {
  applyTheme(loadTheme());
  applyDensity(loadDensity());
}
