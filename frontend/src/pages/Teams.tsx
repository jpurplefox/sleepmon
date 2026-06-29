import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { api } from "../api/client";
import { BoxPicker } from "../components/BoxPicker";
import { Modal } from "../components/Modal";
import { useI18n } from "../i18n";
import { spriteUrl } from "../sprites";
import type { MealInput, Member, Recipe } from "../types";

const MAX_TEAM = 5;
const MAX_RECIPE_LEVEL = 70;
const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;

export function Teams() {
  const { t } = useI18n();

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: api.getRecipes });

  // List of selected member ids (capped at MAX_TEAM).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [meals, setMeals] = useState<(MealInput | null)[]>([null, null, null]);
  const [weekly, setWeekly] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Set of currently-selected ids, to pass as inComparison to BoxPicker so
  // already-added members show as disabled (matches Production.tsx pattern).
  const inTeam = useMemo(() => new Set(selectedIds), [selectedIds]);

  const teamQuery = useQuery({
    queryKey: ["team-production", selectedIds, meals],
    queryFn: () =>
      api.computeTeamProduction({ member_ids: selectedIds, meals }),
    enabled: selectedIds.length > 0,
  });

  const factor = weekly ? 7 : 1;
  const result = teamQuery.data;

  // Recipes grouped by type for the meal selectors.
  const byType = useMemo(() => {
    const groups: Record<string, Recipe[]> = { Curry: [], Salad: [], Dessert: [] };
    for (const r of recipes.data ?? []) groups[r.type]?.push(r);
    return groups;
  }, [recipes.data]);

  // Lookup map: member id → Member, for rendering selected members' sprites.
  const memberById = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.id, m])),
    [members.data],
  );

  // Lookup map: species → dex number, for sprites.
  const dexBySpecies = useMemo(
    () => new Map((catalog.data?.species ?? []).map((s) => [s.name, s.dex])),
    [catalog.data],
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

      {/* Selected team row */}
      <div className="teams-roster">
        {selectedIds.map((id) => {
          const m = memberById.get(id);
          if (!m) return null;
          const dex = dexBySpecies.get(m.species) ?? 0;
          return (
            <div key={id} className="teams-roster__slot">
              <img
                className="sprite"
                src={spriteUrl(dex)}
                alt={m.species}
                title={m.species}
              />
              <span className="badge badge--level">{t("common.level", { level: m.level })}</span>
              <button
                type="button"
                className="btn btn--ghost teams-roster__remove"
                aria-label={t("teams.removeMember", { species: m.species })}
                onClick={() => removeMember(id)}
              >
                ×
              </button>
            </div>
          );
        })}
        {!atMax && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setPickerOpen(true)}
          >
            {t("teams.addPokemon")}
          </button>
        )}
        {atMax && <p className="muted">{t("teams.atMax")}</p>}
      </div>

      {selectedIds.length === 0 ? (
        <p className="teams__empty muted">{t("teams.empty")}</p>
      ) : (
        <>
          {/* Daily / Weekly toggle */}
          <div className="teams__toggle" role="group" aria-label={t("teams.toggleLabel")}>
            <button
              type="button"
              className={"btn" + (!weekly ? " btn--primary" : " btn--ghost")}
              aria-pressed={!weekly}
              onClick={() => setWeekly(false)}
            >
              {t("teams.daily")}
            </button>
            <button
              type="button"
              className={"btn" + (weekly ? " btn--primary" : " btn--ghost")}
              aria-pressed={weekly}
              onClick={() => setWeekly(true)}
            >
              {t("teams.weekly")}
            </button>
          </div>

          {teamQuery.isLoading && (
            <p className="muted">{t("teams.calculating")}</p>
          )}

          {result && (
            <div className="teams-panels">
              {/* Grand total */}
              <p className="teams__grandtotal">
                <strong>{t("teams.grandTotal")}:</strong>{" "}
                {Math.round(result.grand_total_strength * factor).toLocaleString()}
              </p>

              {/* Panel 1: Berries & skills */}
              <section className="teams__panel">
                <h2>{t("teams.berriesSkills")}</h2>
                <dl className="teams-stat-list">
                  <dt>{t("teams.totalStrength")}</dt>
                  <dd>{Math.round(result.total_strength * factor).toLocaleString()}</dd>
                  <dt>{t("teams.berries")}</dt>
                  <dd>{(result.total_berry_amount * factor).toFixed(1)}</dd>
                  <dt>{t("teams.skillTriggers")}</dt>
                  <dd>{(result.skill_triggers * factor).toFixed(1)}</dd>
                </dl>

                {result.ingredients.length > 0 && (
                  <>
                    <h3>{t("teams.ingredients")}</h3>
                    <ul className="teams-inglist">
                      {result.ingredients.map((i) => (
                        <li key={i.ingredient}>
                          <span>{i.ingredient}</span>
                          <span>{(i.amount * factor).toFixed(1)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <h3>{t("teams.perMember")}</h3>
                <ul className="teams-memberlist">
                  {result.members.map((m) => {
                    const member = memberById.get(m.member_id);
                    const dex = dexBySpecies.get(m.species) ?? 0;
                    return (
                      <li key={m.member_id} className="teams-memberlist__row">
                        <img
                          className="sprite sprite--small"
                          src={spriteUrl(dex)}
                          alt=""
                        />
                        <span>{m.species}</span>
                        <span className="muted">
                          {member ? t("common.level", { level: member.level }) : ""}
                        </span>
                        <span>{Math.round(m.strength * factor).toLocaleString()}</span>
                      </li>
                    );
                  })}
                </ul>

                {result.excluded_count > 0 && (
                  <p className="teams__excluded muted">
                    {t("teams.excluded", { count: result.excluded_count })}
                  </p>
                )}
              </section>

              {/* Panel 2: Cooking */}
              <section className="teams__panel">
                <h2>{t("teams.cooking")}</h2>

                <div className="teams-meals">
                  {MEAL_SLOTS.map((slot, idx) => (
                    <div key={slot} className="teams__meal">
                      <label className="teams__meal-label">
                        {t(`teams.${slot}`)}
                        <select
                          className="teams__meal-select"
                          value={meals[idx]?.recipe ?? ""}
                          onChange={(e) =>
                            setMeal(idx, e.target.value, meals[idx]?.level ?? 1)
                          }
                        >
                          <option value="">{t("teams.noRecipe")}</option>
                          {Object.entries(byType).map(([type, list]) => (
                            <optgroup key={type} label={type}>
                              {list.map((r) => (
                                <option key={r.name} value={r.name}>
                                  {r.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      {meals[idx] && (
                        <label className="teams__meal-level-label">
                          {t("teams.recipeLevel")}
                          <input
                            type="number"
                            className="teams__meal-level"
                            min={1}
                            max={MAX_RECIPE_LEVEL}
                            value={meals[idx]?.level ?? 1}
                            onChange={(e) =>
                              setMeal(
                                idx,
                                meals[idx]!.recipe,
                                Math.max(1, Math.min(MAX_RECIPE_LEVEL, Number(e.target.value))),
                              )
                            }
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>

                <dl className="teams-stat-list">
                  <dt>{t("teams.cookingStrength")}</dt>
                  <dd>{Math.round(result.cooking_strength * factor).toLocaleString()}</dd>
                </dl>

                {result.cooking_ingredients.length > 0 && (
                  <>
                    <h3>{t("teams.ingredients")}</h3>
                    <table className="teams-balance-table">
                      <thead>
                        <tr>
                          <th>{t("teams.ingredients")}</th>
                          <th>{t("teams.required")}</th>
                          <th>{t("teams.produced")}</th>
                          <th>{t("teams.balance")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.cooking_ingredients.map((b) => (
                          <tr
                            key={b.ingredient}
                            className={b.balance >= 0 ? "teams-balance--ok" : "teams-balance--low"}
                          >
                            <td>{b.ingredient}</td>
                            <td>{(b.required * factor).toFixed(1)}</td>
                            <td>{(b.produced * factor).toFixed(1)}</td>
                            <td>{(b.balance * factor).toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {result.cooking_surplus.length > 0 && (
                  <>
                    <h3>{t("teams.surplus")}</h3>
                    <ul className="teams-inglist">
                      {result.cooking_surplus.map((b) => (
                        <li key={b.ingredient}>
                          <span>{b.ingredient}</span>
                          <span>{(b.balance * factor).toFixed(1)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </div>
          )}
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
    </div>
  );
}
