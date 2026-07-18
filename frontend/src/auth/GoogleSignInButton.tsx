import { useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n";
import { useAuth } from "./AuthContext";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// GIS `initialize()` is GLOBAL config; calling it once per button instance (or
// twice under React StrictMode) triggers a "called multiple times" warning and
// only the last callback wins. So we initialize GIS exactly once for the whole
// app and route its callback through a module-level ref to whichever button is
// currently mounted — each instance then only renders its own button.
let gsiInitialized = false;
let currentCredentialHandler: ((credential: string) => void) | null = null;

// Returns the GIS `id` namespace once it's available (initializing it exactly
// once), or null while the async GIS script is still loading.
function ensureGsiInitialized(clientId: string) {
  const id = window.google?.accounts?.id;
  if (!id) return null;
  if (!gsiInitialized) {
    id.initialize({
      client_id: clientId,
      callback: (response) => currentCredentialHandler?.(response.credential),
    });
    gsiInitialized = true;
  }
  return id;
}

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

    // This instance is the active credential target while it's mounted.
    const handler = (credential: string) => {
      setFailed(false);
      setBusy(true);
      login(credential)
        .catch(() => setFailed(true))
        .finally(() => setBusy(false));
    };
    currentCredentialHandler = handler;

    const tryRender = () => {
      if (cancelled) return;
      const id = ensureGsiInitialized(CLIENT_ID);
      const overlay = overlayRef.current;
      // The GIS script loads `async`; it (and the overlay) may not be ready yet.
      if (!id || !overlay) {
        if (attempts++ < 40) setTimeout(tryRender, 250);
        return;
      }
      id.renderButton(overlay, { type: "standard", width: 260 });
    };

    tryRender();
    return () => {
      cancelled = true;
      if (currentCredentialHandler === handler) currentCredentialHandler = null;
    };
  }, [login]);

  return (
    <div className="google-signin">
      <div className="google-signin__control">
        <button
          type="button"
          className="btn btn--google"
          data-autofocus
          tabIndex={-1}
          aria-hidden="true"
          disabled={busy}
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
