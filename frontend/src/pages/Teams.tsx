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
import { berryIcon } from "../berries";
import { BoxPicker } from "../components/BoxPicker";
import { SettingsModal } from "../components/SettingsModal";
import { Modal } from "../components/Modal";
import { ProductionCard } from "../components/ProductionCard";
import { StrengthValue } from "../components/StrengthValue";
import {
  IconMagnifier,
  IconPackage,
  IconPot,
  IconSparkle,
} from "../components/icons";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { fdown } from "../utils/format";
import { recipeImage } from "../recipes";
import { statIcon } from "../natures";
import { CHARGE_STRENGTH_ICON, POT_EXPANSION_ICON } from "../skillIcons";
import type { Catalog, MealInput, Member, MemberInput, SkillEffectAgg } from "../types";

const MAX_TEAM = 5;

// kind → { icon renderer, i18n label key } — mirrors ProductionCard's skill section.
// Used to render skill_effects rows in the aggregates card.
type SkillEffectMeta = {
  iconNode: () => React.ReactNode;
  labelKey: string;
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
    case "extra_helpful":
      return {
        iconNode: () => <IconMagnifier />,
        labelKey: "card.helpMult",
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
    default:
      return {
        iconNode: () => <IconSparkle />,
        labelKey: "card.skill",
      };
  }
}

