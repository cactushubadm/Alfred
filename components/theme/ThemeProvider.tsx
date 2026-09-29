"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

// Precisa bater com a chave lida pelo script inline em app/layout.tsx (que
// aplica a classe "dark" antes do primeiro paint, sem esperar o React).
const STORAGE_KEY = "theme-preference";

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;
}

function applyClass(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

const ThemeContext = createContext<{
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(preference));

  // Reconcilia com profiles.theme_preference (pode ter sido trocado em
  // outro dispositivo) — o script inline do layout já resolveu o primeiro
  // paint com o localStorage local, isso só corrige depois se o banco
  // tiver um valor diferente.
  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      const { data } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", user.id)
        .maybeSingle();

      const dbPreference = data?.theme_preference;
      if (
        active &&
        (dbPreference === "light" || dbPreference === "dark" || dbPreference === "system")
      ) {
        setPreferenceState((current) => {
          if (dbPreference === current) return current;
          window.localStorage.setItem(STORAGE_KEY, dbPreference);
          return dbPreference;
        });
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplica a classe "dark" sempre que a preferência mudar e, no modo
  // "sistema", também quando o SO trocar de tema com o app já aberto.
  useEffect(() => {
    const applied = resolve(preference);
    setResolvedTheme(applied);
    applyClass(applied);

    if (preference !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    function handleSystemChange() {
      const updated = resolve("system");
      setResolvedTheme(updated);
      applyClass(updated);
    }
    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [preference]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      window.localStorage.setItem(STORAGE_KEY, next);

      // Persiste em profiles pra sincronizar entre dispositivos — melhor
      // esforço, não bloqueia a troca visual (já aplicada via localStorage
      // no efeito acima).
      (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("profiles").update({ theme_preference: next }).eq("id", user.id);
      })();
    },
    [supabase]
  );

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  return ctx;
}
