import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { LanguageProvider } from "./i18n";
import "./styles.css";
import { initAnalytics } from "./telemetry/analytics";
import { readTelemetryConfig } from "./telemetry/config";
import { initSentry } from "./telemetry/sentry";

// Before the first render, so errors during startup are reported too.
const telemetry = readTelemetryConfig();
initSentry(telemetry);
initAnalytics(telemetry);

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró #root");

createRoot(root).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
