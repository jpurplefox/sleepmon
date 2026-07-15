# sleepmon Design System — "Luz de luna"

> Living document. It holds both the **visual identity** (the concept) and the
> **reusable pieces** (tokens + components) that implement it. Every visual change
> must reinforce the concept; anything that adds complexity without reinforcing it
> is not done. This is the single source the visual work reads from and grows.

---

## 1. Concept (identity)

**In one line:** a team-tracking app that lives at night — dark and still like
sleep, with a single warm accent (the moon) marking what matters.

**The twist:** not a generic dark mode. The move is a **deliberate chromatic
asymmetry** — a cold background (deep navy) plus a single warm accent (moon gold).
Indigo becomes a **functional** color (selection / focus / active state), never
decorative. Gold is the only color with "its own voice": what glows in the dark.
It comes from the game — Pokémon Sleep revolves around the moon, night, and
nighttime production; everything valuable is warm inside the dark.

**Voice:**
- **Still, but not frozen** — motion is allowed only when it does a job: state
  feedback (the saving pulse), the entrance of new content (modals, production
  cards), or a hover/selection transition. It stays short and sober (~80–150ms for
  micro-interactions and entrances; the only loop is the saving pulse, and it *is*
  the feedback), and always honors `prefers-reduced-motion`. Nothing moves to
  decorate.
- **Hierarchy by weight, not color** — gold is reserved for very few identity
  accents; indigo only for active/selection. When there is no real KPI, blocks
  share equal hierarchy (don't invent a "main number" where there isn't one).
- **The game's sprites and icons are the app's artwork**; type and components are
  the neutral frame that holds them.

**Anti-goals:**
1. No glassmorphism, heavy gradients, dramatic shadows, or decorative/dramatic
   animation (functional motion is fine — see Voice).
2. No "spectacular" component that breaks the coherence of the rest.
3. A new token only if justified — and remove one that's redundant. Prefer
   deleting to adding.
4. Emojis are not the app's visual language (the sprites are): avoid them in page
   titles and data lines; use text or system icons instead.

---

## 2. Tokens

**Palette** — max **2 "voiced" colors per screen** (`--moon` and `--accent`); the
rest are functional or semantic.

```css
/* Backgrounds — cold, deep */
--bg:        #0d1117;
--surface:   #161b22;
--surface-2: #21262d;
--border:    #30363d;

/* Text */
--text:      #e6edf3;
--muted:     #8b949e;

/* Functional accent — indigo. Two roles, because contrast pulls opposite
   ways: as FILL under white text vs as INK on the dark background. One value
   can't do both, so the palette splits the role, not the voice. */
--accent:        #6366f1;   /* fill / border / focus outline */
--accent-strong: #4f46e5;   /* fill under white text (primary button) */
--accent-dim:    rgba(99, 102, 241, 0.15);
--accent-text:   #818cf8;   /* indigo as text/icon on dark — AA (≥4.5:1) */

/* Identity accent — moon gold (the only "warm" color allowed) */
--moon:        #d4a017;
--moon-dim:    rgba(212, 160, 23, 0.15);
--moon-border: rgba(212, 160, 23, 0.4);

/* Semantic — natures and errors */
--up:    #3fb950;   /* stat that rises */
--down:  #f78166;   /* stat that falls */
--error: #f85149;

/* Sub-skill tiers — blue is the tier-specific color; the gold and regular
   tiers use --moon / --muted, mapped in .ss-icon */
--tier-blue: #58a6ff;

/* Elevated surfaces */
--overlay:         rgba(13, 17, 23, 0.75);
--shadow-dropdown: 0 8px 24px rgba(0, 0, 0, 0.5);
```

**Type scale** (5 sizes, by role — intermediate sizes snap to the nearest):

```
--text-xs:   0.72rem   /* uppercase labels, badges, tooltips */
--text-sm:   0.82rem   /* secondary metadata, dropdown options */
--text-base: 0.9rem    /* UI text, form labels, buttons */
--text-lg:   1.1rem    /* Pokémon names, minor section titles */
--text-xl:   1.6rem    /* page h1, primary KPI */
```

**Radii** (3 + pill):

```
--r-sm: 6px    /* chips, badges, small elements inside dropdowns */
--r-md: 10px   /* inputs, buttons, list items, inner cards */
--r-lg: 14px   /* main cards, modals, dropdowns */
```

