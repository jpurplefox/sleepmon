import { useId, type SVGProps } from "react";

/**
 * Íconos de línea coherentes (trazo currentColor, mismo estilo que el lápiz de
 * editar). Resumen cada métrica de la card sin recurrir a emojis. Tamaño por
 * defecto 14px; se puede sobreescribir vía props.
 */
const base = {
  viewBox: "0 0 24 24",
  width: 14,
  height: 14,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// Filled glyphs for the production card's metrics: the same drawings as the
// stat and sub-skill icons (stopwatch = help speed, backpack = inventory), in
// currentColor so the card can mute them. Masks get a per-instance id.
const filled = {
  viewBox: "0 0 24 24",
  width: 14,
  height: 14,
  fill: "currentColor",
  "aria-hidden": true,
};

const useMaskId = () => useId().replace(/:/g, "");

// Help cadence.
export function IconStopwatch(props: SVGProps<SVGSVGElement>) {
  const id = useMaskId();
  return (
    <svg {...filled} {...props}>
      <mask id={id}>
        <circle cx="12" cy="13.6" r="8.6" fill="#fff" />
        <path d="M12 13.6V8.9M12 13.6l3.4 2.6" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      </mask>
      <rect x="10.2" y="1.8" width="3.6" height="2.2" rx=".6" />
      <rect x="11.2" y="3.6" width="1.6" height="2" />
      <circle cx="12" cy="13.6" r="8.6" mask={`url(#${id})`} />
    </svg>
  );
}

// Helps: a hand offering what it gathered.
export function IconHelp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...filled} {...props}>
      <circle cx="15.2" cy="4.6" r="2.9" />
      <path d="M1.5 14.2h4.8c1.5 0 2.6-.5 3.6-1.3l2.6-2c.9-.7 2.2-.5 2.8.4.5.8.3 1.8-.4 2.4l-2.2 1.9h4.6l3.2-2.5c.8-.6 2-.5 2.6.3.6.8.4 1.9-.3 2.5l-4.5 3.9c-.9.8-2 1.2-3.2 1.2H1.5z" />
    </svg>
  );
}

// Inventory capacity.
export function IconBackpack(props: SVGProps<SVGSVGElement>) {
  const id = useMaskId();
  return (
    <svg {...filled} {...props}>
      <mask id={id}>
        <rect x="3.5" y="7" width="17" height="15" rx="3.2" fill="#fff" />
        <rect x="3" y="11.4" width="18" height="1.4" fill="#000" />
        <circle cx="12" cy="12.1" r="3.3" fill="#000" />
        <circle cx="12" cy="12.1" r="2.3" fill="#fff" />
        <circle cx="12" cy="12.1" r="1" fill="#000" />
      </mask>
      <path d="M8.5 7.5V6a3.5 3.5 0 0 1 7 0v1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="3.5" y="7" width="17" height="15" rx="3.2" mask={`url(#${id})`} />
    </svg>
  );
}

// Time until the inventory is full.
export function IconHourglass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...filled} {...props}>
      <rect x="5" y="1.5" width="14" height="2.4" rx="1.2" />
      <rect x="5" y="20.1" width="14" height="2.4" rx="1.2" />
      <path d="M7.2 4.6h9.6v1.8c0 1.2-.5 2.3-1.3 3.1L12.6 12l2.9 2.5c.8.8 1.3 1.9 1.3 3.1v1.8H7.2v-1.8c0-1.2.5-2.3 1.3-3.1L11.4 12 8.5 9.5C7.7 8.7 7.2 7.6 7.2 6.4z" />
    </svg>
  );
}

// A box of unknown contents (random ingredients). Line icon.
export function IconPackage(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

// Skill / activación de la habilidad principal.
export function IconSparkle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3Z" />
    </svg>
  );
}

// Pote de cocina (Cooking Power-Up S): cuerpo con asas, tapa con perilla y vapor.
export function IconPot(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M9 2.5c-.6.6-.6 1.4 0 2" />
      <path d="M15 2.5c-.6.6-.6 1.4 0 2" />
      <path d="M4 9h16" />
      <path d="M12 6.5V9" />
      <path d="M5 9v6a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4V9" />
      <path d="M5 12H3M19 12h2" />
    </svg>
  );
}

// Ayuda extra (Extra Helpful): una lupa.
export function IconMagnifier(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

// Night (nighttime proc chance).
export function IconMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

// The nap: the daytime sleep, beside IconMoon's night.
export function IconSun(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

// Chevron hacia abajo: disparador de paneles desplegables (filtros con íconos).
export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// Dirección de orden ascendente: flecha hacia arriba (mismo trazo que el resto).
export function IconArrowUp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

// Dirección de orden descendente: flecha hacia abajo.
export function IconArrowDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

// Más acciones (menú overflow): tres puntos horizontales.
export function IconMore(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}

// Navigation menu (three bars), the app bar's tools on narrow screens.
export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

// Cerrar / quitar (cruz de línea, mismo trazo que el resto).
export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// Editar (lápiz).
export function IconEdit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// Clonar (dos rectángulos superpuestos).
export function IconCopy(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="8" width="14" height="14" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

// Check (ingrediente filler usado / slot cubierto).
export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Guardar en la caja (una caja con una flecha que entra hacia adentro).
export function IconSaveBox(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M12 7v6" />
      <path d="m9 10 3 3 3-3" />
    </svg>
  );
}

// Dividir slot: eje central con dos mitades a los lados.
export function IconSplit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v18" />
      <path d="M12 8a4 4 0 0 0-4-4H5v8h3a4 4 0 0 0 4-4Z" />
      <path d="M12 16a4 4 0 0 1 4-4h3v8h-3a4 4 0 0 1-4-4Z" />
    </svg>
  );
}

// Cerrar sesión (salir): puerta con flecha saliendo.
export function IconSignOut(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// Rising bars: what you have unlocked and levelled. The account menu's "Perfil de jugador".
export function IconProgress(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 20h18" />
      <path d="M6.5 20v-5" />
      <path d="M12 20v-9" />
      <path d="M17.5 20v-13" />
    </svg>
  );
}

// Language (signed-out language menu).
export function IconGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

// Alerta: triángulo con signo de exclamación (algo que no se está calculando).
export function IconAlert(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// Delete something saved (a trash can): unlike the cross, which takes a Pokémon out of a tool.
export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

// Open somewhere else (a box with an arrow leaving it).
export function IconOpen(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

// Compare (two columns side by side).
export function IconCompare(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" />
    </svg>
  );
}

// The signed-in account (head and shoulders).
export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

// ▲/▼ drawn, not typed: a text glyph sits wherever each device's font puts it.
// Each triangle is placed in its 10×10 box so the middle between its box and its
// centroid lands on the box's center — a triangle's weight is at its base, so
// centering by the box alone would read low (▲) or high (▼). Size it with CSS.
export function IconTriangle({ dir, ...props }: { dir: "up" | "down" } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 10 10" fill="currentColor" aria-hidden {...props}>
      <path d={dir === "up" ? "M5 0 10 8.6H0z" : "M0 1.4h10L5 10z"} />
    </svg>
  );
}
