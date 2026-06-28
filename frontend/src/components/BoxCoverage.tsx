import { berryIcon } from "../berries";
import { INGREDIENT_UNLOCK_LEVELS } from "../constants";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import type { Catalog, Member } from "../types";

interface Props {
  members: Member[];
  catalog: Catalog;
}

// Cobertura del equipo: en vez de frecuencias, responde "¿qué tengo cubierto y qué
// me falta?". Tres bloques: conteo por especialidad, y la cobertura de bayas /
// ingredientes de los especialistas correspondientes (íconos cubiertos vs.
// atenuados). Se calcula en el cliente con el catálogo + la caja.
export function BoxCoverage({ members, catalog }: Props) {
  const { t, specialty, berry, ingredient } = useI18n();

  const speciesByName = new Map(catalog.species.map((s) => [s.name, s]));
  const specialtyOf = (m: Member) => speciesByName.get(m.species)?.specialty;

  // Conteo por especialidad (en el orden del juego; 0 se muestra explícito).
  const SPECIALTIES = ["Berries", "Ingredients", "Skills"];
  const specialtyCount = (sp: string) => members.filter((m) => specialtyOf(m) === sp).length;

  // Universo de bayas del catálogo y las cubiertas por los especialistas en Bayas.
  const allBerries = [...new Set(catalog.species.map((s) => s.berry))].sort();
  const coveredBerries = new Set(
    members
      .filter((m) => specialtyOf(m) === "Berries")
      .map((m) => speciesByName.get(m.species)?.berry)
      .filter((b): b is string => !!b),
  );

  // Ingredientes que cargan los especialistas en Ingredientes, contando solo los
  // slots ya desbloqueados por nivel (un slot bloqueado todavía no produce).
  const coveredIngredients = new Set(
    members
      .filter((m) => specialtyOf(m) === "Ingredients")
      .flatMap((m) =>
        m.ingredients.filter((_, i) => m.level >= (INGREDIENT_UNLOCK_LEVELS[i] ?? 1)),
      ),
  );
  // Universo alcanzable: ingredientes que ALGUNA especie con especialidad
  // Ingredientes puede cargar (no los 19 del juego, que harían el 100% imposible).
  const reachableIngredients = [
    ...new Set(
      catalog.species
        .filter((s) => s.specialty === "Ingredients")
        .flatMap((s) => s.ingredient_slots.flat()),
    ),
  ].sort();

  const berrySpecialists = specialtyCount("Berries");
  const ingredientSpecialists = specialtyCount("Ingredients");

  return (
    <section className="distributions">
      <h2>{t("box.coverageTitle")}</h2>

      {/* Especialidades: tres conteos (la ausencia, 0, es información). */}
      <div className="card coverage-block">
        <h3 className="coverage-block__head">{t("box.coverageSpecialties")}</h3>
        <div className="specialties-count">
          {SPECIALTIES.map((sp) => (
            <div key={sp} className="specialties-count__item">
              <span className="specialties-count__number">{specialtyCount(sp)}</span>
              <span className="muted">{specialty(sp)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cobertura de bayas de los especialistas en Bayas. */}
      <div className="card coverage-block">
        <h3 className="coverage-block__head">
          {t("box.coverageBerries")}{" "}
          <span className="muted">
            {t("box.coverageCount", { covered: coveredBerries.size, total: allBerries.length })}
          </span>
        </h3>
        {berrySpecialists === 0 ? (
          <p className="muted">{t("box.noBerrySpecialists")}</p>
        ) : (
          <div className="coverage-grid">
            {allBerries.map((b) => {
              const covered = coveredBerries.has(b);
              return (
                <img
                  key={b}
                  className={"coverage-icon" + (covered ? "" : " coverage-icon--missing")}
                  src={berryIcon(b)}
                  alt={berry(b)}
                  title={covered ? berry(b) : t("box.coverageMissing", { name: berry(b) })}
                  loading="lazy"
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Cobertura de ingredientes de los especialistas en Ingredientes. */}
      <div className="card coverage-block">
        <h3 className="coverage-block__head">
          {t("box.coverageIngredients")}{" "}
          <span className="muted">
            {t("box.coverageCount", {
              covered: coveredIngredients.size,
              total: reachableIngredients.length,
            })}
          </span>
        </h3>
        {ingredientSpecialists === 0 ? (
          <p className="muted">{t("box.noIngredientSpecialists")}</p>
        ) : (
          <div className="coverage-grid">
            {reachableIngredients.map((ing) => {
              const covered = coveredIngredients.has(ing);
              return (
                <img
                  key={ing}
                  className={"coverage-icon" + (covered ? "" : " coverage-icon--missing")}
                  src={ingredientIcon(ing)}
                  alt={ingredient(ing)}
                  title={covered ? ingredient(ing) : t("box.coverageMissing", { name: ingredient(ing) })}
                  loading="lazy"
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