// Pure module-level helper — same logic as pickMember in Production.tsx.
function configFromMember(catalog: Catalog, m: Member): MemberInput | null {
  const species = catalog.species.find((s) => s.name === m.species);
  if (!species || species.ingredient_slots.length === 0) return null;
  return {
    species: m.species,
    level: m.level,
    nature: m.nature,
    ingredients: species.ingredient_slots.map(
      (opts, i) => m.ingredients[i] ?? opts[0] ?? "",
    ),
    sub_skills: m.sub_skills,
    ribbon: m.ribbon,
    skill_level: m.skill_level,
  };
}
const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export function Teams() {
  const { t, ingredient: ingName, berry: berryName } = useI18n();

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: api.getRecipes });

  // Ordered list of selected member ids (capped at MAX_TEAM).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [meals, setMeals] = useState<(MealInput | null)[]>([null, null, null]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mealPickerOpen, setMealPickerOpen] = useState(false);
  const [potSize, setPotSize] = useState(15);
  const [goodCampTicket, setGoodCampTicket] = useState(false);

  // Dish type: restricts all 3 meal slots to the same recipe type (ephemeral, frontend-only).
  const [dishType, setDishType] = useState<'Curry' | 'Salad' | 'Dessert' | null>(null);

  // Island state (efímero, como meals).
  const [selectedIsland, setSelectedIsland] = useState<string | null>(null);
  const [favoriteBerries, setFavoriteBerries] = useState<string[]>([]);
  const [islandBonus, setIslandBonus] = useState<number>(0);

  const inTeam = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Set de bayas favoritas activas para lookup O(1) al renderizar las cards.
  const favBerrySet = useMemo(
    () => new Set(favoriteBerries.filter(Boolean)),
    [favoriteBerries],
  );

  // Bayas que realmente enviar al backend: filtrar strings vacíos (slots no elegidos).
  const activeBerries = favoriteBerries.filter(Boolean);

  const teamQuery = useQuery({
    queryKey: ["team-production", selectedIds, meals, activeBerries, islandBonus, goodCampTicket],
    queryFn: () =>
      api.computeTeamProduction({
        member_ids: selectedIds,
        meals,
        favorite_berries: activeBerries,
        island_bonus: islandBonus,
        good_camp_ticket: goodCampTicket,
      }),
    enabled: selectedIds.length > 0,
    placeholderData: keepPreviousData,
  });

  // Everything renders daily; the totals card shows daily + ×7 on its own.
  const factor = 1;
  // Multiplicador de fuerza del bonus de isla (1 cuando no hay bonus).
  const bonusFactor = 1 + islandBonus;
  const result = teamQuery.data;

  // Total extra pot ingredients/day from cooking_ingredients skill effect (or 0).
  const cookingExtra = useMemo(() => {
    if (!result) return 0;
    return result.skill_effects.find((e) => e.kind === "cooking_ingredients")?.total ?? 0;
  }, [result]);

  // Lookup map: recipe name → Recipe for pot/filler calc in plan rows.
  const recipeByName = useMemo(
    () => new Map((recipes.data ?? []).map((r) => [r.name, r])),
    [recipes.data],
  );

  // Lookup map: member id → Member.
  const memberById = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.id, m])),
    [members.data],
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

  // Berry breakdown: group members by berry type, sum amounts and strengths.
  const berryBreakdown = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, { berry_amount: number; berry_strength: number; species: string[] }>();
    for (const mc of result.members) {
      const berry = mc.production.berry;
      const existing = map.get(berry);
      if (existing) {
        existing.berry_amount += mc.production.berry_amount;
        existing.berry_strength += mc.production.berry_strength;
        existing.species.push(mc.species);
      } else {
        map.set(berry, {
          berry_amount: mc.production.berry_amount,
          berry_strength: mc.production.berry_strength,
          species: [mc.species],
        });
      }
    }
    return [...map.entries()]
      .map(([berry, data]) => ({ berry, ...data }))
      .sort((a, b) => b.berry_strength - a.berry_strength);
  }, [result]);

  // Filler strength total (daily) — same allocation logic the cooking card's
  // IIFE uses, lifted to component scope so the totals card can reuse it.
  // Surplus ingredients + the random pseudo-ingredient fill the leftover pot
  // slots, sorted by strength desc; each unit contributes its base strength.
  const fillerStrengthTotal = useMemo(() => {
    if (!result || catalog.isLoading || !catalog.data) return 0;
    const ingredientStrengths = catalog.data.ingredient_strengths;
    const totalCapacity = potSize * 3 + cookingExtra;
    const usedByRecipes = MEAL_SLOTS.reduce((sum, _slot, idx) => {
      const meal = meals[idx];
      if (!meal) return sum;
      const recipeData = recipeByName.get(meal.recipe);
      if (!recipeData) return sum;
      return sum + recipeData.ingredients.reduce((s, ic) => s + ic.count, 0);
    }, 0);
    const totalFillers = Math.max(0, totalCapacity - usedByRecipes);

    const strengthValues = Object.values(ingredientStrengths);
    const avgStrength =
      strengthValues.length > 0
        ? strengthValues.reduce((s, v) => s + v, 0) / strengthValues.length
        : 0;
    const randomTotal = result.skill_ingredient_total ?? 0;

    const pool = result.cooking_surplus
      .filter((b) => b.balance > 0)
      .map((b) => ({ strength: ingredientStrengths[b.ingredient] ?? 0, balance: b.balance }));
    if (randomTotal > 0) pool.push({ strength: avgStrength, balance: randomTotal });
    pool.sort((a, b) => b.strength - a.strength);

    let remainingSlots = totalFillers;
    let total = 0;
    for (const item of pool) {
      const usedUnits = Math.min(item.balance, remainingSlots);
      remainingSlots -= usedUnits;
      total += Math.floor(usedUnits) * item.strength;
    }
    return total * bonusFactor;
  }, [result, catalog.isLoading, catalog.data, potSize, cookingExtra, meals, recipeByName, islandBonus]);

  // Cooking grand total (daily): recipes + fillers × el multiplicador esperado de
  // Extra Tasty del equipo (base del juego ≈1.17; sube con Tasty Chance S).
  const grandTotalCooking = result
    ? (result.cooking_strength + fillerStrengthTotal) * result.extra_tasty_multiplier
    : 0;

  const pickMember = (m: Member) => {
    if (selectedIds.length >= MAX_TEAM) return;
    if (selectedIds.includes(m.id)) return;
    setSelectedIds((prev) => [...prev, m.id]);
    setPickerOpen(false);
  };

  const removeMember = (id: string) =>
    setSelectedIds((prev) => prev.filter((x) => x !== id));

  // Handler: set dishType and clear meals that are incompatible with the new type.
  // When newType is null (no restriction), also clear all meals so a mixed state
  // (e.g. Curry + Salad) can never persist after the type selector is reset.
  const handleDishTypeChange = (newType: 'Curry' | 'Salad' | 'Dessert' | null) => {
    setDishType(newType);
    if (newType === null) {
      setMeals([null, null, null]);
    } else {
      setMeals((prev) =>
        prev.map((m) => {
          if (m === null) return null;
          const recipe = recipeByName.get(m.recipe);
          // If recipe not found in catalog or type mismatch, clear the slot.
          return recipe && recipe.type === newType ? m : null;
        }),
      );
    }
  };

  // Catalog must be loaded for BoxPicker to work.
  if (catalog.isLoading) return <p className="muted">{t("common.loadingCatalog")}</p>;
  if (catalog.isError || !catalog.data)
    return (
      <p className="error" role="alert">
        {t("common.catalogError")}{" "}
        <button type="button" className="btn btn--ghost" onClick={() => catalog.refetch()}>
          {t("common.retry")}
        </button>
      </p>
    );

  const atMax = selectedIds.length >= MAX_TEAM;

  return (
    <div className="layout layout--wide">
      <header className="hero">
        <h1>{t("teams.title")}</h1>
        <p className="muted">{t("teams.subtitle")}</p>
      </header>

      {/* ── Config toolbar above the roster (recipes + island + berries + bonuses) ── */}
      <div className="teams-config-toolbar">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setMealPickerOpen(true)}
        >
          {t("teams.configure")}
        </button>
      </div>

      {goodCampTicket && (
        <div className="teams-gct-notice" role="status">
          <img src="/pot.webp" alt="" className="mini-icon" style={{ width: 16, height: 16 }} />
          {t("teams.gctActive")}
        </div>
      )}

      {/* ── Per-member cards (mirrors Production.tsx selection model) ── */}
      <div className="prod-cards prod-cards--compact">
        {selectedIds.map((id) => {
          const m = memberById.get(id);
          if (!m) return null;
          const config = configFromMember(catalog.data, m);
          if (!config) return null;

          // Find this member's per-member production from the team result.
          const contrib = result?.members.find((mc) => mc.member_id === id);
          const prod = contrib?.production ?? null;

          // Determine if this member's berry is a favorite of the active island.
          // The source of truth is the catalog species entry (not the production
          // result), so the highlight is available even before the query resolves.
          const speciesEntry = catalog.data.species.find((s) => s.name === m.species);
          const isFavoriteBerry =
            speciesEntry != null && favBerrySet.has(speciesEntry.berry);

          return (
            <ProductionCard
              key={id}
              config={config}
              catalog={catalog.data}
              production={prod}
              productionError={null}
              readOnly
              isFavoriteBerry={isFavoriteBerry}
              onEdit={() => {/* no-op in readOnly */}}
              onClone={() => {/* no-op in readOnly */}}
              onRemove={() => removeMember(id)}
              onMakeBase={() => {/* no-op in readOnly */}}
              onSaveToBox={() => {/* no-op in readOnly */}}
            />
          );
        })}

        {/* Trailing "add" slot — hidden once the team is full (max is obvious). */}
        {!atMax && (
          <div className="prod-card-cell">
            <div className="prod-card__toolbar prod-card__toolbar--empty" aria-hidden="true" />
            <article className="prod-card prod-card--add">
              <p className="muted prod-add__hint">
                {selectedIds.length === 0
                  ? t("teams.empty")
                  : t("teams.addHintMore")}
              </p>
              <div className="prod-add__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setPickerOpen(true)}
                >
                  {t("teams.addPokemon")}
                </button>
              </div>
            </article>
          </div>
        )}
      </div>

      {/* ── Loading / error states for the team query ── */}
      {selectedIds.length > 0 && teamQuery.isLoading && (
        <p className="muted" style={{ marginTop: "1.5rem" }}>{t("teams.calculating")}</p>
      )}
      {selectedIds.length > 0 && teamQuery.isError && (
        <p className="error" role="alert" style={{ marginTop: "1.5rem" }}>
          {t("teams.teamError")}{" "}
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
                {berryBreakdown.length > 0 && (
                  <ul className="teams-berry-list">
                    {berryBreakdown.map(({ berry, berry_amount, berry_strength }) => (
                      <li key={berry} className="teams-berry-row">
                        <span className="teams-berry-row__name">
                          <img
                            className="mini-icon"
                            src={berryIcon(berry)}
                            alt={berryName(berry)}
                            title={berryName(berry)}
                          />
                          <span>{berryName(berry)}</span>
                        </span>
                        <span className="teams-berry-row__amount muted">
                          ×{fdown(berry_amount * factor)}
                        </span>
                        <span className="teams-berry-row__strength">
                          <img
                            className="mini-icon"
                            src={CHARGE_STRENGTH_ICON}
                            alt=""
                            style={{ width: 14, height: 14 }}
                          />{" "}
                          {fdown(berry_strength * bonusFactor)}
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

              {result.excluded_count > 0 && (
                <p className="muted" style={{ fontSize: "var(--text-sm)", marginTop: "0.5rem" }}>
                  {t("teams.excluded", { count: String(result.excluded_count) })}
                </p>
              )}
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
                            {e.kind === "extra_helpful"
                              ? `×${fdown(total)} ${label}`
                              : `${fdown(total)} ${label}`}
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
              );
            })()}

            {/* ── Strength breakdown: proportion of the 4 strength sources ── */}
            {(() => {
              const pieData = [
                { key: "berries", name: t("teams.berries"), value: result.total_berry_strength * factor, color: "#6366f1" },
                { key: "skills", name: t("card.skill"), value: result.total_skill_strength * factor, color: "#3fb950" },
                { key: "recipes", name: t("teams.recipes"), value: result.cooking_strength * factor, color: "#a371f7" },
                { key: "fillers", name: t("teams.fillersLabel"), value: fillerStrengthTotal * factor, color: "#f78166" },
                // Fuerza extra que aporta el multiplicador de Extra Tasty sobre recetas + fillers.
                { key: "extraTasty", name: t("teams.extraTasty"), value: (result.cooking_strength + fillerStrengthTotal) * (result.extra_tasty_multiplier - 1) * factor, color: "#e3b341" },
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
              </div>

              {/* Compact plan summary: one row per moment */}
              <div className="teams-plan-rows">
                {MEAL_SLOTS.map((slot, idx) => {
                  const meal = meals[idx];
                  const feasibility = meal ? feasibilityBySlot.get(idx) : undefined;

                  // Per-meal pot capacity: base pot + its share of the skill
                  // expansion. Warn only when the recipe's ingredient count
                  // exceeds it (if it fits, the spare goes to fillers).
                  const perMealPot = potSize + Math.floor(cookingExtra / 3);
                  const recipeData = meal ? recipeByName.get(meal.recipe) : undefined;
                  const recipeIngs = recipeData
                    ? recipeData.ingredients.reduce((s, ic) => s + ic.count, 0)
                    : 0;
                  const exceedsPot = recipeData != null && recipeIngs > perMealPot;

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
                                {fmtInt(feasibility.strength * bonusFactor)}
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
                              {t("teams.potTooSmall")} ({recipeIngs}/{perMealPot})
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
                // ── Daily capacity accounting ──────────────────────────────
                const totalCapacity = potSize * 3 + cookingExtra;
                const usedByRecipes = MEAL_SLOTS.reduce((sum, _slot, idx) => {
                  const meal = meals[idx];
                  if (!meal) return sum;
                  const recipeData = recipeByName.get(meal.recipe);
                  if (!recipeData) return sum;
                  return sum + recipeData.ingredients.reduce((s, ic) => s + ic.count, 0);
                }, 0);
                const totalFillers = Math.max(0, totalCapacity - usedByRecipes);

                // ── Filler allocation (slot-based, sorted by strength desc) ─
                const ingredientStrengths = catalog.data.ingredient_strengths;

                // Random ingredients (Ingredient Magnet): units/day of unknown type.
                // Modeled as a single pseudo-ingredient whose strength is the mean
                // of all ingredient base strengths (type unknown → average ≈145).
                const randomTotal = result.skill_ingredient_total ?? 0;
                const strengthValues = Object.values(ingredientStrengths);
                const avgStrength =
                  strengthValues.length > 0
                    ? strengthValues.reduce((s, v) => s + v, 0) / strengthValues.length
                    : 0;

                // Unified filler pool: real surplus ingredients + (optionally) the
                // random pseudo-ingredient. Each entry carries its own strength so
                // the allocation/render code stays uniform.
                type FillerEntry = {
                  key: string;
                  ingredient: string | null; // null → random pseudo-ingredient
                  label: string;
                  strength: number;
                  balance: number;
                  isRandom: boolean;
                };
                const fillerPool: FillerEntry[] = result.cooking_surplus
                  .filter((b) => b.balance > 0)
                  .map((b) => ({
                    key: b.ingredient,
                    ingredient: b.ingredient,
                    label: ingName(b.ingredient),
                    strength: ingredientStrengths[b.ingredient] ?? 0,
                    balance: b.balance,
                    isRandom: false,
                  }));
                if (randomTotal > 0) {
                  fillerPool.push({
                    key: "__random__",
                    ingredient: null,
                    label: t("teams.randomIngredients"),
                    strength: avgStrength,
                    balance: randomTotal,
                    isRandom: true,
                  });
                }
                const sortedPool = [...fillerPool].sort((a, b) => b.strength - a.strength);
                let remainingSlots = totalFillers;
                const fillerAllocation = sortedPool.map((item) => {
                  const usedUnits = Math.min(item.balance, remainingSlots);
                  remainingSlots -= usedUnits;
                  return { ...item, usedUnits };
                });

                // ── Cooking skill effect entry ─────────────────────────────
                const cookingSkillEffect = result.skill_effects.find(
                  (e: SkillEffectAgg) => e.kind === "cooking_ingredients",
                );
                // Random-ingredients skill effect (Ingredient Magnet) — its
                // triggers are shown on the random filler row.
                const randomSkillEffect = result.skill_effects.find(
                  (e: SkillEffectAgg) => e.kind === "ingredient_total",
                );

                // fillerStrengthTotal is lifted to component scope (reused by the
                // totals card); the allocation above only drives the per-filler rows.

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
                            value={result.cooking_strength * factor}
                            base={result.cooking_strength_base * factor}
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
                                  {t("teams.missingAmt", { n: fdown(Math.abs(b.balance) * factor) })}
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
                          <span className="cook-cap-row__value">{potSize * 3}</span>
                        </li>
                        {/* Skill expansion — only if >0 */}
                        {cookingExtra > 0 && cookingSkillEffect && (
                          <li className="cook-cap-row">
                            <span className="cook-cap-row__label">
                              <IconSparkle width={14} height={14} />
                              {t("teams.potSkill")}
                              <span className="muted" style={{ fontSize: "var(--text-xs)", display: "inline-flex", alignItems: "center", gap: "0.15rem" }}>
                                &ensp;(<IconSparkle width={11} height={11} />{(cookingSkillEffect.triggers * factor).toFixed(2)})
                              </span>
                            </span>
                            <span className="cook-cap-row__value">+{fdown(cookingExtra)}</span>
                          </li>
                        )}
                        {/* Used by recipes */}
                        <li className="cook-cap-row">
                          <span className="cook-cap-row__label">
                            <img src="/pot.webp" alt="" className="mini-icon" style={{ width: 14, height: 14 }} />
                            {t("teams.usedByRecipes")}
                          </span>
                          <span className="cook-cap-row__value">−{fdown(usedByRecipes)}</span>
                        </li>
                        {/* Fillers total row */}
                        <li className="cook-cap-row cook-cap-row--total">
                          <span className="cook-cap-row__label">
                            {t("teams.fillersLabel")}
                          </span>
                          <span className="cook-cap-row__value">{fdown(totalFillers)}</span>
                        </li>
                      </ul>
                    </div>

                    {/* Block 4 — Fillers (slot-based allocation: base strength + X/Y chip + contributed strength) */}
                    {fillerAllocation.length > 0 && (
                      <div className="cook-result-block">
                        <div className="prod-card__block-head">
                          {t("teams.fillersLabel")}
                        </div>
                        <ul className="cook-filler-list">
                          {fillerAllocation.map(({ key, ingredient, label, strength, balance, usedUnits, isRandom }) => {
                            const isUsed = usedUnits > 0;
                            const usedFloor = Math.floor(usedUnits);
                            const availFloor = Math.floor(balance);
                            const contributed = Math.floor(usedUnits * strength * bonusFactor);
                            const tip = isRandom ? t("teams.randomIngredientsTip") : undefined;
                            return (
                              <li
                                key={key}
                                className="cook-filler-item cook-filler-item--rich"
                                title={tip}
                              >
                                <span className="cook-filler-item__info">
                                  {isRandom ? (
                                    <IconPackage
                                      width={18}
                                      height={18}
                                      style={{ color: "var(--muted)" }}
                                    />
                                  ) : (
                                    <img
                                      className="mini-icon"
                                      src={ingredientIcon(ingredient as string)}
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
                                    {Math.round(strength)}
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
                                      {fdown(contributed)}
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
                              value={fillerStrengthTotal * factor}
                              base={fillerStrengthTotal / bonusFactor * factor}
                              bonus={islandBonus}
                            />
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Block 5 — Grand total con el Extra Tasty esperado del equipo */}
                    {(() => {
                      const subtotal = (result.cooking_strength + fillerStrengthTotal) * factor;
                      const extraTastyBonus = subtotal * (result.extra_tasty_multiplier - 1);
                      const extraTastyPct = (result.extra_tasty_rate * 100).toFixed(1);
                      const extraTastyMult = result.extra_tasty_multiplier.toFixed(2);
                      const grandTotal = grandTotalCooking * factor;
                      return (
                        <div className="cook-result-block">
                          <div className="cook-total-row">
                            <span className="cook-total-row__label">
                              {t("teams.recipes")}
                            </span>
                            <span className="cook-total-row__value">
                              {fdown(result.cooking_strength * factor)}
                            </span>
                          </div>
                          <div className="cook-total-row">
                            <span className="cook-total-row__label">
                              {t("teams.fillersLabel")}
                            </span>
                            <span className="cook-total-row__value">
                              {fdown(fillerStrengthTotal * factor)}
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
                              +{fdown(extraTastyBonus)}
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
                                value={grandTotal}
                                base={grandTotal / bonusFactor}
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
          subtotal, total berries+skills card, cooking_strength subtotal, fillers
          subtotal, cooking grand total, totals-card cooking col, totals-card
          grand total. NEVER on per-berry/per-recipe/per-filler rows, the
          "Recetas"/"Fillers" repeat lines in Block 5, or the +10% extra tasty line.
          When bonus=0 → bonusFactor=1 → base=value → floor(base)===floor(value)
          → no tooltip rendered (identity, no visual change). ── */}
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
                  value={grandTotalCooking}
                  base={grandTotalCooking / bonusFactor}
                  bonus={islandBonus}
                />
              </span>
              <span className="teams-totals__aside">
                ×7 {fdown(grandTotalCooking * 7)}
              </span>
            </div>

            <span className="teams-totals__divider" aria-hidden="true" />

            {/* Col 3 — Grand total (biggest number on the page) */}
            <div className="teams-totals__col teams-totals__col--grand">
              <span className="teams-totals__label">{t("teams.grandTotal")}</span>
              <span className="teams-totals__kpi teams-totals__kpi--grand">
                <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt="" style={{ width: 22, height: 22 }} />
                <StrengthValue
                  value={result.total_strength + grandTotalCooking}
                  base={result.total_strength_base + grandTotalCooking / bonusFactor}
                  bonus={islandBonus}
                />
              </span>
              <span className="teams-totals__aside">
                ×7 {fdown((result.total_strength + grandTotalCooking) * 7)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* BoxPicker modal — same pattern as Production.tsx */}
      {pickerOpen && (
        <Modal
          title={t("teams.pickFromBox")}
          onClose={() => setPickerOpen(false)}
        >
          <BoxPicker
            members={members.data}
            isLoading={members.isLoading}
            isError={members.isError}
            onRetry={() => members.refetch()}
            catalog={catalog.data}
            inComparison={inTeam}
            onPick={pickMember}
          />
        </Modal>
      )}

      {/* SettingsModal */}
      {mealPickerOpen && (
        <SettingsModal
          recipes={recipes.data ?? []}
          levelBonus={catalog.data.recipe_level_bonus}
          meals={meals}
          onChangeMeals={setMeals}
          onClose={() => setMealPickerOpen(false)}
          potSize={potSize}
          onPotSizeChange={setPotSize}
          cookingExtra={cookingExtra}
          catalog={catalog.data}
          selectedIsland={selectedIsland}
          favoriteBerries={favoriteBerries}
          islandBonus={islandBonus}
          onSelectIsland={setSelectedIsland}
          onFavoriteBerries={setFavoriteBerries}
          onIslandBonus={setIslandBonus}
          goodCampTicket={goodCampTicket}
          onGoodCampTicket={setGoodCampTicket}
          dishType={dishType}
          onDishTypeChange={handleDishTypeChange}
        />
      )}
    </div>
  );
}