`border-radius: 999px` only for pills (level chip, level badges).

**Spacing:** base unit of 4px; values are multiples. No spacing tokens — the 4px
grid is a mental guide.

---

## 3. Icon system

Two icon languages that never mix:

- **Game content** → sprites and official icons (ingredients, sub-skills, berries,
  stats). They are "the artwork" and keep their real color.
- **UI metrics & actions** → own line icons in `src/components/icons.tsx`:
  `currentColor`, `stroke-width: 2`, `viewBox 0 0 24 24`, 14px default, rounded
  caps/joins, `aria-hidden`. They inherit context color (dimmed to `--muted`, gold
  with `--moon` when they mean "the night"). **Never emojis.**

Current catalog: `IconClock`, `IconHelp`, `IconPackage`, `IconHourglass`,
`IconSparkle`, `IconPot`, `IconMagnifier`, `IconMoon`, `IconGrip`,
`IconChevronDown`, `IconArrowUp`, `IconArrowDown`, `IconMore`, `IconClose`,
`IconEdit`, `IconCopy`, `IconCheck`, `IconSaveBox`, `IconSplit`, `IconSignOut`. A new
UI icon is added here following the same stroke — no ad-hoc icons in components.

**Metric display.** A metric reads as **its own icon + the number** — the icon marks
the figure a line *reports*. Metrics with a
game icon use it (berry → its berry, ingredient → its ingredient, dream shards →
shard, strength → `CHARGE_STRENGTH_ICON`, cooking / pot expansion → `pot` /
`POT_EXPANSION_ICON`, extra tasty → its icon, energy → its stat icon). Metrics with
no game icon get one **designated** UI icon that stands for them, used the same way
everywhere: procs / triggers → `IconSparkle`, help cadence → `IconClock`, helps →
`IconHelp` (a helping hand), inventory fill time → `IconHourglass`, inventory
capacity → `IconPackage`, nighttime proc chance → `IconMoon`, help multiplier →
`IconMagnifier`.

Two kinds of figure stay **bare** (no metric icon):

- **Not a single metric.** A percentage, a count or ratio (coverage `X/Y`,
  filter/showing counts, `X/3`, pot `N/M`), or a level (`Lv N`) — no one icon fits.
  Exceptions: a percentage that is a skill mechanic with its own icon (extra tasty)
  keeps it, and the Pokémon-level badge keeps its gold (its own accent exception).
- **Feeds or derives from a reported metric.** The figures a breakdown decomposes
  into (a berry's count, a filler's base strength), a subtotal's total / closing
  row, a `×7` weekly projection — the icon rides the reported metric; these read as
  plain numbers beside it.

Edit steppers show nav arrows, not a metric icon.

---

## 4. States & rules (cross-cutting)

