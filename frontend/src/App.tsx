import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Team } from "./pages/Team";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Team />
    </QueryClientProvider>
  );
}
