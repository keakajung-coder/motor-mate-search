import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemePreset {
  name: string;
  primary: string;
  ring: string;
  swatch: string;
  darkPrimary?: string;
  darkRing?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: "น้ำเงินเข้ม (ค่าเริ่มต้น)",
    primary: "oklch(0.42 0.06 220)",
    ring: "oklch(0.42 0.06 220)",
    darkPrimary: "oklch(0.60 0.12 230)",
    darkRing: "oklch(0.60 0.12 230)",
    swatch: "#264a6b",
  },
  {
    name: "ฟ้า",
    primary: "oklch(0.55 0.18 240)",
    ring: "oklch(0.55 0.18 240)",
    darkPrimary: "oklch(0.65 0.18 240)",
    darkRing: "oklch(0.65 0.18 240)",
    swatch: "#2563eb",
  },
  {
    name: "เขียว",
    primary: "oklch(0.55 0.15 150)",
    ring: "oklch(0.55 0.15 150)",
    darkPrimary: "oklch(0.65 0.15 150)",
    darkRing: "oklch(0.65 0.15 150)",
    swatch: "#16a34a",
  },
  {
    name: "ส้ม",
    primary: "oklch(0.65 0.18 45)",
    ring: "oklch(0.65 0.18 45)",
    darkPrimary: "oklch(0.70 0.18 45)",
    darkRing: "oklch(0.70 0.18 45)",
    swatch: "#ea580c",
  },
  {
    name: "แดง",
    primary: "oklch(0.55 0.2 25)",
    ring: "oklch(0.55 0.2 25)",
    darkPrimary: "oklch(0.65 0.2 25)",
    darkRing: "oklch(0.65 0.2 25)",
    swatch: "#dc2626",
  },
  {
    name: "ม่วง",
    primary: "oklch(0.5 0.2 300)",
    ring: "oklch(0.5 0.2 300)",
    darkPrimary: "oklch(0.65 0.2 300)",
    darkRing: "oklch(0.65 0.2 300)",
    swatch: "#7c3aed",
  },
  {
    name: "ชมพู",
    primary: "oklch(0.65 0.2 350)",
    ring: "oklch(0.65 0.2 350)",
    darkPrimary: "oklch(0.70 0.2 350)",
    darkRing: "oklch(0.70 0.2 350)",
    swatch: "#ec4899",
  },
  {
    name: "เทา",
    primary: "oklch(0.35 0.02 260)",
    ring: "oklch(0.35 0.02 260)",
    darkPrimary: "oklch(0.60 0.02 260)",
    darkRing: "oklch(0.60 0.02 260)",
    swatch: "#334155",
  },
];

const MODE_KEY = "app_theme_mode";
const THEME_KEY = "app_theme";

export function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const m = localStorage.getItem(MODE_KEY);
  if (m === "dark" || m === "light" || m === "system") return m;
  return "light";
}

export function getStoredPreset(): ThemePreset {
  if (typeof window === "undefined") return THEME_PRESETS[0];
  const saved = localStorage.getItem(THEME_KEY);
  return THEME_PRESETS.find((t) => t.swatch === saved) ?? THEME_PRESETS[0];
}

export function applyTheme(mode: ThemeMode, preset: ThemePreset) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  const isDark =
    mode === "dark" ||
    (mode === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  const primary = isDark && preset.darkPrimary ? preset.darkPrimary : preset.primary;
  const ring = isDark && preset.darkRing ? preset.darkRing : preset.ring;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", ring);
  root.style.setProperty("--primary-foreground", "oklch(0.99 0 0)");
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);
  const [preset, setPresetState] = useState<ThemePreset>(getStoredPreset);

  const isDark =
    mode === "dark" ||
    (mode === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(MODE_KEY, newMode);
    applyTheme(newMode, getStoredPreset());
    window.dispatchEvent(new CustomEvent("app:theme-changed"));
  }, []);

  const setPreset = useCallback((newPreset: ThemePreset) => {
    setPresetState(newPreset);
    localStorage.setItem(THEME_KEY, newPreset.swatch);
    applyTheme(getStoredMode(), newPreset);
    window.dispatchEvent(new CustomEvent("app:theme-changed"));
  }, []);

  const toggleMode = useCallback(() => {
    const nextMode: ThemeMode = isDark ? "light" : "dark";
    setMode(nextMode);
  }, [isDark, setMode]);

  useEffect(() => {
    const sync = () => {
      const curMode = getStoredMode();
      const curPreset = getStoredPreset();
      setModeState(curMode);
      setPresetState(curPreset);
      applyTheme(curMode, curPreset);
    };

    sync();

    window.addEventListener("app:theme-changed", sync);
    window.addEventListener("storage", sync);

    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (getStoredMode() === "system") {
        applyTheme("system", getStoredPreset());
        setModeState("system");
      }
    };
    mediaQuery?.addEventListener?.("change", handleSystemChange);

    return () => {
      window.removeEventListener("app:theme-changed", sync);
      window.removeEventListener("storage", sync);
      mediaQuery?.removeEventListener?.("change", handleSystemChange);
    };
  }, []);

  return {
    mode,
    setMode,
    isDark,
    toggleMode,
    preset,
    setPreset,
    presets: THEME_PRESETS,
  };
}