- **Contrast (WCAG AA):** all text meets **4.5:1** (normal) / **3:1** (large text,
  icons, UI borders) against its actual background. Indigo is the one color that
  needed splitting for this: `--accent-text` (#818cf8) whenever indigo is the
  **ink** (text/icon on a dark surface), `--accent` / `--accent-strong` as
  **fill/border**. The rest of the palette (`--muted`, `--moon`, semantic, tiers)
  already clears AA; a new color must be checked against this before it's added.
- **Focus:** unified `outline: 2px solid var(--accent)` on everything interactive
  (buttons, custom triggers, chips, stepper buttons, modal close, tabs). One
  combined selector owns this — new interactive elements join it.
- **Locked-by-level** (ingredient / sub-skill slots not yet unlocked): **dim**
  (`opacity ~0.45`, sometimes `grayscale`) but still **interactive** — the value is
  already assigned, just not reached. Do NOT use `pointer-events: none` or
  `disabled` for this case.
- **Destructive:** red (`--error`) only on the hover of a delete action; all other
  hovers are neutral.
- **Empty placeholders:** a dim same-size square keeps rows aligned when a value is
  missing (`.mini-icon--empty`).

---

## 5. Component inventory (reusable pieces)

The building blocks the visual work composes. For each: what it is · variants ·
states · where it lives. Feature one-offs are intentionally not here.

### Buttons & actions
- **`.btn`** — generic action button. Variants: `--primary` (accent fill),
  `--ghost` (transparent, muted border), `--danger` (red, reserved for confirming
  a delete), `--google` (neutral `--surface-2` surface + `--border`, `--text` label,
  hover `border-color: --accent`; leads with the Google "G" mark — the one place a
  brand color is allowed, treated as artwork, not a voiced color). States: hover per
  variant, `:disabled`, unified focus.
- **`.icon-btn`** — icon-only button (grip, move, remove, save). Variants:
  `--inbox` (tints to accent = "already in the box"), `--saving` (pulse while
  saving; respects `prefers-reduced-motion`). States: hover, disabled, focus.
- **`.filter-btn`** — trigger for filter/selector popovers (selected value +
  chevron). Subparts `__value/__icons/__placeholder/__chevron`; state `--open`.
- **`.specialty-toggle`** — segmented toggle-button group; item state `.is-on`
  (accent-dim + accent text). Fills the role of a switch (no native toggle).
- **Selection chips** — `.level-chip` / `.lang-chip` (quick pick of key levels,
  language), state `--active` (solid accent fill).

### Containers
- **`.card`** — generic surface (`--surface`, border, `--r-lg`, ~1.25rem padding).
  The base surface across pages.
- **`.layout` / `.layout--wide`** — page container (`max-width: 1100px`; `--wide`
  removes it for the production comparator).
- **`.grid` / `.grid--3`** — 2- or 3-column layout, collapses to 1 under 860px.
- **`.section-head` (`__title`)** — section title + aligned action/indicator.
- **`.hero` (`__note`)** — page header (h1 + small secondary note).

### Chips & badges
- **`.badge`** — compact pill for short metrics. Variants: `--level` (moon gold),
  `--ok` (`--up` green), `--low` (`--down` red).
- **`.chip` / `.chips`** — small thematic tag (container wraps). Variants:
  `--ingredient` (gold-dim), `--subskill` (accent-dim).
- **`.mini-icon`** — small inline icon (nature stat, ingredient, sub-skill) with
  states `--empty` (dim placeholder) and `--locked` (grayscale + opacity).
- **`.ss-icon`** — sub-skill icon framed by tier color (`--gold/--blue/--regular/
  --empty`), with level badge `.ss-icon__lv` and `.is-locked`. Reused at different
  sizes.
- **State vocabulary** shared across selects/menus/toggles: `.is-active`,
  `.is-selected`, `.is-highlighted`, `.is-locked`, `.is-on`.

### Overlays
- **`Modal`** (`components/Modal.tsx`) — shared dialog. Props: `title`, `onClose`,
  `children`, `wide?`. Escape to close, focus trap, body-scroll lock, autofocus to
  `[data-autofocus]`, focus return; `role="dialog"`, `aria-modal`. Footer via
  `.modal-actions`.
- **Dropdown / combobox pattern** — `SpeciesSelect`, `NatureSelect`,
  `SubSkillSelect` share one skeleton: trigger (`aria-haspopup/expanded`) + absolute
  panel (`role="listbox"`), arrow/Enter nav, click-outside + Escape to close. Same
  pattern applied to filters as `.filter-pop / .filter-grid / .filter-list`.
- **Account menu** (`.avatar-btn` + profile dropdown) — the signed-in identity in the
  top bar. Trigger: a round `.avatar-btn` showing the user's **photo**
  (`object-fit: cover`, clipped to the circle), falling back to **initials** on a
  neutral circle (`--surface-2` / `--muted`, the `.mini-icon--empty` vocabulary) when
  there is no photo; border `--border`, open/focus → `--accent`. Panel: reuses the
  dropdown skeleton (`.filter-pop` + `.filter-list__item`) with a header (avatar +
  name + email) and a **Sign out** item (leading `IconSignOut`, **neutral** hover —
  red is reserved for confirming a delete). Click-outside + Escape to close.
- **`Tooltip`** (`components/Tooltip.tsx`) — one bubble above its trigger, revealed
  on hover and keyboard focus, with `aria-label` on the trigger. Centers over the
  trigger and clamps to the viewport (any width, either edge). Plain string or rich
  content via `Tooltip.Row / Tooltip.Label / Tooltip.Value` (e.g. a strength
  base/bonus breakdown). Wraps the trigger element (`.tooltip` + `.tooltip__bubble`).

### Form controls
- **`Stepper`** (`components/Stepper.tsx`) — the `‹ value ›` shell: two nav buttons
  flanking a display (leading visual + two-line label), buttons disable at bounds.
  Shared by `SkillLevelSelector` (level badge + skill name/desc) and `RibbonSelect`
  (ribbon icon + label/effect); the domain data and bounds live in each caller.
- **Level stepper** (`.level-stepper`, `LevelSelector` + `LevelStepperInput`) — kept
  separate: it has an editable number input and quick-pick level shortcuts, not just
  prev/next.
- **`LevelStepperInput`** — headless stepper (buttons + input, no container) to
  embed in another layout.
- **`SpeciesSelect`** — searchable dropdown with sprite. **`NatureSelect`** —
  dropdown with ↑/↓ stat badges, grouped by raised stat, X circle for neutral.
  **`SubSkillSelect`** — uses `.ss-icon`.
- **`RibbonIcon`** — ribbon sprite with `--empty` variant.
- **Base inputs** — global `input, select` styles with the unified focus outline.

### Shared patterns
- **Tabs** — `.tabs / .tab / --active` (main nav and inner modal tabs).
- **Error feedback** — `.error` (red text) + `ErrorBoundary` app fallback
  (`role="alert"`, title + "reload" `.btn--primary`).
- **`.gate-card`** — the anonymous gate that replaces a **reserved page's** content
  when there is no session (the Box, Team Analysis). A centered `.card` composition:
  a **moon roundel** (`IconMoon` in `--moon` on `--moon-dim` / `--moon-border` — the
  single identity gold, per "one gold accent per card"), a title, a `--muted` line,
  and a `.btn--google`. Sits alongside the empty/loading `Placeholder` vocabulary but
  is a distinct pattern (a call to sign in, not an empty list). The empty **Box**
  state is separate and only shown once signed in.
- **`Placeholder`** (`components/Placeholder.tsx`) — centered muted status line
  standing in for absent content: an empty list, a search with no matches, or
  content still loading (`loading` adds `aria-busy`). Always `role="status"` +
  `aria-live`; may hold an inline action (e.g. "clear filters"). Error states are
  separate (`.error` + `role="alert"`), as is a list's own empty item inside a
  listbox (`SpeciesSelect`'s `.species-empty`) and a card reserving its loading
  height (`.prod-card__calc`).

---

## 6. Decisions

A running log of visual/UX questions that came up and how they were resolved —
the reasoning, so a future similar case has a precedent. A new entry is added when
a real doubt gets settled. The screen is the occasion, not the subject.

- **One gold accent per card.** *Question:* how much identity gold on a data card?
  *Resolution:* exactly one element — the single key figure (e.g. a level badge) —
  carries `--moon`; nothing else. *Why:* gold only reads as "what matters" if it
  stays scarce.
- **Equal hierarchy when there's no real KPI.** *Question:* when a screen shows
  several metrics of comparable importance, should one be visually primary?
  *Resolution:* no — equal weight, same number size, no invented "main number".
  *Why:* faking a KPI misleads; hierarchy must reflect real importance.
- **Reuse states before adding color.** *Question:* how to show secondary status
  (e.g. coverage) without a new hue? *Resolution:* reuse the established
  dimmed/locked state (opacity + grayscale) instead of introducing a color. *Why:*
  every new color erodes the two-voices palette.
- **Indigo splits by role, not by voice, for contrast.** *Question:* the same indigo
  failed AA both as text on a dark surface (too dark) and, elsewhere, under white
  text as a button fill (too light) — should we just pick one value? *Resolution:*
  no single value works: #818cf8 reads at 5.80:1 as ink but only 2.98:1 under white,
  while #4f46e5 reads at 6.29:1 under white but 2.75:1 as ink. So indigo keeps **one
  voice, two roles** — `--accent-text` for ink, `--accent`/`--accent-strong` for
  fill — and the primary button moved to `--accent-strong` as its base. *Why:*
  foreground and background contrast pull in opposite directions; forcing one token
  to serve both guarantees one of them fails AA.
- **Two-row header for narrow cards.** *Question:* long names truncating in narrow
  comparison cards? *Resolution:* stack the header — sprite + actions on top,
  full-width name below. *Why:* names are content; the layout bends before the
  content truncates.
