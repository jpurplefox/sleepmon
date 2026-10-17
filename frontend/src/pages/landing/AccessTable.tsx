import { useAuth } from "../../auth/AuthContext";
import { GoogleSignInButton } from "../../auth/GoogleSignInButton";
import { IconCheck } from "../../components/icons";
import { useI18n } from "../../i18n";
import { ACCESS_ROWS } from "./content";

/** What works without an account and what an account adds, with a way to sign in when signed out. */
export function AccessTable() {
  const { t } = useI18n();
  const { status } = useAuth();
  const mark = (yes: boolean) =>
    yes ? (
      <span className="landing-access__yes">
        <IconCheck aria-hidden="true" />
        <span className="sr-only">{t("landing.access.yes")}</span>
      </span>
    ) : (
      // The dash is drawn by CSS, so the cell reads only "Not included".
      <span className="landing-access__no">
        <span className="sr-only">{t("landing.access.no")}</span>
      </span>
    );
  return (
    <section className="landing-access" aria-labelledby="landing-access-title">
      <div className="landing-section-head">
        <h2 id="landing-access-title">{t("landing.access.title")}</h2>
        <span>{t("landing.access.subtitle")}</span>
      </div>
      <div className="landing-access__card">
        <table className="landing-access__table">
          <thead>
            <tr>
              <th scope="col">{t("landing.access.feature")}</th>
              <th scope="col">{t("landing.access.without")}</th>
              <th scope="col" className="landing-access__with">
                {t("landing.access.with")}
              </th>
            </tr>
          </thead>
          <tbody>
            {ACCESS_ROWS.map((r) => (
              <tr key={r.id}>
                <th scope="row">{t(`landing.access.row.${r.id}`)}</th>
                <td>{mark(r.withoutAccount)}</td>
                <td className="landing-access__with">{mark(true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {status === "anonymous" && (
          <div className="landing-access__cta">
            <GoogleSignInButton reason="landing" />
          </div>
        )}
      </div>
    </section>
  );
}
