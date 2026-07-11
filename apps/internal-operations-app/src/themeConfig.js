export const themes = ["light", "dark"];
export const defaultTheme = "light";
export const themeStorageKey = "ems-theme";

export function getInitialTheme(storage = typeof window !== "undefined" ? window.localStorage : null, media = typeof window !== "undefined" ? window.matchMedia : null) {
  try {
    const stored = storage?.getItem(themeStorageKey);
    if (themes.includes(stored)) return stored;
  } catch {
    // Fall through to the system preference when storage is unavailable.
  }

  return media?.("(prefers-color-scheme: dark)")?.matches ? "dark" : defaultTheme;
}
