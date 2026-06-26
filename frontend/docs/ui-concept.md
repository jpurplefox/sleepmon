# sleepmon — UI Concept: "Luz de luna"

> Documento vivo. Guía todas las rondas del loop UX/UI. Cualquier cambio visual
> debe reforzar este concepto; si agrega complejidad sin reforzarlo, no se hace.

## La idea en una frase

Una app de seguimiento de equipos que vive en la noche: oscura y quieta como el
sueño, con un único acento cálido (la luna) que señala lo que importa.

## El giro propio

No es un dark mode genérico. El giro es la **asimetría cromática deliberada**:
fondo frío (azul marino profundo) + un único acento cálido (dorado lunar). El
índigo pasa a ser color **funcional** (selección / foco / estado activo), no
decorativo. El oro es el único color con "voz propia": lo que brilla en la
oscuridad. Nace del juego: Pokémon Sleep gira alrededor de la luna, la noche y la
producción nocturna — todo lo valioso es cálido dentro de lo oscuro.

## Paleta (tokens)

```css
/* Fondos — frío, profundo */
--bg:        #0d1117;
--surface:   #161b22;
--surface-2: #21262d;
--border:    #30363d;

/* Texto */
--text:      #e6edf3;
--muted:     #8b949e;

/* Acento funcional — índigo (selección, foco, estado activo) */
--accent:        #6366f1;
--accent-strong: #4f46e5;
--accent-dim:    rgba(99, 102, 241, 0.15);

/* Acento identidad — dorado lunar (único color "caliente" permitido) */
--moon:     #d4a017;
--moon-dim: rgba(212, 160, 23, 0.15);

/* Semántico — naturalezas y errores */
--up:    #3fb950;   /* stat que sube */
--down:  #f78166;   /* stat que baja */
--error: #f85149;

/* Tiers de sub skills */
--tier-gold:    #d4a017;  /* el gold del juego = la luna */
--tier-blue:    #58a6ff;
--tier-regular: #8b949e;

/* Superficies elevadas */
--overlay:         rgba(13, 17, 23, 0.75);
--shadow-dropdown: 0 8px 24px rgba(0, 0, 0, 0.5);
```

Regla: máximo **2 colores con voz** por pantalla (`--moon` y `--accent`). El resto
son funcionales o semánticos.

## Escala tipográfica (5 tamaños, por rol)

```
--text-xs:   0.72rem   /* labels uppercase, badges, tooltips */
--text-sm:   0.82rem   /* metadatos secundarios, opciones de dropdown */
--text-base: 0.9rem    /* texto de UI, labels de form, botones */
--text-lg:   1.1rem    /* nombres de Pokémon, títulos de sección menores */
--text-xl:   1.6rem    /* h1 de página, KPI principal */
```

Los tamaños intermedios se consolidan al más cercano de la escala.

## Radios (3 + pill)

```
--r-sm: 6px    /* chips, badges, elementos pequeños dentro de dropdown */
--r-md: 10px   /* inputs, botones, items de lista, cards internas */
--r-lg: 14px   /* cards principales, modales, dropdowns */
```

`border-radius: 999px` solo para pills (level-chip, badges de nivel).

## Espaciado

Unidad base de 4px; los valores son múltiplos. No se introducen tokens de
espaciado: la grilla de 4px es guía mental.

## "Voz" visual

- **Quieta y directa**: sin animaciones salvo transiciones de color en hover (≤120ms).
- **Jerarquía por peso, no por color**: el dorado se reserva para los valores que
  importan (KPI de producción, nivel). El índigo solo para activo/selección.
- **Los sprites y los íconos del juego son el dibujo de la app**; tipografía y
  componentes son el marco neutro que los sostiene.

## Micro-decisión por pantalla

- **Team**: el badge de nivel (`Nv. XX`) es el único elemento dorado de la card
  (`color: var(--moon)`, `border-color: var(--moon-dim)`). Resalta el dato clave
  de un vistazo.
- **Production**: el `berry_amount` es el KPI de la comparación → `--text-xl` +
  `color: var(--moon)`. El resto de números van en `--text-base` / `--text`.

## Anti-objetivos

1. Nada de glassmorphism, gradientes cargados, sombras dramáticas, animaciones de más.
2. Ningún componente "espectacular" que rompa la coherencia del resto.
3. Token nuevo solo si se justifica y se elimina uno que sobre. Preferir borrar a agregar.
4. Los emojis no son el lenguaje visual de la app (los sprites sí): se evitan en
   títulos de página y líneas de datos, reemplazados por texto o íconos del sistema.
