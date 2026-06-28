import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { UI } from "./ui";
import {
  tBerry,
  tIngredient,
  tMainSkill,
  tNature,
  tNatureStat,
  tSpecialty,
  tSubSkill,
  tType,
} from "./terms";
import type { Lang } from "./terms";

export type { Lang } from "./terms";

const STORAGE_KEY = "sleepmon.lang";

// Default: idioma guardado, si no el del navegador (español si empieza con "es"),
// si no inglés.
function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "es" || saved === "en") return saved;
  } catch {
    /* localStorage no disponible */
  }
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  // Prosa de UI: busca la clave en el idioma actual e interpola {var}.
  t: (key: string, vars?: Record<string, string | number>) => string;
  // Términos del juego, ya atados al idioma actual.
  nature: (name: string) => string;
  natureStat: (name: string) => string;
  ingredient: (name: string) => string;
  berry: (name: string) => string;
  subSkill: (name: string) => string;
  specialty: (name: string) => string;
  mainSkill: (name: string) => string;
  type: (name: string) => string;
}

const Ctx = createContext<I18n | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = UI[lang][key] ?? UI.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.split(`{${k}}`).join(String(v));
        }
      }
      return s;
    },
    [lang],
  );

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t,
      nature: (n) => tNature(n, lang),
      natureStat: (n) => tNatureStat(n, lang),
      ingredient: (n) => tIngredient(n, lang),
      berry: (n) => tBerry(n, lang),
      subSkill: (n) => tSubSkill(n, lang),
      specialty: (n) => tSpecialty(n, lang),
      mainSkill: (n) => tMainSkill(n, lang),
      type: (n) => tType(n, lang),
    }),
    [lang, setLang, t],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n debe usarse dentro de <LanguageProvider>");
  return ctx;
}
