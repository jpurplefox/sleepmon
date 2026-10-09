import { Link } from "wouter";

import { CONTACT_EMAIL } from "../contact";
import { ToolHeader } from "../components/ToolHeader";
import { useI18n } from "../i18n";
import { ROUTES } from "../routes";

/** Date of the last change to the privacy copy; bump it whenever the text changes. */
export const PRIVACY_UPDATED = "2026-10-09";

/** Public privacy page (PRD 0018): what is kept, metrics, and how to delete. */
export function Privacy({ email = CONTACT_EMAIL }: { email?: string | null }) {
  const { t, lang } = useI18n();
  const date = new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${PRIVACY_UPDATED}T00:00:00Z`),
  );

  // The delete sentence is one translatable string; {link} marks where the Link goes.
  const [before, after] = t("privacy.deleteBody").split("{link}");

  return (
    <div className="layout">
      <div className="doc-page">
        <ToolHeader title={t("privacy.title")} />
        <p className="muted doc-updated">{t("privacy.updated", { date })}</p>

        <div className="card doc-sections">
          <section>
            <h2>{t("privacy.whoTitle")}</h2>
            <p>
              {t("privacy.whoBody")}
              {email && ` ${t("privacy.whoContact", { email })}`}
            </p>
          </section>
          <section>
            <h2>{t("privacy.dataTitle")}</h2>
            <p>{t("privacy.dataBody")}</p>
          </section>
          <section>
            <h2>{t("privacy.browserTitle")}</h2>
            <p>{t("privacy.browserBody")}</p>
          </section>
          <section>
            <h2>{t("privacy.metricsTitle")}</h2>
            <p>{t("privacy.metricsBody")}</p>
          </section>
          <section>
            <h2>{t("privacy.deleteTitle")}</h2>
            <p>
              {before}
              <Link href={ROUTES.account}>{t("account.title")}</Link>
              {after}
              {email && ` ${t("privacy.deleteMail", { email })}`}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
