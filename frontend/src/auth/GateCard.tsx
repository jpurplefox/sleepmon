import { IconMoon } from "../components/icons";
import { useI18n } from "../i18n";
import { GoogleSignInButton } from "./GoogleSignInButton";

// Gate anónimo de una página reservada (Caja, Análisis de equipo): el tab sigue
// alcanzable, solo el contenido se sustituye por esta card — acá el contexto ES
// la página, no hay nada que preservar detrás (a diferencia del diálogo). Un
// único acento gold (el roundel de luna) por card, per "one gold accent" del
// design system; el resto es neutro.
export function GateCard() {
  const { t } = useI18n();
  return (
    <div className="layout">
      <div className="card gate-card">
        <div className="gate-card__moon">
          <IconMoon width={20} height={20} />
        </div>
        <p className="gate-card__title">{t("auth.gateTitle")}</p>
        <p className="gate-card__body">{t("auth.gateBody")}</p>
        <GoogleSignInButton />
      </div>
    </div>
  );
}
