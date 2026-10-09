import { Link } from "wouter";

import { CONTACT_EMAIL } from "../contact";
import { useI18n } from "../i18n";
import { ROUTES } from "../routes";

/** The line under every screen: privacy link, contact email and the fan-project notice. */
export function AppFooter({ email = CONTACT_EMAIL }: { email?: string | null }) {
  const { t } = useI18n();
  return (
    <footer className="app-footer">
      <Link href={ROUTES.privacy}>{t("footer.privacy")}</Link>
      {email && (
        <>
          <span aria-hidden="true">·</span>
          <span className="app-footer__email">{email}</span>
        </>
      )}
      <span aria-hidden="true">·</span>
      <span>{t("footer.notice")}</span>
    </footer>
  );
}
