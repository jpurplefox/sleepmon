import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { Production } from "./pages/Production";
import { Team } from "./pages/Team";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

type Tab = "team" | "production";

const TABS: Tab[] = ["team", "production"];

export default function App() {
  const [tab, setTab] = useState<Tab>("team");

  // Navegación entre tabs con flechas izquierda/derecha (patrón ARIA de tablist).
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const idx = TABS.indexOf(tab);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setTab(TABS[(idx + 1) % TABS.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setTab(TABS[(idx - 1 + TABS.length) % TABS.length]);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <nav className="tabs" role="tablist" aria-label="Navegación principal">
        <button
          id="tab-team"
          type="button"
          role="tab"
          aria-selected={tab === "team"}
          aria-controls="tabpanel-team"
          tabIndex={tab === "team" ? 0 : -1}
          className={"tab" + (tab === "team" ? " tab--active" : "")}
          onClick={() => setTab("team")}
          onKeyDown={onTabKeyDown}
        >
          Equipo
        </button>
        <button
          id="tab-production"
          type="button"
          role="tab"
          aria-selected={tab === "production"}
          aria-controls="tabpanel-production"
          tabIndex={tab === "production" ? 0 : -1}
          className={"tab" + (tab === "production" ? " tab--active" : "")}
          onClick={() => setTab("production")}
          onKeyDown={onTabKeyDown}
        >
          Comparación
        </button>
      </nav>
      {tab === "team" ? (
        <div role="tabpanel" id="tabpanel-team" aria-labelledby="tab-team" tabIndex={0}>
          <Team />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="tabpanel-production"
          aria-labelledby="tab-production"
          tabIndex={0}
        >
          <Production />
        </div>
      )}
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
