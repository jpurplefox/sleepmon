// Team Analysis's session, lifted above the routes so it survives moving between
// tools (and so the Teams tool can open a saved team into it). Still session
// state: a reload starts empty, as before (PRD 0005, 0016).
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { CURRENT_EVENT, presetEffects } from "./currentEvent";
import type { EventEffect } from "./eventBonus";
import { newId } from "./roster";
import type { TeamDefinition } from "./savedTeams";
import type { Slot } from "./teamRoster";
import type { DishType, MealInput, WeeklyBonus } from "./types";

type Setter<T> = Dispatch<SetStateAction<T>>;

export interface TeamSession {
  slots: Slot[];
  setSlots: Setter<Slot[]>;
  meals: (MealInput | null)[];
  setMeals: Setter<(MealInput | null)[]>;
  dishType: DishType | null;
  setDishType: Setter<DishType | null>;
  selectedIsland: string | null;
  setSelectedIsland: Setter<string | null>;
  favoriteBerries: string[];
  setFavoriteBerries: Setter<string[]>;
  mainFavorite: string | null;
  setMainFavorite: Setter<string | null>;
  weeklyBonus: WeeklyBonus;
  setWeeklyBonus: Setter<WeeklyBonus>;
  goodCampTicket: boolean;
  setGoodCampTicket: Setter<boolean>;
  eventEffects: EventEffect[];
  setEventEffects: Setter<EventEffect[]>;
  /** The saved team the session was opened from or last saved as; null for a new one. */
  openTeamId: string | null;
  setOpenTeamId: Setter<string | null>;
  /** Tells the user an action could not be carried out in full (e.g. a species outside the catalog). */
  notice: string | null;
  setNotice: Setter<string | null>;
  /** What a saved team would keep, read from the session. */
  definition: TeamDefinition;
  /** Replaces what a saved team keeps; the event and the ticket stay. */
  load: (def: TeamDefinition, openTeamId: string | null) => void;
}

const EMPTY_MEALS: (MealInput | null)[] = [null, null, null];

const TeamSessionContext = createContext<TeamSession | null>(null);

export function TeamSessionProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [meals, setMeals] = useState<(MealInput | null)[]>(EMPTY_MEALS);
  const [dishType, setDishType] = useState<DishType | null>(null);
  const [selectedIsland, setSelectedIsland] = useState<string | null>(null);
  const [favoriteBerries, setFavoriteBerries] = useState<string[]>([]);
  const [mainFavorite, setMainFavorite] = useState<string | null>(null);
  const [weeklyBonus, setWeeklyBonus] = useState<WeeklyBonus>("berry_strength");
  const [goodCampTicket, setGoodCampTicket] = useState(false);
  // Preloaded with the event running now, if any (see currentEvent.ts).
  const [eventEffects, setEventEffects] = useState<EventEffect[]>(() =>
    presetEffects(CURRENT_EVENT, new Date(), newId),
  );
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const value = useMemo<TeamSession>(
    () => ({
      slots,
      setSlots,
      meals,
      setMeals,
      dishType,
      setDishType,
      selectedIsland,
      setSelectedIsland,
      favoriteBerries,
      setFavoriteBerries,
      mainFavorite,
      setMainFavorite,
      weeklyBonus,
      setWeeklyBonus,
      goodCampTicket,
      setGoodCampTicket,
      eventEffects,
      setEventEffects,
      openTeamId,
      setOpenTeamId,
      notice,
      setNotice,
      definition: {
        slots,
        meals,
        dishType,
        island: selectedIsland,
        favoriteBerries,
        mainFavorite,
        weeklyBonus,
      },
      load: (def, id) => {
        setSlots(def.slots);
        setMeals(def.meals);
        setDishType(def.dishType);
        setSelectedIsland(def.island);
        setFavoriteBerries(def.favoriteBerries);
        setMainFavorite(def.mainFavorite);
        setWeeklyBonus(def.weeklyBonus);
        setOpenTeamId(id);
      },
    }),
    [
      slots,
      meals,
      dishType,
      selectedIsland,
      favoriteBerries,
      mainFavorite,
      weeklyBonus,
      goodCampTicket,
      eventEffects,
      openTeamId,
      notice,
    ],
  );

  return <TeamSessionContext.Provider value={value}>{children}</TeamSessionContext.Provider>;
}

/** An empty definition: what "close the team" leaves. */
export const EMPTY_DEFINITION: TeamDefinition = {
  slots: [],
  meals: EMPTY_MEALS,
  dishType: null,
  island: null,
  favoriteBerries: [],
  mainFavorite: null,
  weeklyBonus: "berry_strength",
};

export function useTeamSession(): TeamSession {
  const ctx = useContext(TeamSessionContext);
  if (!ctx) throw new Error("useTeamSession must be used inside TeamSessionProvider");
  return ctx;
}
