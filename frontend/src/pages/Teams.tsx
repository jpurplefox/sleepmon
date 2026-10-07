import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type React from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { api } from "../api/client";
import { mapSummary } from "../mapSummary";
import { useAuth } from "../auth/AuthContext";
import { useGate } from "../auth/useGate";
import { berryIcon } from "../berries";
import { BerryRowStrength } from "../components/BerryRowStrength";
import { BoxPicker } from "../components/BoxPicker";
import { MemberForm } from "../components/MemberForm";
import { SettingsModal, type SettingsTab } from "../components/SettingsModal";
import { TeamContextBar } from "../components/TeamContextBar";
import { ToolHeader } from "../components/ToolHeader";
import { Modal } from "../components/Modal";
import { Placeholder } from "../components/Placeholder";
import { TeamSlotCard } from "../components/TeamSlotCard";
import { StrengthValue } from "../components/StrengthValue";
import { SnorlaxRatingBadge } from "../components/SnorlaxRatingBadge";
import {
  IconPackage,
  IconPot,
  IconSparkle,
} from "../components/icons";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { CURRENT_EVENT, presetEffects } from "../currentEvent";
import { toRequest as toEventRequest, type EventEffect } from "../eventBonus";
import { fdown, fup } from "../utils/format";
import { recipeImage } from "../recipes";
import { areaBonusOf, recipeLevelOf } from "../progress";
import { statIcon } from "../natures";
import {
  BERRY_JUICE_ICON,
  CHARGE_STRENGTH_ICON,
  GENERIC_CANDY_ICON,
  POT_EXPANSION_ICON,
} from "../skillIcons";
import { configFromMember, newEntry, newId } from "../roster";
import {
  MAX_TEAM,
  type Slot,
  addSlot,
  linkToBox,
  removeEntry,
  removeSlot,
  replaceConfig,
  setSplitShare,
  splitSlot,
  toRequest,
} from "../teamRoster";
import { useProgress } from "../useProgress";
import { useSessionOverrides } from "../useSessionOverrides";
import type {
  BerryRole,
  MealInput,
  Member,
  MemberInput,
  SkillEffectAgg,
  WeeklyBonus,
} from "../types";
import { useSaveToBox } from "../useSaveToBox";

// kind → { icon renderer, i18n label key } — mirrors ProductionCard's skill section.
// Used to render skill_effects rows in the aggregates card.
type SkillEffectMeta = {
  iconNode: () => React.ReactNode;
  labelKey: string;
  decimals?: boolean; // small per-day amounts (items) would floor to 0
};

function skillEffectMeta(kind: string): SkillEffectMeta {
  switch (kind) {
    case "strength":
      return {
        iconNode: () => <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt="" />,
        labelKey: "card.strength",
      };
    case "energy":
      return {
        iconNode: () => <img className="mini-icon" src={statIcon("Energy Recovery")} alt="" />,
        labelKey: "card.energyEach",
      };
    case "self_energy":
      return {
        iconNode: () => <img className="mini-icon" src={statIcon("Energy Recovery")} alt="" />,
        labelKey: "card.selfEnergy",
      };
    case "dream_shards":
      return {
        iconNode: () => <img className="mini-icon" src="/shard.png" alt="" />,
        labelKey: "card.dreamShards",
      };
    case "tasty_chance":
      return {
        iconNode: () => <img className="mini-icon" src="/extra-tasty.png" alt="" />,
        labelKey: "card.extraTasty",
      };
    case "random_energy":
      return {
        iconNode: () => <img className="mini-icon" src={statIcon("Energy Recovery")} alt="" />,
        labelKey: "card.randomEnergy",
      };
    case "ingredient_total":
      return {
        iconNode: () => <img className="mini-icon" src={statIcon("Ingredient Finding")} alt="" />,
        labelKey: "card.randomIngredients",
      };
    case "cooking_ingredients":
      return {
        iconNode: () => <img className="mini-icon" src={POT_EXPANSION_ICON} alt="" />,
        labelKey: "card.cookingExtra",
      };
    case "candy":
      return {
        iconNode: () => <img className="mini-icon mini-icon--candy" src={GENERIC_CANDY_ICON} alt="" />,
        labelKey: "card.candy",
        decimals: true,
      };
    case "berry_juice":
      return {
        iconNode: () => <img className="mini-icon" src={BERRY_JUICE_ICON} alt="" />,
        labelKey: "card.berryJuice",
        decimals: true,
      };
    default:
      return {
        iconNode: () => <IconSparkle />,
        labelKey: "card.skill",
      };
  }
}

const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;

// What the next config coming out of the form or the picker is for.
type Intent =
  | { kind: "add" }
  | { kind: "split"; slotIndex: number }
  | { kind: "edit"; slotIndex: number; entryIndex: number };

