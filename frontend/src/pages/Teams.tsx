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
  IconCheck,
  IconMagnifier,
  IconPot,
  IconSparkle,
} from "../components/icons";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
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

const fmt = (n: number) => n.toFixed(2);
const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export function Teams() {
  const { t, ingredient: ingName, berry: berryName } = useI18n();

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: api.getRecipes });

  // Ordered list of selected member ids (capped at MAX_TEAM).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [meals, setMeals] = useState<(MealInput | null)[]>([null, null, null]);
  const [weekly, setWeekly] = useState(false);
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

  const factor = weekly ? 7 : 1;
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
          {/* #1 — Page-level daily/weekly toggle: global control for all analysis below */}
          <div className="teams-period-toolbar">
            <div className="specialty-toggle" role="group" aria-label={t("teams.toggleLabel")}>
              <button
                type="button"
                className={"specialty-toggle__btn" + (!weekly ? " is-on" : "")}
                aria-pressed={!weekly}
                onClick={() => setWeekly(false)}
              >
                {t("teams.daily")}
              </button>
              <button
                type="button"
                className={"specialty-toggle__btn" + (weekly ? " is-on" : "")}
                aria-pressed={weekly}
                onClick={() => setWeekly(true)}
              >
                {t("teams.weekly")}
              </button>
            </div>
          </div>

          <div className="teams-aggregates">

            {/* Grand-total card */}
            <div className="card">
              {/* Grand total value — flame icon is sufficient, no redundant label */}
              <div className="prod-stat" style={{ marginBottom: "0.75rem" }}>
                <span className="prod-stat__label">{t("teams.grandTotal")}</span>
                <span className="prod-stat__value">
                  <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt="" style={{ width: 18, height: 18, marginRight: "0.25rem" }} />
                  {fmtInt(result.grand_total_strength * factor)}
                  {teamQuery.isFetching && !teamQuery.isLoading && (
                    <span className="muted" style={{ fontSize: "var(--text-sm)", marginLeft: "0.5rem" }}>
                      {t("teams.updating")}
                    </span>
                  )}
                </span>
              </div>

              {/* Berries & skills aggregates */}
              <div className="prod-card__block-head">{t("teams.berriesSkills")}</div>

              {/* Berry totals */}
              <div className="prod-card__line">
                <span>
                  <img
                    className="mini-icon"
                    src={CHARGE_STRENGTH_ICON}
                    alt=""
                  />{" "}
                  {fmtInt(result.total_strength * factor)}
                </span>
              </div>
              <div className="prod-card__line">
                <span className="muted">{t("teams.berries")}</span>
                <span>{fmt(result.total_berry_amount * factor)}</span>
              </div>

              {/* #3 — Berry-type breakdown: always visible */}
              {berryBreakdown.length > 0 && (
                <div style={{ marginTop: "0.4rem" }}>
                  <div className="prod-card__block-head" style={{ fontSize: "var(--text-xs)", marginTop: "0.5rem" }}>
                    {t("teams.byBerry")}
                  </div>
                  <ul className="prod-card__ings" style={{ marginTop: "0.25rem" }}>
                    {berryBreakdown.map(({ berry, berry_amount, berry_strength }) => (
                      <li key={berry} style={{ justifyContent: "space-between" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                          <img
                            className="mini-icon"
                            src={berryIcon(berry)}
                            alt={berryName(berry)}
                            title={berryName(berry)}
                          />
                          <span>{berryName(berry)}</span>
                        </span>
                        <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                          ×{fmt(berry_amount * factor)}
                        </span>
                        <span>
                          <img
                            className="mini-icon"
                            src={CHARGE_STRENGTH_ICON}
                            alt=""
                            style={{ width: 14, height: 14 }}
                          />{" "}
                          {fmtInt(Math.round(berry_strength * factor))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* #4 & #5 — Skill effects with icon + total + triggers. Excludes cooking_ingredients (#6). */}
              {result.skill_effects.filter((e: SkillEffectAgg) => e.kind !== "cooking_ingredients").length > 0 && (
                <>
                  <div className="prod-card__block-head" style={{ marginTop: "0.75rem" }}>
                    {t("card.skill")}
                  </div>
                  {result.skill_effects
                    .filter((e: SkillEffectAgg) => e.kind !== "cooking_ingredients")
                    .map((e: SkillEffectAgg) => {
                      const meta = skillEffectMeta(e.kind);
                      const total = e.total * factor;
                      const triggers = e.triggers * factor;
                      const label = t(meta.labelKey);
                      const text =
                        e.kind === "tasty_chance"
                          ? `+${fmtInt(total)}% ${label} ${t("teams.inTriggers", { n: fmt(triggers) })}`
                          : e.kind === "extra_helpful"
                            ? `×${fmt(total)} ${label} ${t("teams.inTriggers", { n: fmt(triggers) })}`
                            : `${e.kind === "dream_shards" ? fmtInt(total) : fmt(total)} ${label} ${t("teams.inTriggers", { n: fmt(triggers) })}`;
                      return (
                        <div key={e.kind} className="prod-card__line">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            {meta.iconNode()}
                            <span>{text}</span>
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

            {/* Cooking card */}
            <div className="card">
              <div className="teams-cooking-head">
                <h2 style={{ margin: 0 }}>{t("teams.cooking")}</h2>
                <button
                  type="button"
                  className="btn btn--ghost teams-cooking-edit"
                  onClick={() => setMealPickerOpen(true)}
                >
                  {t("teams.editRecipes")}
                </button>
              </div>

              {/* Compact plan summary: one row per moment */}
              <div className="teams-plan-rows">
                {MEAL_SLOTS.map((slot, idx) => {
                  const meal = meals[idx];
                  const feasibility = meal ? feasibilityBySlot.get(idx) : undefined;

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
                          {feasibility != null && feasibility.ingredients.length > 0 && (
                            <div className="cook-row__ings">
                              {feasibility.ingredients.map((ing) => {
                                const ok = ing.available >= ing.required;
                                const fmtAmt = (n: number) =>
                                  Number.isInteger(n) ? String(n) : n.toFixed(1);
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
                                    {fmtAmt(ing.available)}/{fmtAmt(ing.required)}
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
                const surplusIngredients = result.cooking_surplus.filter((b) => b.balance > 0);
                const sortedSurplus = [...surplusIngredients].sort(
                  (a, b) =>
                    (ingredientStrengths[b.ingredient] ?? 0) -
                    (ingredientStrengths[a.ingredient] ?? 0),
                );
                let remainingSlots = totalFillers;
                let fillerStrength = 0;
                const fillerAllocation = sortedSurplus.map((item) => {
                  const usedUnits = Math.min(item.balance, remainingSlots);
                  remainingSlots -= usedUnits;
                  const strength = ingredientStrengths[item.ingredient] ?? 0;
                  fillerStrength += usedUnits * strength;
                  return { ...item, usedUnits };
                });

                // ── Cooking skill effect entry ─────────────────────────────
                const cookingSkillEffect = result.skill_effects.find(
                  (e: SkillEffectAgg) => e.kind === "cooking_ingredients",
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
                          {fmtInt(result.cooking_strength * factor)}
                        </span>
                      </div>
                    </div>

                    {/* Block 2 — Pot capacity table */}
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
                              <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                                &ensp;({t("teams.inTriggers", { n: fmt(cookingSkillEffect.triggers * factor) })})
                              </span>
                            </span>
                            <span className="cook-cap-row__value">+{cookingExtra}</span>
                          </li>
                        )}
                        {/* Used by recipes */}
                        <li className="cook-cap-row">
                          <span className="cook-cap-row__label">
                            <img src="/pot.webp" alt="" className="mini-icon" style={{ width: 14, height: 14 }} />
                            {t("teams.usedByRecipes")}
                          </span>
                          <span className="cook-cap-row__value">−{usedByRecipes}</span>
                        </li>
                        {/* Fillers total row */}
                        <li className="cook-cap-row cook-cap-row--total">
                          <span className="cook-cap-row__label">
                            {t("teams.fillersLabel")}
                          </span>
                          <span className="cook-cap-row__value">{totalFillers}</span>
                        </li>
                      </ul>
                    </div>

                    {/* Missing ingredients zone (kept visible, placed after capacity) */}
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
                                  {t("teams.missingAmt", { n: fmt(Math.abs(b.balance) * factor) })}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {/* Block 3 — Fillers (slot-based allocation, sorted by strength) */}
                    {fillerAllocation.length > 0 && (
                      <div className="cook-result-block">
                        <div className="prod-card__block-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>{t("teams.fillersLabel")}</span>
                          {fillerStrength > 0 && (
                            <span style={{ color: "var(--moon-dim)", display: "inline-flex", alignItems: "center", gap: "0.2rem", fontWeight: 400, fontSize: "var(--text-xs)" }}>
                              <img
                                className="mini-icon"
                                src={CHARGE_STRENGTH_ICON}
                                alt=""
                                style={{ width: 13, height: 13, opacity: 0.7 }}
                              />
                              <span style={{ color: "var(--moon)", opacity: 0.8 }}>
                                {fmtInt(fillerStrength * factor)}
                              </span>
                            </span>
                          )}
                        </div>
                        <ul className="cook-filler-list">
                          {fillerAllocation.map(({ ingredient, balance, usedUnits }) => {
                            const isUsed = usedUnits > 0;
                            return (
                              <li
                                key={ingredient}
                                className={`cook-filler-item${isUsed ? "" : " cook-filler-item--unused"}`}
                              >
                                <span className="cook-filler-item__info">
                                  <img
                                    className="mini-icon"
                                    src={ingredientIcon(ingredient)}
                                    alt={ingName(ingredient)}
                                    title={ingName(ingredient)}
                                    style={{ width: 18, height: 18 }}
                                  />
                                  <span>{ingName(ingredient)}</span>
                                </span>
                                <span className="cook-filler-item__qty">
                                  <span className="muted">{fmt(balance * factor)}</span>
                                  {isUsed && (
                                    <IconCheck
                                      width={13}
                                      height={13}
                                      style={{ color: "var(--up)" }}
                                    />
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Block 4 — Grand total with +10% Extra Tasty */}
                    {(() => {
                      const subtotal = (result.cooking_strength + fillerStrength) * factor;
                      const extraTastyBonus = subtotal * 0.10;
                      const grandTotal = subtotal * 1.10;
                      return (
                        <div className="cook-result-block">
                          <div className="cook-total-row">
                            <span className="cook-total-row__label">
                              {t("teams.recipes")}
                            </span>
                            <span className="cook-total-row__value">
                              {fmtInt(result.cooking_strength * factor)}
                            </span>
                          </div>
                          <div className="cook-total-row">
                            <span className="cook-total-row__label">
                              {t("teams.fillersLabel")}
                            </span>
                            <span className="cook-total-row__value">
                              {fmtInt(fillerStrength * factor)}
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
                              +{fmtInt(extraTastyBonus)}
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
                              {fmtInt(grandTotal)}
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
