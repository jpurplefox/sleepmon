import { useI18n } from "../../i18n";
import { FAQ_ID, FAQ_ITEMS } from "./content";

/** Closed questions: why sleepmon, then the model's assumptions. */
export function Faq() {
  const { t } = useI18n();
  return (
    <section id={FAQ_ID} className="landing-faq" aria-labelledby="landing-faq-title">
      <div className="landing-faq__side">
        <h2 id="landing-faq-title">{t("landing.faq.title")}</h2>
      </div>
      <div className="landing-faq__list">
        {FAQ_ITEMS.map((item) => (
          <details key={item.id}>
            <summary>
              {t(`landing.faq.${item.id}.q`)}
              <span className="landing-faq__toggle" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <p>{t(`landing.faq.${item.id}.a`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
