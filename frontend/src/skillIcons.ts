import type { ComponentType, SVGProps } from "react";

import { IconMagnifier, IconPot, IconSparkle, IconStrength } from "./components/icons";
import { statIcon } from "./natures";
import {
  boostsTastyChance,
  chargesSelfEnergy,
  cheersRandomEnergy,
  drawsIngredients,
  isExtraHelpful,
  magnetsDreamShards,
  magnetsIngredients,
  powersUpCooking,
  restoresTeamEnergy,
} from "./skills";

// Ícono representativo de cada familia de main skill. Reusa exactamente los mismos
// íconos que ProductionCard muestra por efecto, para que una skill se lea igual en
// el picker y en la comparación. Es un descriptor (sprite del juego vs. ícono de
// línea) que el componente renderiza.
export type SkillIcon =
  | { kind: "img"; src: string }
  | { kind: "svg"; Component: ComponentType<SVGProps<SVGSVGElement>> };

export function mainSkillIcon(mainSkill: string | undefined): SkillIcon {
  // Consigue ingredientes (Ingredient Magnet / Ingredient Draw) → manzana.
  if (drawsIngredients(mainSkill) || magnetsIngredients(mainSkill))
    return { kind: "img", src: statIcon("Ingredient Finding") };
  // Restaura energía (Energy for Everyone / Charge Energy / Energizing Cheer) → carita.
  if (restoresTeamEnergy(mainSkill) || chargesSelfEnergy(mainSkill) || cheersRandomEnergy(mainSkill))
    return { kind: "img", src: statIcon("Energy Recovery") };
  if (powersUpCooking(mainSkill)) return { kind: "svg", Component: IconPot };
  // (Random)/(Stockpile) también empiezan con "Charge Strength".
  if (mainSkill?.startsWith("Charge Strength")) return { kind: "svg", Component: IconStrength };
  if (magnetsDreamShards(mainSkill)) return { kind: "img", src: "/shard.png" };
  if (boostsTastyChance(mainSkill)) return { kind: "img", src: "/extra-tasty.png" };
  if (isExtraHelpful(mainSkill)) return { kind: "svg", Component: IconMagnifier };
  // Metronome y cualquier skill futura sin ícono propio: el destello genérico de
  // activación de skill (el mismo que ProductionCard usa para los disparos).
  return { kind: "svg", Component: IconSparkle };
}
