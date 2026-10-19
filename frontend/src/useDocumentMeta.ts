import { useEffect } from "react";

import { useI18n } from "./i18n";

/** Keeps the page title and meta description in the active language, app-wide. */
export function useSiteMeta(): void {
  const { t } = useI18n();
  const title = t("meta.title");
  const description = t("meta.description");
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.append(meta);
    }
    document.title = title;
    meta.content = description;
  }, [title, description]);
}
