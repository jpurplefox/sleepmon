import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { useI18n } from "../i18n";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Fallback funcional: el ErrorBoundary es un class component y no puede usar
// hooks, así que la traducción vive en este componente interno.
function ErrorFallback() {
  const { t } = useI18n();
  return (
    <div className="error-boundary" role="alert">
      <h2>{t("error.title")}</h2>
      <p className="muted">{t("error.body")}</p>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => window.location.reload()}
      >
        {t("common.reload")}
      </button>
    </div>
  );
}

// Captura excepciones de render del árbol que envuelve y muestra un fallback
// accesible en vez de dejar la app en blanco. Es un class component porque los
// error boundaries todavía no tienen equivalente en hooks.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Dejamos rastro en consola para diagnóstico; el usuario ve el fallback.
    console.error("Error de render capturado por ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
