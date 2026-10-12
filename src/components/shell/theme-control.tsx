"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const storageKey = "cloud-agent-theme-v1";
const eventName = "cloud-agent-theme-change";
let memoryPreference: Theme | undefined;

function readTheme(): Theme {
  if (memoryPreference) return memoryPreference;
  try {
    const value = localStorage.getItem(storageKey);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  const onStorage = () => {
    memoryPreference = undefined;
    onChange();
  };
  window.addEventListener(eventName, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(eventName, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function ThemeControl() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as const);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme = theme === "system"
        ? (media.matches ? "dark" : "light")
        : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  function changeTheme(value: string) {
    if (value !== "light" && value !== "dark" && value !== "system") return;
    memoryPreference = value;
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // Keep appearance usable in this tab when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(eventName));
  }

  return (
    <label className="theme-control">
      <span>Theme</span>
      <select
        aria-label="Color theme"
        value={theme}
        onChange={(event) => changeTheme(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