// Module level so the empty set is not re-created on every render.
const NO_MEMBERS_TAKEN: Set<string> = new Set();

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export function Teams() {
  const { t, ingredient: ingName, berry: berryName, type: typeName } = useI18n();

  const { status } = useAuth();
  const { guard } = useGate();
  const { save, statusOf, reset } = useSaveToBox();

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  // Reading the Box is reserved: only fetch it once signed in, so an anonymous
  // roster makes no /team request (and takes no 401).
  const members = useQuery({
    queryKey: ["members"],
    queryFn: api.listMembers,
    enabled: status === "authenticated",
  });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: api.getRecipes });

  // The roster: ordered slots of configs the tool owns. Ephemeral.
  const [slots, setSlots] = useState<Slot[]>([]);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [modal, setModal] = useState<"form" | "box" | null>(null);
  // Tells the user an action could not be carried out (e.g. a species outside
  // the catalog).
  const [notice, setNotice] = useState<string | null>(null);
  const [meals, setMeals] = useState<(MealInput | null)[]>([null, null, null]);
  // Which Settings tab is open, or null: the context bar and the Cooking card each open theirs.
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [goodCampTicket, setGoodCampTicket] = useState(false);
  // Preloaded with the event running now, if any (see currentEvent.ts).
  const [eventEffects, setEventEffects] = useState<EventEffect[]>(() =>
    presetEffects(CURRENT_EVENT, new Date(), newId),
  );

  // Dish type: restricts all 3 meal slots to the same recipe type (ephemeral, frontend-only).
  const [dishType, setDishType] = useState<'Curry' | 'Salad' | 'Dessert' | null>(null);

  // Island state (efímero, como meals).
  const [selectedIsland, setSelectedIsland] = useState<string | null>(null);
  const [favoriteBerries, setFavoriteBerries] = useState<string[]>([]);
  const [mainFavorite, setMainFavorite] = useState<string | null>(null);
  const [weeklyBonus, setWeeklyBonus] = useState<WeeklyBonus>("berry_strength");

  const { progress, save: saveProgress, saveError: progressSaveError } = useProgress();

  // Session-only edits, layered over the saved progress. Everything shown is
  // derived: override ?? saved ?? default, so there is no window where local
  // state and the query disagree.
  const {
    potSize,
    areaBonusPct,
    recipeLevelFor,
    potUnsaved,
    areaBonusUnsaved,
    recipeLevelUnsaved,
    setPotOverride,
    setAreaBonusOverride,
    setRecipeLevelOverride,
  } = useSessionOverrides(progress, selectedIsland);

  // Percentage points in progress; the payload and the cards want a 0–0.85 fraction.
  const islandBonus = areaBonusPct / 100;

  // The saved area bonus for the currently selected island, in percentage points.
  const savedBonusPct = areaBonusOf(progress, selectedIsland);

  const savedLevelFor = (name: string): number => recipeLevelOf(progress, name);

  const savePot = () => saveProgress({ pot_size: potSize });
  const saveBonus = () => {
    if (selectedIsland === null) return;
    saveProgress({ area_bonuses: { [selectedIsland]: areaBonusPct } });
  };
  const saveLevel = (name: string) =>
    saveProgress({ recipe_levels: { [name]: recipeLevelFor(name) } });


  // Set de bayas favoritas activas para lookup O(1) al renderizar las cards.
  const favBerrySet = useMemo(
    () => new Set(favoriteBerries.filter(Boolean)),
    [favoriteBerries],
  );

  // Bayas que realmente enviar al backend: filtrar strings vacíos (slots no elegidos).
  const activeBerries = favoriteBerries.filter(Boolean);

  // Expert mode is derived from the selected island's own flag, not sent by the client.
  const island = catalog.data?.islands.find((i) => i.name === selectedIsland) ?? null;
  const isExpert = island?.expert ?? false;
  const map = mapSummary({
    island: selectedIsland,
    berries: activeBerries,
    mainFavorite,
    expert: isExpert,
    areaBonusPct,
  });

  // Role of a berry relative to the map: drives the card's state and marks.
  const berryRoleOf = (berry: string): BerryRole => {
    if (isExpert && berry === mainFavorite) return "main";
    if (favBerrySet.has(berry)) return "sub";
    return "none";
  };

  // What actually goes on the wire, not the slot objects themselves: linking a
  // newly saved entry to its Box id rewrites the slot objects (a new identity)
  // without changing this, so keying on it avoids an identical, wasted refetch.
  const teamRequestSlots = useMemo(() => toRequest(slots), [slots]);

  const teamQuery = useQuery({
    queryKey: [
      "team-production",
      teamRequestSlots,
      meals,
      activeBerries,
      selectedIsland,
      mainFavorite,
      weeklyBonus,
      islandBonus,
      goodCampTicket,
      eventEffects,
      potSize,
    ],
    queryFn: () =>
      api.computeTeamProduction({
        slots: teamRequestSlots,
        meals,
        favorite_berries: activeBerries,
        island: selectedIsland,
        main_favorite: mainFavorite,
        weekly_bonus: weeklyBonus,
        island_bonus: islandBonus,
        good_camp_ticket: goodCampTicket,
        event_effects: toEventRequest(eventEffects),
        pot_size: potSize,
      }),
    enabled: slots.length > 0,
    placeholderData: keepPreviousData,
    // A rejected config is a deterministic 400: retrying only delays the message.
    retry: false,
  });

  // Everything renders daily; the totals card shows daily + ×7 on its own.
  const factor = 1;
  const result = teamQuery.data;
  // A placeholder result is for the previous config, so its pot would be stale.
  const potKnown = result !== undefined && !teamQuery.isPlaceholderData;
  const eventPot = eventEffects.some((e) => e.kind === "pot_size");

  // Lookup map: recipe name → Recipe, for the ingredient count in plan row labels.
  const recipeByName = useMemo(
    () => new Map((recipes.data ?? []).map((r) => [r.name, r])),
    [recipes.data],
  );

  // Positional map: slot index (0/1/2) → MealFeasibility entry.
  // cooking_meals contains exactly the non-null meals in slot order; map each
  // non-null slot i to cooking_meals[k] where k is the count of non-null slots
  // before i. This handles duplicate recipes correctly (each slot gets its own
  // greedy-allocated entry instead of all sharing the same name-keyed entry).
  const feasibilityBySlot = useMemo(() => {
    const cookingMeals = result?.cooking_meals ?? [];
    const map = new Map<number, (typeof cookingMeals)[number]>();
    let k = 0;
    for (let i = 0; i < meals.length; i++) {
      if (meals[i] != null) {
        if (k < cookingMeals.length) map.set(i, cookingMeals[k]);
        k++;
      }
    }
    return map;
  }, [result, meals]);

  const atMax = slots.length >= MAX_TEAM;

  const openForm = (next: Intent) => {
    setNotice(null);
    setIntent(next);
    setModal("form");
  };
  const openBox = (next: Intent) => {
    setNotice(null);
    setIntent(next);
    setModal("box");
  };
  const closeModal = () => {
    setNotice(null);
    setModal(null);
    setIntent(null);
  };

  // Applies a config according to the pending intent.
  const applyConfig = (config: MemberInput, sourceId?: string) => {
    if (!intent) return;
    if (intent.kind === "edit") {
      // Editing replaces the config but not the id, so a stale save status
      // (saved or errored) would otherwise survive describing a config that
      // was never submitted.
      const editedId = slots[intent.slotIndex]?.entries[intent.entryIndex]?.id;
      if (editedId) reset(editedId);
    }
    setSlots((prev) => {
      if (intent.kind === "add") return addSlot(prev, newEntry(config, sourceId));
      if (intent.kind === "split")
        return splitSlot(prev, intent.slotIndex, newEntry(config, sourceId));
      return replaceConfig(prev, intent.slotIndex, intent.entryIndex, config);
    });
    setNotice(null);
    closeModal();
  };

  const pickMember = (m: Member) => {
    // The page early-returns while the catalog loads, so this is only defensive.
    if (!catalog.data) return;
    const config = configFromMember(catalog.data, m);
    if (!config) {
      // Its ingredient slots are unknown, so no valid config exists: say so where
      // the decision is made instead of leaving a hole in the team. Close the
      // modal directly (not via closeModal) so the refusal notice survives —
      // closeModal also clears the notice, which would erase this one.
      setNotice(t("prod.speciesNotInCatalog", { species: m.species }));
      setModal(null);
      setIntent(null);
      return;
    }
    applyConfig(config, m.id);
  };

  const saveEntryToBox = (slotIndex: number, entryIndex: number) => {
    const entry = slots[slotIndex].entries[entryIndex];
    save(entry, (memberId) => setSlots((prev) => linkToBox(prev, entry.id, memberId)));
  };

  // Dish type is a setup choice about the day, chosen on the Map tab (PRD
  // 0006). This is just the raw state setter — SettingsModal.pickDishType
  // wraps it with the favorite-replace/empty behavior before it fires.
  const handleDishTypeChange = (newType: 'Curry' | 'Salad' | 'Dessert' | null) => {
    setDishType(newType);
  };

  // Catalog must be loaded for BoxPicker to work.
  if (catalog.isLoading) return <Placeholder loading>{t("common.loadingCatalog")}</Placeholder>;
  if (catalog.isError || !catalog.data)
    return (
      <p className="error" role="alert">
        {t("common.catalogError")}{" "}
        <button type="button" className="btn btn--ghost" onClick={() => catalog.refetch()}>
          {t("common.retry")}
        </button>
      </p>
    );

  return (
    <div className="layout layout--wide">
      <ToolHeader title={t("teams.title")} notice={notice}>
        <TeamContextBar
          map={map}
          eventEffects={eventEffects}
          goodCampTicket={goodCampTicket}
          onGoodCampTicket={setGoodCampTicket}
          onOpenSettings={setSettingsTab}
        />
      </ToolHeader>

      {/* ── Per-slot cards ── */}
      <div className="prod-cards prod-cards--compact">
        {slots.map((slot, i) => {
          const teamHasSplit = slots.some((s) => s.entries.length === 2);
          return (
            <TeamSlotCard
              key={slot.entries.map((e) => e.id).join("+")}
              slot={slot}
              slotIndex={i}
              catalog={catalog.data}
              contributions={result?.members}
              berryRoleOf={berryRoleOf}
              expert={isExpert}
              expertSpeed={island?.expert_speed ?? null}
              weeklyBonus={weeklyBonus}
              teamHasSplit={teamHasSplit}
              saveStatus={statusOf}
              onAddNew={(idx) => openForm({ kind: "split", slotIndex: idx })}
              onAddFromBox={(idx) => guard(() => openBox({ kind: "split", slotIndex: idx }))}
              onEdit={(si, ei) => openForm({ kind: "edit", slotIndex: si, entryIndex: ei })}
              onSaveToBox={(si, ei) => guard(() => saveEntryToBox(si, ei))}
              onRemoveSlot={(idx) => setSlots((prev) => removeSlot(prev, idx))}
              onRemoveEntry={(si, ei) => setSlots((prev) => removeEntry(prev, si, ei))}
              onWeightChange={(idx, pctA) => setSlots((prev) => setSplitShare(prev, idx, pctA))}
            />
          );
        })}

        {/* Trailing "add" slot — hidden once the team is full (max is obvious). */}
        {!atMax && (
          <div className="prod-card-cell">
            <div className="prod-card__toolbar prod-card__toolbar--empty" aria-hidden="true" />
            <article className="prod-card prod-card--add">
              {slots.length === 0 ? (
                <div className="prod-add__hint">
                  <p className="prod-add__lead">{t("teams.emptyLead")}</p>
                  <p className="muted">{t("teams.emptyBody")}</p>
                </div>
              ) : (
                <p className="muted prod-add__hint">{t("teams.addHintMore")}</p>
              )}
              <div className="prod-add__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => openForm({ kind: "add" })}
                >
                  {t("prod.new")}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => guard(() => openBox({ kind: "add" }))}
                >
                  {t("prod.myPokemon")}
                </button>
              </div>
            </article>
          </div>
        )}
      </div>

      {/* ── Loading / error states for the team query ── */}
      {slots.length > 0 && teamQuery.isLoading && (
        <Placeholder loading>{t("teams.calculating")}</Placeholder>
      )}
      {slots.length > 0 && teamQuery.isError && (
        <p className="error" role="alert" style={{ marginTop: "1.5rem" }}>
          {(teamQuery.error as Error | null)?.message || t("teams.teamError")}{" "}
          <button type="button" className="btn btn--ghost" onClick={() => teamQuery.refetch()}>
            {t("common.retry")}
          </button>
        </p>
      )}

      {/* ── Aggregates + cooking (only when we have data) ── */}
      {result && (
        <>
          <div className="teams-aggregates">

            {/* Right column: berries & skills card + member ranking card, stacked */}
            <div className="teams-aggregates__right">
            {/* Berries & skills card — mirrors the Cocina card hierarchy:
                components → subtotal → grand total at the bottom. */}
            <div className="card teams-aggregates__berries">
              <div className="prod-card__block-head">{t("teams.berriesSkills")}</div>

              {/* ── Berries block ── */}
              <div className="cook-result-block">
                <div className="prod-card__block-head">{t("teams.berries")}</div>
                {result.berries.length > 0 && (
                  <ul className="teams-berry-list">
                    {result.berries.map((row) => (
                      <li key={row.berry} className="teams-berry-row">
                        <span className="teams-berry-row__name">
                          <img
                            className="mini-icon"
                            src={berryIcon(row.berry)}
                            alt={berryName(row.berry)}
                            title={berryName(row.berry)}
                          />
                          <span>{berryName(row.berry)}</span>
                        </span>
                        <span className="teams-berry-row__amount muted">
                          ×{fdown(row.amount * factor)}
                        </span>
                        <span className="teams-berry-row__strength">
                          <img
                            className="mini-icon"
                            src={CHARGE_STRENGTH_ICON}
                            alt=""
                            style={{ width: 14, height: 14 }}
                          />{" "}
                          <BerryRowStrength row={row} bonus={islandBonus} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Berries strength subtotal — same treatment as the cooking
                    "Fuerza de recetas" subtotal. */}
                <div className="cook-result-row cook-result-row--strength">
                  <span className="cook-result-row__label muted">
                    {t("teams.berryStrength")}
                  </span>
                  <span className="cook-result-row__value">
                    <img
                      className="mini-icon"
                      src={CHARGE_STRENGTH_ICON}
                      alt=""
                      style={{ width: 16, height: 16 }}
                    />
                    <StrengthValue
                      value={result.total_berry_strength * factor}
                      base={result.total_berry_strength_base * factor}
                      bonus={islandBonus}
                    />
                  </span>
                </div>
              </div>

              {/* ── Skill block — always shown, even at 0 strength / 0 triggers. ── */}
              {(() => {
                const strengthEffect = result.skill_effects.find(
                  (e: SkillEffectAgg) => e.kind === "strength",
                );
                const triggers = (strengthEffect?.triggers ?? 0) * factor;
                return (
                  <div className="cook-result-block">
                    <div className="prod-card__block-head">{t("card.skill")}</div>
                    <div className="cook-result-row">
                      <span
                        className="cook-result-row__label"
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                      >
                        <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt="" />
                        {t("card.skill")}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.15rem", fontSize: "var(--text-xs)" }}>
                          (<IconSparkle width={11} height={11} />
                          {triggers.toFixed(2)})
                        </span>
                      </span>
                      <span className="cook-result-row__value" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <img
                          className="mini-icon"
                          src={CHARGE_STRENGTH_ICON}
                          alt=""
                          style={{ width: 14, height: 14 }}
                        />
                        <StrengthValue
                          value={result.total_skill_strength * factor}
                          base={result.total_skill_strength_base * factor}
                          bonus={islandBonus}
                        />
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* ── Card total (berries + skill) — neutral, like "Total cocina".
                  Rendered without a cook-result-block wrapper: the grand row
                  already draws its own divider, so wrapping it would stack two
                  grey rules before the total. ── */}
              <div className="cook-total-row cook-total-row--grand">
                <span className="cook-total-row__label">{t("teams.total")}</span>
                <span className="cook-total-row__value">
                  <img
                    className="mini-icon"
                    src={CHARGE_STRENGTH_ICON}
                    alt=""
                    style={{ width: 16, height: 16 }}
                  />
                  <StrengthValue
                    value={result.total_strength * factor}
                    base={result.total_strength_base * factor}
                    bonus={islandBonus}
                  />
                </span>
              </div>
            </div>

            {/* ── Other skills card: skill_effects that don't add to total strength ── */}
            {(() => {
              const otherSkills = result.skill_effects.filter(
                (e: SkillEffectAgg) =>
                  e.kind !== "strength" &&
                  e.kind !== "cooking_ingredients" &&
                  e.kind !== "ingredient_total" &&
                  // Extra Tasty ya se muestra (chance + multiplicador) en la card de Cocina.
                  e.kind !== "tasty_chance",
              );
              if (otherSkills.length === 0) return null;
              return (
                <div className="card">
                  <div
                    className="prod-card__block-head"
                    style={{ marginBottom: "0.75rem" }}
                  >
                    {t("teams.otherSkills")}
                  </div>
                  <div className="teams-other-skills">
                    {otherSkills.map((e: SkillEffectAgg) => {
                      const meta = skillEffectMeta(e.kind);
                      const total = e.total * factor;
                      const triggers = e.triggers * factor;
                      const label = t(meta.labelKey);
                      return (
                        <div key={e.kind} className="prod-card__line">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            {meta.iconNode()}
                            <span>
                              {`${meta.decimals ? total.toFixed(2) : fdown(total)} ${label}`}
                            </span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.15rem", fontSize: "var(--text-xs)" }}>
                              (<IconSparkle width={11} height={11} style={{ opacity: 0.75 }} />
                              {triggers.toFixed(2)})
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Strength breakdown: proportion of the 4 strength sources ── */}
            {(() => {
              const pieData = [
                { key: "berries", name: t("teams.berries"), value: result.total_berry_strength * factor, color: "#6366f1" },
                { key: "skills", name: t("card.skill"), value: result.total_skill_strength * factor, color: "#38bdf8" },
                { key: "recipes", name: t("teams.recipes"), value: result.kitchen.recipe_strength, color: "#c084fc" },
                { key: "fillers", name: t("teams.fillersLabel"), value: result.kitchen.filler_strength, color: "#94a3b8" },
                { key: "extraTasty", name: t("teams.extraTasty"), value: result.kitchen.extra_tasty_bonus, color: "#e3b341" },
              ].filter((d) => d.value > 0);
              const totalValue = pieData.reduce((s, d) => s + d.value, 0);
              if (totalValue <= 0) return null;
              return (
                <div className="card teams-breakdown-card">
                  <div className="prod-card__block-head">{t("teams.strengthBreakdown")}</div>
                  <div className="teams-breakdown-chart">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                          stroke="var(--surface)"
                        >
                          {pieData.map((d) => (
                            <Cell key={d.key} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            `${fdown(value)} (${((value / totalValue) * 100).toFixed(1)}%)`,
                            name,
                          ]}
                          contentStyle={{
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            color: "var(--text)",
                            fontSize: "var(--text-sm)",
                          }}
                          itemStyle={{ color: "var(--text)" }}
                          labelStyle={{ color: "var(--text)" }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value: string) => (
                            <span style={{ color: "var(--text)", fontSize: "var(--text-xs)" }}>{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}
            </div>

            {/* Cooking card */}
            <div className="card teams-aggregates__cooking">
              <div className="teams-cooking-head">
                <h2 style={{ margin: 0 }}>{t("teams.cooking")}</h2>
                <button type="button" className="btn btn--ghost" onClick={() => setSettingsTab("meals")}>
                  {t("teams.editRecipes")}
                </button>
              </div>

              {/* Compact plan summary: one row per moment */}
              <div className="teams-plan-rows">
                {MEAL_SLOTS.map((slot, idx) => {
                  const meal = meals[idx];
                  const feasibility = meal ? feasibilityBySlot.get(idx) : undefined;

                  const recipeData = meal ? recipeByName.get(meal.recipe) : undefined;
                  const recipeIngs = recipeData
                    ? recipeData.ingredients.reduce((s, ic) => s + ic.count, 0)
                    : 0;
                  const exceedsPot = feasibility != null && !feasibility.fits_pot;

                  return (
                    <div key={slot} className="teams-plan-row">
                      <span className="teams-plan-row__label muted">
                        {t(`teams.${slot}`)}
                      </span>
                      {meal ? (
                        <div className="cook-row__body">
                          <div className="cook-row__topline">
                            <img
                              className="teams-plan-row__thumb"
                              src={recipeImage(meal.recipe)}
                              alt=""
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                            <span className="teams-plan-row__name">{meal.recipe}</span>
                            <span className="teams-plan-row__lv muted">Lv.{meal.level}</span>
                            {feasibility != null && (
                              <span className="cook-row__strength cook-row__strength--right">
                                <img
                                  className="mini-icon"
                                  src={CHARGE_STRENGTH_ICON}
                                  alt=""
                                  style={{ width: 14, height: 14 }}
                                />
                                {fmtInt(feasibility.strength)}
                              </span>
                            )}
                          </div>
                          {exceedsPot && (
                            <span
                              className="teams-plan-row__pot-warn"
                              title={t("teams.potTooSmall")}
                            >
                              <img
                                src="/pot.webp"
                                alt=""
                                className="mini-icon"
                                style={{ width: 14, height: 14 }}
                              />
                              {t("teams.potTooSmall")} ({recipeIngs}/{result.kitchen.pot.per_meal})
                            </span>
                          )}
                          {feasibility != null && feasibility.ingredients.length > 0 && (
                            <div className="cook-row__ings">
                              {feasibility.ingredients.map((ing) => {
                                const ok = ing.available >= ing.required;
                                return (
                                  <span
                                    key={ing.ingredient}
                                    className={`cook-ing-chip ${ok ? "cook-ing-chip--ok" : "cook-ing-chip--short"}`}
                                    title={ingName(ing.ingredient)}
                                  >
                                    <img
                                      className="mini-icon"
                                      src={ingredientIcon(ing.ingredient)}
                                      alt={ingName(ing.ingredient)}
                                      style={{ width: 16, height: 16 }}
                                    />
                                    {Math.floor(ing.available)}/{Math.floor(ing.required)}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: "var(--text-sm)" }}>
                          {t("common.dash")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── RESULTS AREA (4 blocks) ─────────────────────────────── */}
              {(() => {
                const k = result.kitchen;

                // ── Cooking skill effect entry ─────────────────────────────
                const cookingSkillEffect = result.skill_effects.find(
                  (e: SkillEffectAgg) => e.kind === "cooking_ingredients",
                );
                // Random-ingredients skill effect (Ingredient Magnet) — its
                // triggers are shown on the random filler row.
                const randomSkillEffect = result.skill_effects.find(
                  (e: SkillEffectAgg) => e.kind === "ingredient_total",
                );

                return (
                  <>
                    {/* Block 1 — Recipes strength */}
                    <div className="cook-result-block">
                      <div className="cook-result-row cook-result-row--strength">
                        <span className="cook-result-row__label muted">
                          {t("teams.cookingStrength")}
                        </span>
                        <span className="cook-result-row__value">
                          <img
                            className="mini-icon"
                            src={CHARGE_STRENGTH_ICON}
                            alt=""
                            style={{ width: 16, height: 16 }}
                          />
                          <StrengthValue
                            value={k.recipe_strength}
                            base={k.recipe_strength_base}
                            bonus={islandBonus}
                          />
                        </span>
                      </div>
                    </div>

                    {/* Block 2 — Missing ingredients (before pot capacity, per spec) */}
                    {result.cooking_ingredients.filter((b) => b.balance < 0).length > 0 && (
                      <div className="cook-result-block" style={{ borderTopColor: "var(--down)" }}>
                        <div
                          className="prod-card__block-head"
                          style={{ color: "var(--down)" }}
                        >
                          {t("teams.missing")}
                        </div>
                        <ul className="prod-card__ings">
                          {result.cooking_ingredients
                            .filter((b) => b.balance < 0)
                            .map((b) => (
                              <li key={b.ingredient} style={{ justifyContent: "space-between" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                                  <img
                                    className="mini-icon"
                                    src={ingredientIcon(b.ingredient)}
                                    alt={ingName(b.ingredient)}
                                    title={ingName(b.ingredient)}
                                    style={{ width: 20, height: 20 }}
                                  />
                                  <span>{ingName(b.ingredient)}</span>
                                </span>
                                <span style={{ color: "var(--down)", fontWeight: 700, fontSize: "var(--text-sm)" }}>
                                  {t("teams.missingAmt", { n: fup(Math.abs(b.balance) * factor) })}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {/* Block 3 — Pot capacity table */}
                    <div className="cook-result-block">
                      <div className="prod-card__block-head">{t("teams.potCapacity")}</div>
                      <ul className="cook-cap-table">
                        {/* Base */}
                        <li className="cook-cap-row">
                          <span className="cook-cap-row__label">
                            <IconPot width={14} height={14} />
                            {t("teams.potBase")}
                            <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                              &thinsp;×3
                            </span>
                          </span>
                          <span className="cook-cap-row__value">{k.pot.base_daily}</span>
                        </li>
                        {/* Skill expansion — only if >0 */}
                        {k.pot.skill_daily > 0 && cookingSkillEffect && (
                          <li className="cook-cap-row">
                            <span className="cook-cap-row__label">
                              <img
                                className="mini-icon"
                                src={POT_EXPANSION_ICON}
                                alt=""
                                style={{ width: 14, height: 14 }}
                              />
                              {t("teams.potSkill")}
                              <span className="muted" style={{ fontSize: "var(--text-xs)", display: "inline-flex", alignItems: "center", gap: "0.15rem" }}>
                                &ensp;(<IconSparkle width={11} height={11} />{(cookingSkillEffect.triggers * factor).toFixed(2)})
                              </span>
                            </span>
                            <span className="cook-cap-row__value">+{fdown(k.pot.skill_daily)}</span>
                          </li>
                        )}
                        {/* Ticket and/or event pot bonus */}
                        {k.pot.bonus_daily > 0 && (
                          <li className="cook-cap-row">
                            <span className="cook-cap-row__label">
                              <img src="/pot.webp" alt="" className="mini-icon" style={{ width: 14, height: 14 }} />
                              {eventPot
                                ? goodCampTicket
                                  ? t("event.potRowBoth")
                                  : t("event.potRow")
                                : t("teams.potGct")}
                            </span>
                            <span className="cook-cap-row__value">+{fdown(k.pot.bonus_daily)}</span>
                          </li>
                        )}
                        {/* Used by recipes */}
                        <li className="cook-cap-row">
                          <span className="cook-cap-row__label">
                            <img src="/pot.webp" alt="" className="mini-icon" style={{ width: 14, height: 14 }} />
                            {t("teams.usedByRecipes")}
                          </span>
                          <span className="cook-cap-row__value">−{fdown(k.pot.used_by_recipes)}</span>
                        </li>
                        {/* Fillers total row */}
                        <li className="cook-cap-row cook-cap-row--total">
                          <span className="cook-cap-row__label">
                            {t("teams.fillersLabel")}
                          </span>
                          <span className="cook-cap-row__value">{fdown(k.pot.filler_room)}</span>
                        </li>
                      </ul>
                    </div>

                    {/* Block 4 — Fillers (slot-based allocation: base strength + X/Y chip + contributed strength) */}
                    {k.fillers.length > 0 && (
                      <div className="cook-result-block">
                        <div className="prod-card__block-head">
                          {t("teams.fillersLabel")}
                        </div>
                        <ul className="cook-filler-list">
                          {k.fillers.map((f) => {
                            const key = f.ingredient ?? "__random__";
                            const isRandom = f.ingredient === null;
                            const label = f.ingredient === null ? t("teams.randomIngredients") : ingName(f.ingredient);
                            const isUsed = f.used > 0;
                            const usedFloor = Math.floor(f.used);
                            const availFloor = Math.floor(f.available);
                            const tip = isRandom ? t("teams.randomIngredientsTip") : undefined;
                            return (
                              <li
                                key={key}
                                className="cook-filler-item cook-filler-item--rich"
                                title={tip}
                              >
                                <span className="cook-filler-item__info">
                                  {f.ingredient === null ? (
                                    <IconPackage
                                      width={18}
                                      height={18}
                                      style={{ color: "var(--muted)" }}
                                    />
                                  ) : (
                                    <img
                                      className="mini-icon"
                                      src={ingredientIcon(f.ingredient)}
                                      alt={label}
                                      title={label}
                                      style={{ width: 18, height: 18 }}
                                    />
                                  )}
                                  <span>{label}</span>
                                  {isRandom && randomSkillEffect && (
                                    <span
                                      className="muted"
                                      style={{ display: "inline-flex", alignItems: "center", gap: "0.15rem", fontSize: "var(--text-xs)" }}
                                    >
                                      (<IconSparkle width={11} height={11} />
                                      {(randomSkillEffect.triggers * factor).toFixed(2)})
                                    </span>
                                  )}
                                  <span className="cook-filler-item__base-strength muted">
                                    {Math.round(f.strength)}
                                  </span>
                                </span>
                                <span className="cook-filler-item__right">
                                  <span
                                    className={`cook-ing-chip ${isUsed ? "cook-ing-chip--ok" : "cook-ing-chip--dim"}`}
                                  >
                                    {usedFloor}/{availFloor}
                                  </span>
                                  {isUsed && (
                                    <span className="cook-filler-item__contrib">
                                      <img
                                        className="mini-icon"
                                        src={CHARGE_STRENGTH_ICON}
                                        alt=""
                                        style={{ width: 13, height: 13 }}
                                      />
                                      {fdown(f.contributed)}
                                    </span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        {/* Fillers strength subtotal — same visual hierarchy as
                            the recipes strength subtotal (Block 1). Peers. */}
                        <div className="cook-result-row cook-result-row--strength">
                          <span className="cook-result-row__label muted">
                            {t("teams.fillersStrength")}
                          </span>
                          <span className="cook-result-row__value">
                            <img
                              className="mini-icon"
                              src={CHARGE_STRENGTH_ICON}
                              alt=""
                              style={{ width: 16, height: 16 }}
                            />
                            <StrengthValue
                              value={k.filler_strength}
                              base={k.filler_strength_base}
                              bonus={islandBonus}
                            />
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Block 5 — Grand total con el Extra Tasty esperado del equipo */}
                    {(() => {
                      const extraTastyPct = (result.extra_tasty_rate * 100).toFixed(1);
                      const extraTastyMult = result.extra_tasty_multiplier.toFixed(2);
                      return (
                        <div className="cook-result-block">
                          <div className="cook-total-row">
                            <span className="cook-total-row__label">
                              {t("teams.recipes")}
                            </span>
                            <span className="cook-total-row__value">
                              {fdown(k.recipe_strength)}
                            </span>
                          </div>
                          <div className="cook-total-row">
                            <span className="cook-total-row__label">
                              {t("teams.fillersLabel")}
                            </span>
                            <span className="cook-total-row__value">
                              {fdown(k.filler_strength)}
                            </span>
                          </div>
                          <div className="cook-total-row">
                            <span
                              className="cook-total-row__label"
                              style={{ cursor: "help" }}
                              title={t("teams.extraTastyTooltip")}
                            >
                              <img
                                className="mini-icon"
                                src="/extra-tasty.png"
                                alt=""
                                style={{ width: 14, height: 14 }}
                              />
                              {t("teams.extraTasty")} {extraTastyPct}% · ×{extraTastyMult}
                            </span>
                            <span className="cook-total-row__value">
                              +{fdown(k.extra_tasty_bonus)}
                            </span>
                          </div>
                          <div className="cook-total-row cook-total-row--grand">
                            <span className="cook-total-row__label">
                              {t("teams.cookingTotal")}
                            </span>
                            <span className="cook-total-row__value">
                              <img
                                className="mini-icon"
                                src={CHARGE_STRENGTH_ICON}
                                alt=""
                                style={{ width: 16, height: 16 }}
                              />
                              <StrengthValue
                                value={k.total}
                                base={k.total_base}
                                bonus={islandBonus}
                              />
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          </div>

          {/* ── TEAM TOTALS card — the page's headline KPI (daily + weekly, always) ──
          Tooltip rule: StrengthValue (base/Area bonus breakdown) appears on ALL
          subtotals and totals that receive Area bonus — berries subtotal, skills
          subtotal, total berries+skills card, recipes subtotal, fillers
          subtotal, cooking grand total, totals-card cooking col, totals-card
          grand total. NEVER on per-berry/per-recipe/per-filler rows, the
          "Recetas"/"Fillers" repeat lines in Block 5, or the +10% extra tasty line.
          When bonus=0 or floor(base)===floor(value) → no tooltip rendered (identity, no visual change). ── */}
          <div className="card teams-totals">
            {/* Col 1 — Berries & skills */}
            <div className="teams-totals__col">
              <span className="teams-totals__label">{t("teams.berriesSkills")}</span>
              <span className="teams-totals__kpi">
                <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt="" style={{ width: 18, height: 18 }} />
                <StrengthValue
                  value={result.total_strength}
                  base={result.total_strength_base}
                  bonus={islandBonus}
                />
              </span>
              <span className="teams-totals__aside">
                ×7 {fdown(result.total_strength * 7)}
              </span>
            </div>

            <span className="teams-totals__divider" aria-hidden="true" />

            {/* Col 2 — Cooking */}
            <div className="teams-totals__col">
              <span className="teams-totals__label">{t("teams.cooking")}</span>
              <span className="teams-totals__kpi">
                <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt="" style={{ width: 18, height: 18 }} />
                <StrengthValue
                  value={result.kitchen.total}
                  base={result.kitchen.total_base}
                  bonus={islandBonus}
                />
              </span>
              <span className="teams-totals__aside">
                ×7 {fdown(result.kitchen.total * 7)}
              </span>
            </div>

            <span className="teams-totals__divider" aria-hidden="true" />

            {/* Col 3 — Grand total (biggest number on the page) */}
            <div className="teams-totals__col teams-totals__col--grand">
              <span className="teams-totals__label">{t("teams.grandTotal")}</span>
              <span className="teams-totals__kpi teams-totals__kpi--grand">
                <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt="" style={{ width: 22, height: 22 }} />
                <StrengthValue
                  value={result.grand_total_strength}
                  base={result.grand_total_strength_base}
                  bonus={islandBonus}
                />
              </span>
              <span className="teams-totals__aside">
                ×7 {fdown(result.grand_total_strength * 7)}
              </span>
              {selectedIsland &&
                (() => {
                  const isl = catalog.data.islands.find((i) => i.name === selectedIsland);
                  if (!isl) return null;
                  return (
                    <SnorlaxRatingBadge
                      weeklyStrength={result.grand_total_strength * 7}
                      ratings={isl.ratings}
                      islandName={selectedIsland}
                    />
                  );
                })()}
            </div>
          </div>
        </>
      )}

      {/* Form modal — create a config on the spot, or edit one already in the roster.
          The intent's slotIndex/entryIndex are resolved once, up front, with optional
          chaining: the indices are safe today (the modal traps focus and covers the
          roster, and the sign-in dialog that could replay a guarded action is modal
          too, so slots can't shift under an open form) but a broken invariant should
          be a no-op render, not a crash. Saves deliberately use ids instead, since
          those stay valid across reorders. */}
      {modal === "form" && intent !== null && (() => {
        const editingEntry =
          intent.kind === "edit" ? slots[intent.slotIndex]?.entries[intent.entryIndex] : undefined;
        if (intent.kind === "edit" && !editingEntry) return null;
        return (
          <Modal
            title={intent.kind === "edit" ? t("team.modalEdit") : t("team.modalAdd")}
            onClose={closeModal}
          >
            <MemberForm
              catalog={catalog.data}
              pending={false}
              error={null}
              submitLabel={intent.kind === "edit" ? t("prod.save") : t("teams.addToTeam")}
              initial={intent.kind === "edit" ? editingEntry?.config : undefined}
              onSubmit={(config) => applyConfig(config)}
              footer={
                intent.kind !== "edit" ? (
                  <p className="muted">{t("prod.noteNew")}</p>
                ) : editingEntry?.sourceId !== undefined ? (
                  <p className="muted">{t("teams.noteEditInBox")}</p>
                ) : (
                  <p className="muted">{t("teams.noteEditLocal")}</p>
                )
              }
            />
          </Modal>
        );
      })()}

      {/* BoxPicker modal — same pattern as Production.tsx */}
      {modal === "box" && (
        <Modal
          title={
            intent?.kind === "split" ? t("teams.pickSplitPartner") : t("teams.pickFromBox")
          }
          onClose={closeModal}
        >
          <BoxPicker
            members={members.data}
            isLoading={members.isLoading}
            isError={members.isError}
            onRetry={() => members.refetch()}
            catalog={catalog.data}
            // Duplicates are allowed now, so nothing is marked as taken.
            inComparison={NO_MEMBERS_TAKEN}
            onPick={pickMember}
          />
        </Modal>
      )}

      {/* SettingsModal */}
      {settingsTab !== null && (
        <SettingsModal
          key={settingsTab}
          initialTab={settingsTab}
          recipes={recipes.data ?? []}
          levelBonus={catalog.data.recipe_level_bonus}
          meals={meals}
          onChangeMeals={setMeals}
          onClose={() => setSettingsTab(null)}
          potSize={potSize}
          onPotSizeChange={(n) => setPotOverride(n)}
          effectivePot={potKnown ? result.kitchen.pot.per_meal : null}
          skillPerMeal={potKnown ? result.kitchen.pot.skill_per_meal : null}
          eventEffects={eventEffects}
          onEventEffects={setEventEffects}
          eventTypes={[...new Set(catalog.data.species.map((s) => s.type))].sort((a, b) =>
            typeName(a).localeCompare(typeName(b)),
          )}
          catalog={catalog.data}
          selectedIsland={selectedIsland}
          favoriteBerries={favoriteBerries}
          islandBonus={islandBonus}
          bonusDisabled={selectedIsland === null}
          mainFavorite={mainFavorite}
          weeklyBonus={weeklyBonus}
          onSelectIsland={setSelectedIsland}
          onFavoriteBerries={setFavoriteBerries}
          onIslandBonus={(fraction) => setAreaBonusOverride(Math.round(fraction * 100))}
          onMainFavorite={setMainFavorite}
          onWeeklyBonus={setWeeklyBonus}
          goodCampTicket={goodCampTicket}
          potMultiplied={potKnown && result.kitchen.pot.bonus_daily > 0}
          onGoodCampTicket={setGoodCampTicket}
          dishType={dishType}
          onDishTypeChange={handleDishTypeChange}
          levelFor={recipeLevelFor}
          onRecipeLevelChange={setRecipeLevelOverride}
          potUnsaved={potUnsaved}
          savedPotSize={progress.pot_size}
          onSavePot={savePot}
          bonusUnsaved={areaBonusUnsaved}
          savedBonusPct={savedBonusPct}
          onSaveBonus={saveBonus}
          levelUnsaved={recipeLevelUnsaved}
          savedLevelFor={savedLevelFor}
          onSaveLevel={saveLevel}
          favoriteFor={(type) => progress.favorite_recipes[type] ?? null}
          saveError={progressSaveError !== null}
        />
      )}
    </div>
  );
}
