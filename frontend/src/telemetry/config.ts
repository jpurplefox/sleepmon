// Telemetry settings, read once from the build-time env (ADR-0010). An empty
// key or DSN turns that service off entirely.
export interface TelemetryConfig {
  release: string;
  environment: string;
  sentryDsn: string | null;
  tracesSampleRate: number;
  apiUrl: string;
  posthogKey: string | null;
  posthogHost: string;
}

const orNull = (v: string | undefined): string | null => (v ? v : null);

function sampleRate(raw: string | undefined): number {
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0;
}

export function readTelemetryConfig(
  env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>,
): TelemetryConfig {
  return {
    release: env.VITE_RELEASE || "dev",
    environment: env.VITE_SENTRY_ENVIRONMENT || "development",
    sentryDsn: orNull(env.VITE_SENTRY_DSN),
    tracesSampleRate: sampleRate(env.VITE_SENTRY_TRACES_SAMPLE_RATE),
    apiUrl: env.VITE_API_URL || "http://localhost:8000",
    posthogKey: orNull(env.VITE_POSTHOG_KEY),
    posthogHost: env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
  };
}
