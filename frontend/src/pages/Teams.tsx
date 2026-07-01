import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type React from "react";

import { api } from "../api/client";
import { berryIcon } from "../berries";
import { BoxPicker } from "../components/BoxPicker";
import { MealPickerModal } from "../components/MealPickerModal";
import { Modal } from "../components/Modal";
import { ProductionCard } from "../components/ProductionCard";
import {
  IconMagnifier,
  IconPackage,
  IconPot,
  IconSparkle,
} from "../components/icons";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { recipeImage } from "../recipes";
import { spriteUrl } from "../sprites";
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
// Floor-down helper: display integers always floored (never rounded up).
const fdown = (n: number) => Math.floor(n).toLocaleString("en-US");

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

  const inTeam = useMemo(() => new Set(selectedIds), [selectedIds]);

  const teamQuery = useQuery({
    queryKey: ["team-production", selectedIds, meals],
    queryFn: () => api.computeTeamProduction({ member_ids: selectedIds, meals }),
    enabled: selectedIds.length > 0,
    placeholderData: keepPreviousData,
  });

  // Everything renders daily; the totals card shows daily + ×7 on its own.
  const factor = 1;
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

  // Member ranking: members sorted by strength desc, with dex for the sprite.
  const memberRanking = useMemo(() => {
    if (!result) return [];
    const bySpecies = new Map(catalog.data?.species.map((s) => [s.name, s]) ?? []);
    return result.members
      .map((mc) => ({
        member_id: mc.member_id,
        species: mc.species,
        strength: mc.strength,
        dex: bySpecies.get(mc.species)?.dex ?? 0,
      }))
      .sort((a, b) => b.strength - a.strength);
  }, [result, catalog.data]);

  const maxMemberStrength = useMemo(
    () => memberRanking.reduce((m, r) => Math.max(m, r.strength), 0),
    [memberRanking],
  );

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
    return total;
  }, [result, catalog.isLoading, catalog.data, potSize, cookingExtra, meals, recipeByName]);

  // Cooking grand total (daily): recipes + fillers, +10% Extra Tasty.
  const grandTotalCooking = result
    ? (result.cooking_strength + fillerStrengthTotal) * 1.10
    : 0;

  const pickMember = (m: Member) => {
    if (selectedIds.length >= MAX_TEAM) return;
    if (selectedIds.includes(m.id)) return;
    setSelectedIds((prev) => [...prev, m.id]);
    setPickerOpen(false);
  };

  const removeMember = (id: string) =>
    setSelectedIds((prev) => prev.filter((x) => x !== id));

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

          return (
            <ProductionCard
              key={id}
              config={config}
              catalog={catalog.data}
              production={prod}
              productionError={null}
              readOnly
              onEdit={() => {/* no-op in readOnly */}}
              onClone={() => {/* no-op in readOnly */}}
              onRemove={() => removeMember(id)}
              onMakeBase={() => {/* no-op in readOnly */}}
              onSaveToBox={() => {/* no-op in readOnly */}}
            />
          );
        })}

        {/* Trailing "add" slot — same pattern as Production.tsx */}
        <div className="prod-card-cell">
          <div className="prod-card__toolbar prod-card__toolbar--empty" aria-hidden="true" />
          <article className="prod-card prod-card--add">
            {atMax ? (
              <p className="muted prod-add__hint">{t("teams.atMax")}</p>
            ) : (
              <>
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
              </>
            )}
          </article>
        </div>
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
            {/* Berries & skills card */}
            <div className="card teams-aggregates__berries">
              {/* Berries & skills aggregates */}
              <div className="prod-card__block-head">{t("teams.berriesSkills")}</div>

              {/* Total strength (berries + skills) — right-aligned value */}
              <div className="prod-card__line">
                <span className="muted">{t("teams.totalStrength")}</span>
                <span>
                  <img
                    className="mini-icon"
                    src={CHARGE_STRENGTH_ICON}
                    alt=""
                  />{" "}
                  {fmtInt(result.total_strength * factor)}
                </span>
              </div>
              {/* Skills-only strength — right-aligned value */}
              <div className="prod-card__line">
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  <IconSparkle width={12} height={12} style={{ opacity: 0.75 }} />
                  <span className="muted">{t("card.skill")}</span>
                </span>
                <span>{fmtInt(result.total_skill_strength * factor)}</span>
              </div>

              {/* Berry-type breakdown: tabular-aligned name / amount / strength columns */}
              {berryBreakdown.length > 0 && (
                <div style={{ marginTop: "0.4rem" }}>
                  <div className="prod-card__block-head" style={{ fontSize: "var(--text-xs)", marginTop: "0.5rem" }}>
                    {t("teams.byBerry")}
                  </div>
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
                          {fdown(berry_strength * factor)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* #4 & #5 — Skill effects with icon + total + triggers. Excludes
                  cooking_ingredients (pot expansion) and ingredient_total (random
                  ingredients) — both are represented in the cooking card / fillers. */}
              {result.skill_effects.filter(
                (e: SkillEffectAgg) => e.kind !== "cooking_ingredients" && e.kind !== "ingredient_total",
              ).length > 0 && (
                <>
                  <div className="prod-card__block-head" style={{ marginTop: "0.75rem" }}>
                    {t("card.skill")}
                  </div>
                  {result.skill_effects
                    .filter(
                      (e: SkillEffectAgg) => e.kind !== "cooking_ingredients" && e.kind !== "ingredient_total",
                    )
                    .map((e: SkillEffectAgg) => {
                      const meta = skillEffectMeta(e.kind);
                      const total = e.total * factor;
                      const triggers = e.triggers * factor;
                      const label = t(meta.labelKey);
                      return (
                        <div key={e.kind} className="prod-card__line">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            {meta.iconNode()}
                            <span>
                              {e.kind === "tasty_chance"
                                ? `+${fdown(total)}% ${label}`
                                : e.kind === "extra_helpful"
                                  ? `×${fdown(total)} ${label}`
                                  : `${fdown(total)} ${label}`}
                            </span>
                            <IconSparkle width={12} height={12} style={{ opacity: 0.75 }} />
                            <span>{triggers.toFixed(2)}</span>
                          </span>
                        </div>
                      );
                    })}
                </>
              )}

              {result.excluded_count > 0 && (
                <p className="muted" style={{ fontSize: "var(--text-sm)", marginTop: "0.5rem" }}>
                  {t("teams.excluded", { count: String(result.excluded_count) })}
                </p>
              )}
            </div>

            {/* Member ranking card: contribution per member, sorted by strength */}
            {memberRanking.length > 0 && (
              <div className="card teams-member-rank-card">
                <div className="prod-card__block-head">{t("teams.memberRanking")}</div>
                <ul className="teams-member-rank">
                  {memberRanking.map((r) => (
                    <li key={r.member_id} className="teams-member-rank__row">
                      <img
                        className="teams-member-rank__sprite"
                        src={spriteUrl(r.dex)}
                        alt={r.species}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                      <span className="teams-member-rank__mid">
                        <span className="teams-member-rank__name">{r.species}</span>
                        <span className="teams-member-rank__bar-track">
                          <span
                            className="teams-member-rank__bar"
                            style={{
                              width: `${maxMemberStrength > 0 ? (r.strength / maxMemberStrength) * 100 : 0}%`,
                            }}
                          />
                        </span>
                      </span>
                      <span className="teams-member-rank__value">
                        <img
                          className="mini-icon"
                          src={CHARGE_STRENGTH_ICON}
                          alt=""
                          style={{ width: 13, height: 13 }}
                        />
                        {fdown(r.strength * factor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                                {fmtInt(feasibility.strength * factor)}
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
                          {fdown(result.cooking_strength * factor)}
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
                            const contributed = Math.floor(usedUnits * strength * factor);
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
                      </div>
                    )}

                    {/* Block 5 — Grand total with +10% Extra Tasty */}
                    {(() => {
                      const subtotal = (result.cooking_strength + fillerStrengthTotal) * factor;
                      const extraTastyBonus = subtotal * 0.10;
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
                            <span className="cook-total-row__label">
                              <img
                                className="mini-icon"
                                src="/extra-tasty.png"
                                alt=""
                                style={{ width: 14, height: 14 }}
                              />
                              {t("teams.extraTasty")} +10%
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
                              {fdown(grandTotal)}
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

          {/* ── TEAM TOTALS card — the page's headline KPI (daily + weekly, always) ── */}
          <div className="card teams-totals">
            {/* Col 1 — Berries & skills */}
            <div className="teams-totals__col">
              <span className="teams-totals__label">{t("teams.berriesSkills")}</span>
              <span className="teams-totals__kpi">
                <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt="" style={{ width: 18, height: 18 }} />
                {fdown(result.total_strength)}
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
                {fdown(grandTotalCooking)}
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
                {fdown(result.total_strength + grandTotalCooking)}
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

      {/* MealPickerModal */}
      {mealPickerOpen && (
        <MealPickerModal
          recipes={recipes.data ?? []}
          levelBonus={catalog.data.recipe_level_bonus}
          meals={meals}
          onChangeMeals={setMeals}
          onClose={() => setMealPickerOpen(false)}
          potSize={potSize}
          onPotSizeChange={setPotSize}
          cookingExtra={cookingExtra}
        />
      )}
    </div>
  );
}
