import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { GateCard } from "./auth/GateCard";
import { GoogleSignInButton } from "./auth/GoogleSignInButton";
import { ProfileMenu } from "./auth/ProfileMenu";
import { SignInDialog } from "./auth/SignInDialog";
import { GateProvider } from "./auth/useGate";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LanguageSelector } from "./components/LanguageSelector";
import { NavTabs } from "./components/NavTabs";
import { Placeholder } from "./components/Placeholder";
import { useI18n } from "./i18n";
import { Production } from "./pages/Production";
import { Team } from "./pages/Team";
import { Teams } from "./pages/Teams";
import { ROUTES } from "./routes";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GateProvider>
          <ErrorBoundary>
            <AppShell />
          </ErrorBoundary>
        </GateProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// App shell: topbar (nav + auth + language) and the routed tool pages. Kept
// separate from App() so it can use useAuth()/useLocation() below their
// providers.
function AppShell() {
  // "Compare" from the Box hands the picked Pokémon to the Comparison page as
  // its base. The shell stays mounted across route changes, so this survives the
  // navigation and is cleared once consumed.
  const [compareBase, setCompareBase] = useState<string | null>(null);
  const { t } = useI18n();
  const { status } = useAuth();
  const [, navigate] = useLocation();

  const authenticated = status === "authenticated";
  const checking = status === "checking";

  const openCompare = (memberId: string) => {
    setCompareBase(memberId);
    navigate(ROUTES.compare);
  };

  // Reserved tools render a login prompt in place (no redirect), matching the
  // previous per-panel gating.
  const gated = (node: React.ReactNode) =>
    checking ? <Placeholder loading>{t("auth.checkingSession")}</Placeholder> : authenticated ? node : <GateCard />;

  return (
    <>
      <div className="topbar">
        <NavTabs />
        <div className="topbar__right">
          {checking ? (
            <div className="auth-slot-placeholder" aria-hidden="true" />
          ) : authenticated ? (
            <ProfileMenu />
          ) : (
            <GoogleSignInButton />
          )}
          <LanguageSelector />
        </div>
      </div>
      <main>
        <Switch>
          <Route path={ROUTES.box}>{gated(<Team onCompare={openCompare} />)}</Route>
          <Route path={ROUTES.compare}>
            {/* Ephemeral comparator: open to anyone, no gate. */}
            <Production baseMemberId={compareBase} onBaseConsumed={() => setCompareBase(null)} />
          </Route>
          <Route path={ROUTES.teamAnalysis}>{gated(<Teams />)}</Route>
          {/* Default and unknown paths land on the Box. */}
          <Route path="/">
            <Redirect to={ROUTES.box} />
          </Route>
          <Route>
            <Redirect to={ROUTES.box} />
          </Route>
        </Switch>
      </main>
      <SignInDialog />
    </>
  );
}
