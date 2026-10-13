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
      const fail = () => {
        loading = null;
        script.remove();
        reject(new Error("verification"));
      };
      script.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : fail()));
      script.addEventListener("error", fail);
      document.head.appendChild(script);
    });
  }
  return loading;
}

/**
 * Renders the widget in `container` and resolves with a single-use token. The widget is
 * removed once the promise settles; with no answer within `timeoutMs` it rejects.
 */
export async function renderTurnstile(
  container: HTMLElement,
  siteKey: string,
  timeoutMs = 60_000,
): Promise<string> {
  const api = await loadTurnstile();
  container.replaceChildren();
  return new Promise((resolve, reject) => {
    let widgetId: string | null = null;
    let settled = false;
    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      if (widgetId !== null) {
        try {
          api.remove(widgetId);
        } catch {
          // The widget is already gone; nothing to clean up.
        }
      }
    };
    const fail = () => {
      if (settled) return;
      cleanup();
      reject(new Error("verification"));
    };
    const timer = setTimeout(fail, timeoutMs);
    widgetId = api.render(container, {
      sitekey: siteKey,
      appearance: "interaction-only",
      callback: (token) => {
        if (settled) return;
        cleanup();
        resolve(token);
      },
      "error-callback": fail,
      "expired-callback": fail,
    });
    // A callback that fired synchronously inside render() settled before we had the id.
    if (settled) {
      try {
        api.remove(widgetId);
      } catch {
        // Ignore: see above.
      }
    }
  });
}

export function __resetTurnstileForTests(): void {
  loading = null;
}
