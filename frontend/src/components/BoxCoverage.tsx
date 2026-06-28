import { berryIcon } from "../berries";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { mainIngredient } from "../ingredientProduction";
import { contributesBerryRole, producesIngredients } from "../skills";
import type { Catalog, Member } from "../types";

interface Props {
  members: Member[];
  catalog: Catalog;
}

// Cobertura del equipo: en vez de frecuencias, responde "¿qué tengo cubierto y qué
// me falta?". Conteo por especialidad + cobertura de bayas e ingredientes. Lo que
// "cuenta" no es solo la especialidad: un Pokémon de especialidad Skills cuya
// habilidad cumple ese rol también suma (Crustle/Plusle juntan ingredientes;
// Noivern/Sceptile cumplen el rol de bayas). Se calcula en el cliente.
export function BoxCoverage({ members, catalog }: Props) {
  const { t, specialty, berry, ingredient } = useI18n();

  const speciesByName = new Map(catalog.species.map((s) => [s.name, s]));
  const specialtyOf = (m: Member) => speciesByName.get(m.species)?.specialty;
  const skillOf = (m: Member) => speciesByName.get(m.species)?.main_skill;

  // Conteo por especialidad (en el orden del juego; 0 se muestra explícito).
  const SPECIALTIES = ["Berries", "Ingredients", "Skills"];
  const specialtyCount = (sp: string) => members.filter((m) => specialtyOf(m) === sp).length;

  // Cobertura de BAYAS: cuenta su baya si es especialista en Bayas, o si es
  // especialista en Skills y su habilidad cumple el rol de bayas (Charge Strength /
  // Berry Burst). Golem (Charge Strength pero especialidad Ingredientes) NO cuenta.
  const coversBerry = (m: Member): boolean => {
    const sp = specialtyOf(m);
    return sp === "Berries" || (sp === "Skills" && contributesBerryRole(skillOf(m)));
  };
  const allBerries = [...new Set(catalog.species.map((s) => s.berry))].sort();
  const coveredBerries = new Set(
    members
      .filter(coversBerry)
      .map((m) => speciesByName.get(m.species)?.berry)
      .filter((b): b is string => !!b),
  );

  // Cobertura de INGREDIENTES: cuenta su ingrediente PRINCIPAL (el de mayor
  // producción combinada base+skill) si es especialista en Ingredientes o su
  // habilidad produce ingredientes (Ingredient Draw/Magnet). Solo el principal: un
  // ingrediente secundario de baja producción (la hierba de Dragonite) no cuenta.
  const coversIngredient = (m: Member): boolean =>
    specialtyOf(m) === "Ingredients" || producesIngredients(skillOf(m));
  const allIngredients = catalog.ingredients;
  const coveredIngredients = new Set(
    members
      .filter(coversIngredient)
      .map((m) => (m.production ? mainIngredient(m.production) : null))
      .filter((i): i is string => !!i),
  );

  const berryContributors = members.filter(coversBerry).length;
  const ingredientContributors = members.filter(coversIngredient).length;

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
        {berryContributors === 0 ? (
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
              total: allIngredients.length,
            })}
          </span>
        </h3>
        {ingredientContributors === 0 ? (
          <p className="muted">{t("box.noIngredientSpecialists")}</p>
        ) : (
          <div className="coverage-grid">
            {allIngredients.map((ing) => {
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
