import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
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
      return (
        <div className="error-boundary" role="alert">
          <h2>Algo salió mal</h2>
          <p className="muted">
            Ocurrió un error inesperado al mostrar esta vista. Probá recargar la página.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
