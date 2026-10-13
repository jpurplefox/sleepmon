// The human check for signed-out sharing (ADR 0012): Cloudflare Turnstile, loaded only
// when needed and shown only when Cloudflare asks for an interaction.
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

interface TurnstileApi {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      appearance: "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.addEventListener("load", () =>
        window.turnstile ? resolve(window.turnstile) : reject(new Error("verification")),
      );
      script.addEventListener("error", () => {
        loading = null;
        reject(new Error("verification"));
      });
      document.head.appendChild(script);
    });
  }
  return loading;
}

/** Renders the widget in `container` and resolves with a single-use token. */
export async function renderTurnstile(container: HTMLElement, siteKey: string): Promise<string> {
  const api = await loadTurnstile();
  return new Promise((resolve, reject) => {
    api.render(container, {
      sitekey: siteKey,
      appearance: "interaction-only",
      callback: resolve,
      "error-callback": () => reject(new Error("verification")),
      "expired-callback": () => reject(new Error("verification")),
    });
  });
}

export function __resetTurnstileForTests(): void {
  loading = null;
}
