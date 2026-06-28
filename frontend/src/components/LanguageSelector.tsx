import { useI18n } from "../i18n";
import type { Lang } from "../i18n";

const LANGS: { code: Lang; label: string }[] = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
];

// Selector de idioma compacto (ES / EN), al estilo de los chips del resto de la app.
export function LanguageSelector() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-select" role="group" aria-label={t("nav.language")}>
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={"lang-chip" + (lang === code ? " lang-chip--active" : "")}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
