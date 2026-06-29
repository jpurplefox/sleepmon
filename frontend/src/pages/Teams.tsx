import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { api } from "../api/client";
import { BoxPicker } from "../components/BoxPicker";
import { Modal } from "../components/Modal";
import { ProductionCard } from "../components/ProductionCard";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { CHARGE_STRENGTH_ICON } from "../skillIcons";
import type { Catalog, MealInput, Member, MemberInput } from "../types";

const MAX_TEAM = 5;

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
const MAX_RECIPE_LEVEL = 70;
const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;

const fmt = (n: number) => n.toFixed(2);
const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export function Teams() {
  const { t, ingredient: ingName } = useI18n();

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: api.getRecipes });

  // Ordered list of selected member ids (capped at MAX_TEAM).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [meals, setMeals] = useState<(MealInput | null)[]>([null, null, null]);
  const [weekly, setWeekly] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const inTeam = useMemo(() => new Set(selectedIds), [selectedIds]);

  const teamQuery = useQuery({
    queryKey: ["team-production", selectedIds, meals],
    queryFn: () => api.computeTeamProduction({ member_ids: selectedIds, meals }),
    enabled: selectedIds.length > 0,
  });

  const factor = weekly ? 7 : 1;
  const result = teamQuery.data;

  // Recipes grouped by type for the meal selectors.
  const byType = useMemo(() => {
    const groups: Record<string, typeof recipes.data> = { Curry: [], Salad: [], Dessert: [] };
    for (const r of recipes.data ?? []) groups[r.type]?.push(r);
    return groups;
  }, [recipes.data]);

  // Lookup map: member id → Member.
  const memberById = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.id, m])),
    [members.data],
  );

  // Lookup map: recipe_name → met, from cooking_meals for the badge.
  const metByRecipe = useMemo(
    () => new Map((result?.cooking_meals ?? []).map((cm) => [cm.recipe_name, cm.met])),
    [result],
  );

  const pickMember = (m: Member) => {
    if (selectedIds.length >= MAX_TEAM) return;
    if (selectedIds.includes(m.id)) return;
    setSelectedIds((prev) => [...prev, m.id]);
    setPickerOpen(false);
  };

  const removeMember = (id: string) =>
    setSelectedIds((prev) => prev.filter((x) => x !== id));

  const setMeal = (slot: number, recipeName: string, level: number) => {
    setMeals((prev) => {
      const next = [...prev];
      next[slot] = recipeName ? { recipe: recipeName, level } : null;
      return next;
    });
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

      {/* ── Per-member cards (mirrors Production.tsx selection model) ── */}
      <div className="prod-cards">
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
        <div className="teams-aggregates">

          {/* Grand-total card with daily/weekly toggle */}
          <div className="card">
            <div className="teams-aggregates__header">
              <div className="prod-stat">
                <span className="prod-stat__label">{t("teams.grandTotal")}</span>
                <span className="prod-stat__value">
                  {fmtInt(result.grand_total_strength * factor)}
                </span>
              </div>
              {/* Diario / Semanal toggle */}
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

            {/* Berries & skills aggregates */}
            <div className="prod-card__block-head">{t("teams.berriesSkills")}</div>
            <div className="prod-card__line">
              <span>
                <img
                  className="mini-icon"
                  src={CHARGE_STRENGTH_ICON}
                  alt={t("teams.totalStrength")}
                  title={t("teams.totalStrength")}
                />{" "}
                {fmtInt(result.total_strength * factor)}
              </span>
            </div>
            <div className="prod-card__line">
              <span>{t("teams.berries")} {fmt(result.total_berry_amount * factor)}</span>
              <span>{t("teams.skillTriggers")} {fmt(result.skill_triggers * factor)}</span>
            </div>

            {/* Optional skill aggregates */}
            {result.skill_energy != null && (
              <div className="prod-card__line">
                <span className="muted">{t("card.energyEach")}</span>
                <span>{fmt(result.skill_energy * factor)}</span>
              </div>
            )}
            {result.skill_self_energy != null && (
              <div className="prod-card__line">
                <span className="muted">{t("card.selfEnergy")}</span>
                <span>{fmt(result.skill_self_energy * factor)}</span>
              </div>
            )}
            {result.skill_dream_shards != null && (
              <div className="prod-card__line">
                <span className="muted">{t("card.dreamShards")}</span>
                <span>{fmtInt(result.skill_dream_shards * factor)}</span>
              </div>
            )}
            {result.skill_cooking_ingredients != null && (
              <div className="prod-card__line">
                <span className="muted">{t("card.cookingExtra")}</span>
                <span>{fmt(result.skill_cooking_ingredients * factor)}</span>
              </div>
            )}
            {result.skill_ingredient_total != null && (
              <div className="prod-card__line">
                <span className="muted">{t("card.randomIngredients")}</span>
                <span>{fmt(result.skill_ingredient_total * factor)}</span>
              </div>
            )}
            {result.skill_extra_helpful != null && (
              <div className="prod-card__line">
                <span className="muted">{t("card.helpMult")}</span>
                <span>{fmt(result.skill_extra_helpful * factor)}</span>
              </div>
            )}
            {result.skill_random_energy != null && (
              <div className="prod-card__line">
                <span className="muted">{t("card.randomEnergy")}</span>
                <span>{fmt(result.skill_random_energy * factor)}</span>
              </div>
            )}
            {result.skill_tasty_chance != null && (
              <div className="prod-card__line">
                <span className="muted">{t("card.extraTasty")}</span>
                <span>+{fmtInt(result.skill_tasty_chance * factor)}%</span>
              </div>
            )}

            {/* Team ingredients produced */}
            {result.ingredients.length > 0 && (
              <>
                <div className="prod-card__block-head" style={{ marginTop: "0.75rem" }}>
                  {t("teams.ingredients")}
                </div>
                <ul className="prod-card__ings">
                  {result.ingredients.map((ing) => (
                    <li key={ing.ingredient}>
                      <img
                        className="mini-icon"
                        src={ingredientIcon(ing.ingredient)}
                        alt={ingName(ing.ingredient)}
                        title={ingName(ing.ingredient)}
                      />
                      <strong>{fmt(ing.amount * factor)}</strong>
                    </li>
                  ))}
                </ul>
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
            <h2 style={{ margin: "0 0 1rem" }}>{t("teams.cooking")}</h2>

            {MEAL_SLOTS.map((slot, idx) => {
              const chosenRecipe = meals[idx]?.recipe ?? "";
              const met = chosenRecipe ? metByRecipe.get(chosenRecipe) : undefined;
              return (
                <div key={slot} className="teams-meal">
                  {/* Recipe select */}
                  <label className="form" style={{ marginBottom: 0 }}>
                    <span className="muted" style={{ fontSize: "var(--text-sm)" }}>
                      {t(`teams.${slot}`)}
                    </span>
                    <select
                      value={chosenRecipe}
                      onChange={(e) =>
                        setMeal(idx, e.target.value, meals[idx]?.level ?? 1)
                      }
                    >
                      <option value="">{t("teams.noRecipe")}</option>
                      {Object.entries(byType).map(([type, list]) => (
                        <optgroup key={type} label={type}>
                          {(list ?? []).map((r) => (
                            <option key={r.name} value={r.name}>
                              {r.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>

                  {/* Recipe level — space always reserved to avoid layout jump */}
                  <span className="teams-meal__level">
                    <span className="muted">{t("teams.recipeLevel")}</span>
                    <input
                      type="number"
                      min={1}
                      max={MAX_RECIPE_LEVEL}
                      value={meals[idx]?.level ?? 1}
                      disabled={!chosenRecipe}
                      onChange={(e) =>
                        setMeal(
                          idx,
                          meals[idx]?.recipe ?? "",
                          Math.max(1, Math.min(MAX_RECIPE_LEVEL, Number(e.target.value))),
                        )
                      }
                    />
                  </span>

                  {/* Met badge — space always reserved */}
                  <span style={{ minWidth: "7rem" }}>
                    {met != null && (
                      <span className={met ? "badge badge--ok" : "badge badge--low"}>
                        {met ? t("teams.met") : t("teams.notMet")}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}

            {/* Cooking strength */}
            <div className="prod-card__line" style={{ marginTop: "0.75rem" }}>
              <span className="muted">{t("teams.cookingStrength")}</span>
              <span>{fmtInt(result.cooking_strength * factor)}</span>
            </div>

            {/* Ingredient balance — always visible */}
            {result.cooking_ingredients.length > 0 && (
              <>
                <div className="prod-card__block-head" style={{ marginTop: "0.75rem" }}>
                  {t("teams.ingredients")}
                  <span className="muted" style={{ fontSize: "var(--text-xs)", marginLeft: "0.5rem" }}>
                    {t("teams.required")} / {t("teams.produced")} / {t("teams.balance")}
                  </span>
                </div>
                <ul className="teams-balance">
                  {result.cooking_ingredients.map((b) => {
                    const delta = b.balance * factor;
                    return (
                      <li key={b.ingredient} className="teams-balance__row">
                        <img
                          className="mini-icon"
                          src={ingredientIcon(b.ingredient)}
                          alt={ingName(b.ingredient)}
                          title={ingName(b.ingredient)}
                          style={{ width: 20, height: 20 }}
                        />
                        <span style={{ color: "var(--text)", fontSize: "var(--text-sm)" }}>
                          {ingName(b.ingredient)}
                        </span>
                        <span className="teams-balance__num">{fmt(b.required * factor)}</span>
                        <span className="teams-balance__num">{fmt(b.produced * factor)}</span>
                        <span
                          className={
                            "teams-balance__delta " +
                            (delta >= 0
                              ? "teams-balance__delta--up"
                              : "teams-balance__delta--down")
                          }
                        >
                          {delta >= 0 ? "+" : ""}
                          {fmt(delta)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {/* Surplus */}
            {result.cooking_surplus.length > 0 && (
              <>
                <div className="prod-card__block-head" style={{ marginTop: "0.75rem" }}>
                  {t("teams.surplus")}
                </div>
                <ul className="prod-card__ings">
                  {result.cooking_surplus.map((b) => (
                    <li key={b.ingredient}>
                      <img
                        className="mini-icon"
                        src={ingredientIcon(b.ingredient)}
                        alt={ingName(b.ingredient)}
                        title={ingName(b.ingredient)}
                      />
                      <strong>{fmt(b.balance * factor)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
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
    </div>
  );
}
