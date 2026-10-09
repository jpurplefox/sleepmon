// Comparison's cards and map terms, lifted above the routes so they survive moving
// to another tool and back (Team analysis does the same, see teamSession.tsx).
// Still session state: a reload starts empty.
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { NEUTRAL_MAP, type ComparisonMap } from "./comparisonMap";
import type { RosterEntry } from "./roster";

export interface ComparisonSession {
  entries: RosterEntry[];
  setEntries: Dispatch<SetStateAction<RosterEntry[]>>;
  /** The map terms apply to every card, the base included. */
  map: ComparisonMap;
  setMap: Dispatch<SetStateAction<ComparisonMap>>;
}

const ComparisonSessionContext = createContext<ComparisonSession | null>(null);

export function ComparisonSessionProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [map, setMap] = useState<ComparisonMap>(NEUTRAL_MAP);
  const value = useMemo(() => ({ entries, setEntries, map, setMap }), [entries, map]);
  return (
    <ComparisonSessionContext.Provider value={value}>{children}</ComparisonSessionContext.Provider>
  );
}

export function useComparisonSession(): ComparisonSession {
  const ctx = useContext(ComparisonSessionContext);
  if (!ctx) throw new Error("useComparisonSession must be used inside ComparisonSessionProvider");
  return ctx;
}
