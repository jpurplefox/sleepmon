import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { Production } from "./pages/Production";
import { Team } from "./pages/Team";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

type Tab = "team" | "production";

export default function App() {
  const [tab, setTab] = useState<Tab>("team");

  return (
    <QueryClientProvider client={queryClient}>
      <nav className="tabs" role="tablist" aria-label="Navegación principal">
        <button
          role="tab"
          aria-selected={tab === "team"}
          className={"tab" + (tab === "team" ? " tab--active" : "")}
          onClick={() => setTab("team")}
        >
          Equipo
        </button>
        <button
          role="tab"
          aria-selected={tab === "production"}
          className={"tab" + (tab === "production" ? " tab--active" : "")}
          onClick={() => setTab("production")}
        >
          Producción
        </button>
      </nav>
      {tab === "team" ? <Team /> : <Production />}
    </QueryClientProvider>
  );
}
