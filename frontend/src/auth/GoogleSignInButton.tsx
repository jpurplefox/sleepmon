import { useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n";
import { useAuth } from "./AuthContext";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Botón "Sign in with Google" (`.btn--google`). Google Identity Services no deja
// re-estilar el botón que renderiza, así que mantenemos el `.btn--google` real
// (visible, es lo que el usuario ve) y superponemos el botón que GIS renderiza,
// transparente, exactamente encima (`.google-signin__overlay`): el click que
// llega a Google es un gesto real sobre el elemento real de Google (GIS lo
// exige), mientras lo que se ve en pantalla es el nuestro. `:focus-within`
// refleja el foco de teclado sobre el botón visible ya que el real es invisible.
//
// Si falta VITE_GOOGLE_CLIENT_ID, se muestra el `.btn--google` igual pero sin
// inicializar GIS (no-op + warning en consola) — nunca rompe el render.
export function GoogleSignInButton() {
  const { login } = useAuth();
  const { t } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) {
      // eslint-disable-next-line no-console
      console.warn("VITE_GOOGLE_CLIENT_ID no está configurado; el sign-in queda deshabilitado.");
      return;
    }
    let cancelled = false;
    let attempts = 0;

    const tryInit = () => {
      if (cancelled || initialized.current) return;
      const id = window.google?.accounts?.id;
      const overlay = overlayRef.current;
      if (!id || !overlay) {
        // El script de GIS se carga con `async`; puede no estar listo todavía.
        if (attempts++ < 40) setTimeout(tryInit, 250);
        return;
      }
      id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => {
          setFailed(false);
          setBusy(true);
          login(response.credential)
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        },
      });
      id.renderButton(overlay, { type: "standard", width: 260 });
      initialized.current = true;
    };

    tryInit();
    return () => {
      cancelled = true;
    };
  }, [login]);

  return (
    <div className="google-signin">
      <div className="google-signin__control">
        <button
          type="button"
          className="btn btn--google"
          tabIndex={-1}
          aria-hidden="true"
          disabled={busy}
          aria-busy={busy || undefined}
        >
          <span className="g" aria-hidden="true">G</span>
          {t("auth.signInGoogle")}
        </button>
        <div
          ref={overlayRef}
          className="google-signin__overlay"
          // Evita un segundo click sobre el iframe real mientras el credential
          // ya recibido está en vuelo hacia el backend.
          style={busy ? { pointerEvents: "none" } : undefined}
        />
      </div>
      {failed && (
        <p className="error auth-error" role="alert">
          {t("auth.signInFailed")}
        </p>
      )}
    </div>
  );
}
