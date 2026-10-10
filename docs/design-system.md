# sleepmon Design System — "Noche"

> Living document. It holds both the **visual identity** (the concept) and the
> **reusable pieces** (tokens + components) that implement it. Every visual change
> must reinforce the concept; anything that adds complexity without reinforcing it
> is not done. This is the single source the visual work reads from and grows.

---

## 1. Concept (identity)

**In one line:** a team-tracking app that lives at night — dark and still like
sleep, where every color on the screen has a job to do.

**The twist:** function before identity. The UI has **no color of its own voice**:
the background is an own night navy (not a stock dark theme), and the only hues
are functional — **indigo** for state (selection / focus / active / editing) and a
**good / bad pair** (mint `--up`, coral `--down`) for what the rules push up or
down. The pair differs in brightness as well as hue, so good and bad stay apart
without relying on color vision, and a direction always carries a shape too (▲/▼,
a sign). The color that stands out on screen is the game's own artwork — sprites,
berries, ingredients, sub-skill tiers.

**Voice:**
- **Still, but not frozen** — motion is allowed only when it does a job: state
  feedback (the saving pulse), the entrance of new content (modals, production
  cards), a hover/selection transition, or **a layout that has to change size**
  because something arrived — that last one is eased rather than designed away only
  when holding the space open would cost more than the movement does (§6). It stays
  short and sober (~80–150ms for micro-interactions, entrances and those size
  changes; the only loop is the saving pulse, and it *is* the feedback), and always
  honors `prefers-reduced-motion`. Nothing moves to decorate.
- **Hierarchy by size and weight, not color** — the most important figure (e.g. the
  team's grand total) leads by being larger and heavier; indigo only for
  active/selection. When there is no real KPI, blocks
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

**Palette** — no "voiced" color: indigo is functional, `--up`/`--down` are semantic,
and the game's artwork brings the rest. Surfaces separate by **tone** (`--bg` →
`--surface` → `--surface-2`), not by outlines.

```css
/* Backgrounds — an own night navy; each step is visible on its own */
--bg:        #0e1220;
--surface:   #171d30;   /* cards */
--surface-2: #20283f;   /* controls and panels inside a card */
--border:    #262e47;   /* control outlines and dividers on --surface — never a card edge */
--divider:   color-mix(in srgb, var(--muted) 35%, transparent);
                        /* a hairline that holds on --surface-2 and on tinted zones,
                           where --border vanishes (separators, tooltip rows, toggles) */

/* Text */
--text:      #e8ecf6;
--muted:     #98a2bd;   /* 6.5:1 on --surface */

/* Functional accent — indigo. Two roles, because contrast pulls opposite
   ways: as FILL under white text vs as INK on the dark background. One value
   can't do both, so the palette splits the role, not the voice. */
--accent:        #6366f1;   /* fill / border / focus outline */
--accent-strong: #4f46e5;   /* fill under white text (primary button) */
--accent-dim:    rgba(99, 102, 241, 0.15);
--accent-border: rgba(99, 102, 241, 0.4);
--accent-text:   #8f95ff;   /* indigo as text/icon on dark — AA (6.3:1 on --surface) */
--accent-2:      #38bdf8;   /* the other side of a share: a split's second Pokémon */

/* Semantic good / bad — what the rules push up (a bonus, a stat that rises, a
   delta in favor) or down (a cost, a stat that falls, a delta against). The pair
   differs in luminance (1.8x) as well as hue, so it survives deuteranopia. */
--up:          #5ee6c4;
--up-dim:      rgba(94, 230, 196, 0.13);
--up-border:   rgba(94, 230, 196, 0.4);
--down:        #f97066;
--down-dim:    rgba(249, 112, 102, 0.14);
--down-border: rgba(249, 112, 102, 0.4);
--error:       #f85149;   /* destruction only (§4) */

/* The three accents that tint a surface — `--up`, `--down` and `--accent` —
   all carry the same two alpha variants: `-dim` fills, `-border` outlines. A
   cost is marked the way a bonus is, and a functional state the way both are.
   `rgba()` needs channels, so a variant cannot be composed at use time. */

/* Sub-skill tiers — game content, so their colors are the game's; the regular
   tier uses --muted, mapped in .ss-icon. Gold appears nowhere else. */
--tier-gold: #d4a017;
--tier-blue: #58a6ff;

/* Elevated surfaces */
--overlay:         rgba(8, 11, 20, 0.75);
--shadow-dropdown: 0 12px 32px rgba(0, 0, 0, 0.45);
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
--r-lg: 16px   /* main cards, modals, dropdowns */
```

`border-radius: 999px` only for pills (level chip, level badges, the nature pill).

**Layout:**

```
--appbar-h: 3.4rem   /* the sticky app bar's height: where sticky content below it docks */
```

**Spacing:** base unit of 4px; values are multiples. No spacing tokens — the 4px
grid is a mental guide.

---

## 3. Icon system

Two icon languages that never mix:

- **Game content** → sprites and official icons (ingredients, sub-skills, berries,
  stats). They are "the artwork" and keep their real color.
  - **Stat and sub-skill glyphs** (`public/nature`, `public/subskill`): the game's
    sprite where it has one (energy, ingredient, dream shard, generic berry); where
    it doesn't, an own **filled white glyph** (SVG, 24-unit box) drawn in the same
    voice — EXP → our own block letters, main skill → a straight bolt, help speed → a
    stopwatch. All of them come from `frontend/scripts/icons.py`: edit a glyph there
    and re-run it, never hand-edit the SVGs. Sub skills
    are **one SVG each**, named in kebab case (`helping-speed-s.svg`), built from a
    glyph plus marks: the **tier letter** (S/M/L) top-right on tiered sub skills; a
    **`%`** (chance: Skill Trigger, Ingredient Finder) or **`LV`** (Skill Level Up)
    subscript bottom-right at the letter's size, the glyph nudged left to balance it;
    **↑** top-right on gold bonus sub skills (Berry Finding S, being tiered, carries its S). Research EXP → a clipboard, Helping
    Bonus → two stopwatches, Inventory Up → a backpack. Stat icons carry no marks:
    they double as metric icons.
- **UI metrics & actions** → own line icons in `src/components/icons.tsx`:
  `currentColor`, `stroke-width: 2`, `viewBox 0 0 24 24`, 14px default, rounded
  caps/joins, `aria-hidden`. They inherit context color (dimmed to `--muted`,
  `--accent-text` when they mean "the night"). **Never emojis.**

Current catalog: `IconStopwatch`, `IconHelp`, `IconBackpack`, `IconHourglass`,
`IconSparkle` (the five **filled** metric glyphs, below), `IconPackage` (a box of unknown
contents — random ingredients), `IconPot`, `IconMagnifier`, `IconMoon`,
`IconChevronDown`, `IconArrowUp`, `IconArrowDown`, `IconMore`, `IconMenu`, `IconClose`,
`IconEdit`, `IconCopy`, `IconCheck`, `IconSaveBox`, `IconSplit`, `IconSignOut`,
`IconProgress` (rising bars — what you have unlocked and levelled; the account menu's
"Perfil de jugador"), `IconSun` (the nap — the daytime sleep, beside `IconMoon`'s
night), `IconGlobe` (language, on the signed-out `.lang-btn`), `IconUser` (the account — the
account menu's "Account & privacy"), `IconTrash` (deleting what is saved). A new UI icon is added here following the same stroke — no ad-hoc icons
in components.

**Metric display.** A metric reads as **its own icon + the number** — the icon marks
the figure a line *reports*. Metrics with a
game icon use it (berry → its berry, ingredient → its ingredient, dream shards →
shard, strength → `CHARGE_STRENGTH_ICON`, cooking / pot expansion → `pot` /
`POT_EXPANSION_ICON`, extra tasty → its icon, energy → its stat icon, berries obtained
from teammates → the game's **generic berry**, `GENERIC_BERRY_ICON`, for a berry whose
type the view can't name). A main skill is shown by its game skill icon where one
exists (`mainSkillIcon` — Berry Burst has its own). Metrics with
no game icon get one **designated** UI icon that stands for them, used the same way
everywhere: procs / triggers → `IconSparkle`, help cadence → `IconStopwatch`, helps →
`IconHelp` (a hand offering what it gathered), inventory fill time → `IconHourglass`,
inventory capacity → `IconBackpack`, nighttime proc chance → `IconMoon` (and the nap's →
`IconSun`, so each sleep is named by its icon), help multiplier → `IconMagnifier`.

Two kinds of figure stay **bare** (no metric icon):

- **Not a single metric.** A percentage, a count or ratio (coverage `X/Y`,
  filter/showing counts, `X/3`, pot `N/M`), or a level (`Lv N`) — no one icon fits.
  Exceptions: a percentage that is a skill mechanic with its own icon (extra tasty)
  keeps it.
- **Feeds or derives from a reported metric.** The figures a breakdown decomposes
  into (a berry's count, a filler's base strength), a subtotal's total / closing
  row, a `×7` weekly projection — the icon rides the reported metric; these read as
  plain numbers beside it.

Edit steppers show nav arrows, not a metric icon.

**Pokémon types** are game content: a type is shown by its **type icon** (the
Scarlet/Violet small set, via PokeAPI like the berry sprites), in its real color and
**clipped round** (`border-radius: 50%`) so it reads as a token, not a tile. Not by
its berry — the berry is what the type *yields*, not what it *is*. (The Box's type
filter still uses berry icons; it predates this rule and should follow it.)

---

## 4. States & rules (cross-cutting)

- **Contrast (WCAG AA):** all text meets **4.5:1** (normal) / **3:1** (large text,
  icons, UI borders) against its actual background. Indigo is the one color that
  needed splitting for this: `--accent-text` (#8f95ff) whenever indigo is the
  **ink** (text/icon on a dark surface), `--accent` / `--accent-strong` as
  **fill/border**. The rest of the palette (`--muted`, `--up`/`--down`, tiers)
  already clears AA; a new color must be checked against this before it's added.
- **Focus:** unified `outline: 2px solid var(--accent)` on everything interactive
  (buttons, custom triggers, chips, stepper buttons, modal close, tabs). One
  combined selector owns this — new interactive elements join it.
- **Locked-by-level** (ingredient / sub-skill slots not yet unlocked): **dim**
  (`opacity ~0.45`, sometimes `grayscale`) but still **interactive** — the value is
  already assigned, just not reached. Do NOT use `pointer-events: none` or
  `disabled` for this case.
- **Destructive:** a delete action is red (`--error`) **at rest**, not on hover, so it
  reads as one on a phone too. Hover only says "clickable" (a neutral background) and
  never carries meaning.
- **Cost vs. destruction (the two reds):** a **cost** — a value the rules push down
  (a gameplay penalty, a stat that falls) — is `--down`, never `--error`. It may
  reach past a badge onto a **whole surface**: a card whose subject is being
  penalized gets a `--down`-tinted header, the way a favored card gets an
  `--up`-tinted one. That surface-level red is reserved for a real, rule-driven penalty and
  must vanish where the penalty does not apply — a state, never decoration.
- **Good / bad never by color alone:** a direction always carries a shape or sign
  too — `▲`/`▼` on deltas and natures (the sign stays in `sr-only` text for screen
  readers), `+`/`−`/`×` on marks. Natures follow the app's pair (`▲` `--up`,
  `▼` `--down`), not the game's red-up / blue-down.
- **Charts:** categorical series use hues outside the good/bad pair (today's
  strength breakdown: berries `#6366f1`, skills `#38bdf8`, recipes `#c084fc`, fillers
  `#94a3b8`, extra tasty `#e3b341`), so no slice reads as "good" or "bad".
- **Empty placeholders:** a dim same-size square keeps rows aligned when a value is
  missing (`.mini-icon--empty`).
- **Hidden overlays are hidden from layout too:** anything absolutely positioned
  that is only *sometimes* visible (tooltip bubbles, popovers) is hidden with
  `display: none`, never with `visibility`/`opacity`. A hidden absolute element
  still counts toward the page's **scroll width** — the ones near the right edge
  turn into a phantom horizontal scroll on a phone.
- **Nothing moves out from under the pointer:** a control the user is working must keep
  its position while something *else* arrives next to it — an unsaved mark, a count, a
  warning. Flex layout decides this, and the rule is that the arriving piece must not be
  able to take width from anything ahead of it. Two ways to guarantee that, and which
  one applies depends on what else is on the line: **size the control so it cannot
  shrink** and let the piece fall where it fits (`.island-tab__row .bonus-slider` is
  pinned at `min(22rem, 100%)`, so the mark lands beside it or on its own line, and the
  track never narrows); or, on a line whose whole point is a **flexible** item — a
  toolbar built around a search box — take the arriving piece **out of that line
  altogether**, absolutely positioned under the control (`.meal-picker-pot__stepper` is
  its containing block). Out of flow it adds neither width nor height to the line;
  anything that *shares* such a line is paid for out of the flexible item, which moves
  everything after it. Either way the piece anchors to the **control**, not to the
  row —
  under the stepper's buttons, against the slider's own left edge, never adrift under a
  label. The room the piece needs comes from the container's own `padding-bottom`, which
  transitions, so what sits below slides rather than jumps. Get it wrong and the cost is
  not cosmetic: the pot stepper used to slide ~141px left as the mark arrived, so a
  second click on `+` landed on **Guardar** and saved by accident.
- **Nothing scrolls the page sideways:** the page's `scrollWidth` must equal the
  viewport at 375px. When a row genuinely can't fit (a nav strip, a wide table),
  it scrolls **inside itself**, not by dragging the whole page.

---

## 5. Component inventory (reusable pieces)

The building blocks the visual work composes. For each: what it is · variants ·
states · where it lives. Feature one-offs are intentionally not here.

### Buttons & actions
- **`.btn`** — generic action button. Variants: `--primary` (accent fill),
  `--ghost` (transparent, muted border), `--danger` (red, reserved for confirming
  a delete), `--delete` (the **entry** to a delete, on a page: transparent, `--error`
  text, `--border` outline, a leading `IconTrash`, label ending in "…"; hover
  `border-color: --error` — red at rest per §4, while the solid `--danger` stays for the
  confirmation it opens), `--google` (neutral `--surface-2` surface + `--border`, `--text` label,
  hover `border-color: --accent`; leads with the Google "G" mark — the one place a
  brand color is allowed, treated as artwork, not a voiced color). States: hover per
  variant, `:disabled`, unified focus.
- **`.icon-btn`** — icon-only button (grip, move, remove, save). Variants:
  `--inbox` (tints to accent = "already in the box"), `--saving` (pulse while
  saving; respects `prefers-reduced-motion`). States: hover, disabled, focus.
- **`ActionMenu`** (`components/ActionMenu.tsx`, `.action-menu`) — an item's actions
  behind a `···` `.icon-btn` (ARIA menu button: focus to the first item, arrows,
  Home/End, Escape and click-outside return focus). Each item leads with its 16px line
  icon in `--muted`; hover is only a `--surface` background. A delete (`danger`) is red
  at rest and sits apart under a faint `--muted` separator with no margin of its own,
  so the spacing across it matches the spacing between items and uses the **trash** icon (the cross means
  "take out of this tool", not "delete what's saved"). Used by the Box entries and
  the Teams rows.
- **`.filter-btn`** — trigger for filter/selector popovers (selected value +
  chevron). Subparts `__value/__icons/__placeholder/__chevron`; state `--open`.
- **`.specialty-toggle`** — segmented toggle-button group; item state `.is-on`
  (accent-dim + accent text). Fills the role of a switch (no native toggle).
- **Selection chips** — `.level-chip` / `.lang-chip` (quick pick of key levels,
  language), state `--active` (solid accent fill).

### Containers
- **`.card`** — generic surface (`--surface`, transparent 1px border, `--r-lg`,
  ~1.25rem padding). Separated from the page by tone, not an outline. A **state** the rules impose on
  a card is told by a tint, never a border (see `.prod-card` below). The base surface across pages.
- **`.prod-card` berry header** — the card's relation to the map's favorite berries
  tints its **identity zone** (`.prod-card__identity`: name, sprite, ingredients, sub
  skills, nature — bleeding to the card edges), while the figures below stay on
  `--surface`. Each tint is a deep hue at about `--surface`'s lightness, in `oklch`
  (good = teal-green, bad = wine): `--favorite-berry` `oklch(0.29 0.055 185)`,
  `--main-favorite` (expert map) `oklch(0.37 0.08 180)`, `--no-favorite` (expert map
  only) `oklch(0.27 0.065 15)`. Neutral cards keep `--surface`. Inside any tinted zone
  `--border` becomes `--divider`; the main favorite, the lightest tint, also lifts
  `--muted` and `--down` (`#c2cfd7`, `#ffb4ad`) to stay AA. The comparison's base card has **no** surface
  treatment — its `Base` tag says it.
- **`.night-grid`** — the card's **skill while asleep** read-out (inside
  `.prod-card__night`): a small grid, `--text-sm`, tabular nums, `column-gap 0.9rem`.
  A header row of `--text-xs` `--muted` column labels, then **one row per sleep** — the
  sleep's icon (`IconMoon` night, `IconSun` nap; `--accent-text`, the night's ink) + its
  `--muted` name ("al dormir" with no nap; "noche" / "siesta" with one) — and its
  chances. Skill specialists: columns **≥ 1 vez** and **2 veces** (`auto 3.6rem 3.6rem`);
  everyone else (`--one`): a single **1 vez** column. Every card under the same sleep
  schedule has the same rows, so cards align without reserving space; the block keeps its
  40px floor.
- **`.team-rows`** — the Teams tool's list (PRD 0016): one `--surface` panel, a
  header row of `--text-xs` uppercase `--muted` column names, then one `.team-row` per
  team on the **same fixed grid** (header and rows are separate grids, so no track is
  sized by its content), split by `--border` hairlines. Columns: name (700) · five
  slots · map + berries · dish type + recipe images · saved date (tabular) · a `···`
  `ActionMenu`. Under 860px each row becomes its own `--surface` card (name + menu,
  slots, labelled Map and Meals, the date), the header hidden.
- **`.team-slot-mini`** — one slot as a fixed 64×84 `--surface-2` box (dashed when
  empty). A split stacks its two Pokémon at the same size and a 5px vertical bar beside
  them carries the shares: the top length is the top Pokémon's (`--accent`), the
  bottom the other's (`--accent-2`). No printed numbers; the percentages are the
  `title` and the screen reader's text.
- **`.saved-team-bar`** — Team Analysis's saved-team actions in the `.tool-head`
  action slot: with no team open, a lone `.btn--primary` **Save team**; with one open,
  its name as a quiet button with a pencil (border on hover) that **renames** the team,
  a **label-only** `.progress-diff` ("sin guardar"), a close `.icon-btn`, then
  `.btn--primary` **Save** (enabled only while unsaved) and `.btn--ghost` **Save as…**.
- **`.layout` / `.layout--wide`** — page container (`max-width: 1100px`; `--wide`
  removes it for the production comparator).
- **`.grid` / `.grid--3`** — 2- or 3-column layout, collapses to 1 under 860px.
- **`.tool-head`** — a tool's header: the title (`h1`, `--text-xl`) and nothing that
  explains the tool. Row `.tool-head__row` (flex, wraps): the title, an optional count
  inside it (`.tool-count`, `--muted`, weight 600, `--text-lg` — "Caja (6)"), and an
  optional primary action pushed right (`.btn--primary`, wraps under the title below
  640px). Below the row, the tool's **context bar**. Replaces the old `.hero` (title +
  subtitle + note): how a tool works is told in its empty state, not above its data.
- **Context bar** (`.ctx-bar`) — the row under a tool's title that shows **what is
  shaping its numbers**, each setting as a **field** (`.ctx-field`: a `--muted`
  `--text-sm` label + an existing control). A layout, not a new control: choices are a
  `.filter-control`/`.filter-btn` (opening a `.filter-pop`, or the setting's own dialog —
  one `Modal` per setting, titled after it, no tabs — when it has several parts), on/off is a
  `.specialty-toggle` (No / Sí), and a rule's effect inside a trigger is its
  `.metric-mark` — a bare figure too (the area bonus is a "+35%" mark, named in full in its
  tooltip and accessible name). Flex, wraps (`gap: 0.6rem 1.5rem`); a field never splits
  across lines, and never grows past the bar's width: the Map trigger reserves the longest
  map's width (`.ctx-map` sizers) but may shrink below it on a narrow screen, where the map
  name ellipsizes and its berries and marks keep their size. The Box's `.box-toolbar` is its context bar. A field may pair an in-place toggle with
  a trigger (Team Analysis's Meals: dish-type `.specialty-toggle` + a `.filter-btn` with the
  three dishes as 24px recipe images, `.ctx-recipes`). A field is shown **even when
  its setting is off** ("Sin mapa", "Sin evento", No), so the bar keeps its shape and every
  setting has a visible door.

### Chips & badges
- **`.badge`** — compact pill for short metrics. Variants: `--level` (neutral
  `--surface-2`, `--text`, weight 700), `--ok` (`--up`), `--low` (`--down`).
- **`.metric-mark`** — inline annotation of what a rule is doing (`×2` / `×2,4` on
  berries, `+1` on ingredients, `Skill +1` or `×1,25` on skill, `−10%` / `+15%` on
  help cadence, with each expert map's own figures). It rides either the **figure** the rule changed, or the **control
  that turns that rule on** — inside a `.filter-btn__value` or a
  `.filter-list__item`, where the same mark labels the option that produces it.
  Smaller and bolder than `.badge` (`--text-xs`, weight 700) and tinted rather than
  neutral, so it reads as attached to what it annotates instead of standing on its
  own. Variants: `--good` (`--up` on `--up-dim`) and `--bad` (`--down` on
  `--down-dim`). Always carries `title`
  + `aria-label` with the full effect — the sign and the text carry the meaning, so
  color is never the only cue. Generalized from `.prod-card__fav-badge` (the berry
  `×2`), which is its good variant. **With icons**: where the mark stands apart from
  the figure it changes (a summary of active rules), it leads with the effect's icon
  and may close with its scope's (a type icon) — `[icon] ×1,5 [scope]`, icons at
  14px inside the same pill.
- **Tooltip cue** (`.strength-value__cue`) — a figure that hides more behind a
  `Tooltip` (a breakdown, a per-sleep detail) is underlined **dotted** in `--muted`
  (`text-underline-offset: 2px`, `cursor: help`); its color is untouched. First use: the
  strength figure with its base/bonus breakdown; also the fill time when it overflows.
  A figure without a tooltip is never underlined, so the dots always mean "hover or focus
  for more".
- **Overflow mark** (`.overflow-mark`) — a bare **`+`** in `--down`, weight 800, right
  after a figure (`margin-left: 1px`), saying the thing it measures **overflows**: the
  inventory fills before a sleep ends. The figure itself keeps `--text` — the `+` is the
  only red, and as a shape it is a cue beyond color. `aria-hidden`: the figure's
  `Tooltip` (which it always rides with, under a tooltip cue) and its `aria-label` say
  which sleep overflows and by how much. Not a `.metric-mark`: no pill, no fill, because
  it flags a state of this Pokémon rather than naming a rule's effect.
- **`.skill-alert`** — a `--down` warning triangle (`IconAlert`, 14px) beside a card's
  Skill block heading, saying part of what the skill does isn't calculated (Metronome,
  Skill Copy, Psystrike's Berry Zone, Nuzzle's bonus). Wrapped in `Tooltip` with the
  specific gap; focusable, `role="img"` + `aria-label` with the same text.
- **`.progress-diff`** — marks a value the user has changed but **not saved** into the
  record it came from, and offers to save it (`__label` "sin guardar" + `__save`, an
  underlined text button). Indigo — `--accent-dim` fill, `--accent-border` outline,
  `--accent-text` ink — at `--text-xs`, `--r-sm`. Wrapped in `Tooltip`: one
  `Tooltip.Row` holds the **saved** value, so the number is a hover or a focus away
  instead of printed beside every control. Renders **nothing** when the value matches
  what is saved — no placeholder, no reserved space, ever. It enters with `appear-in`
  **plus** `grow-in`, so the line that hosts it grows eased instead of snapping open
  (see *Entrance*). **Where** it lands is left to flexbox rather than a breakpoint:
  its neighbours are arranged so none of them can give up width to it (§4), so it
  either fits beside the control — the whole width of a desktop row — or wraps to a
  line of its own, and in neither case does the control move.
  **Not a `.metric-mark` variant**: that one is a non-interactive pill (`999px`)
  naming what a *rule* does to a figure, this one is a rounded container holding a
  button and naming what the *user* has left undone.
- **`.prod-delta`** — a comparison card's difference against the base: a pill
  (`999px`, `--text-xs`, weight 700) with `▲`/`▼` + the absolute difference.
  Variants: `--up` (`--up` on `--up-dim`), `--down` (`--down` on `--down-dim`),
  `--same` (bare `≈` in `--muted`). The sign lives in `sr-only` text.
- **`.chip` / `.chips`** — small thematic tag (container wraps). Variants:
  `--ingredient` (`--surface-2`), `--subskill` (accent-dim).
- **`.mini-icon`** — small inline icon (nature stat, ingredient, sub-skill) with
  states `--empty` (dim placeholder) and `--locked` (grayscale + opacity).
- **`.ss-icon`** — sub-skill icon framed by tier color (`--gold/--blue/--regular/
  --empty`), with the unlock-level badge `.ss-icon__lv` at the **top-left** (the icon's
  tier letter sits top-right and its `%`/`LV` mark bottom-right) and `.is-locked`.
  Every tile carries a `Tooltip` with the sub skill's name (lock state included),
  unless the name is written beside it (the selector's options). Sizes: 36px with a
  2px border in the selector; **28px with a 1.5px border** on the
  card and the Box row (the same proportions — never a 2px border on a compact tile).
- **`NaturePill`** (`.nature-pill`) — a nature as one `999px` pill: `▲` + the raised
  stat's icon (`--up`), `▼` + the lowered one's (`--down`), then the name (`--text`)
  after a hairline divider. Neutral → a white circled X on both sides (only the arrows carry
  color); no nature → `--empty` (muted marks, same footprint, so rows stay aligned).
  Two versions: **with the name** (the card) or **effects only** where the row must
  summarize more (the Box row) — the effects-only pill always sits in a `Tooltip` with
  the nature's name. `NatureSelect` is the one place the name sits *outside* the pill:
  trigger and options read as a list of names, each with its effects-only pill. Fill
  is `--surface-2`, or `--surface` on a `--surface-2` ground (`--pill-bg`).
- **State vocabulary** shared across selects/menus/toggles: `.is-active`,
  `.is-selected`, `.is-highlighted`, `.is-locked`, `.is-on`.

### Overlays
- **`Modal`** (`components/Modal.tsx`) — shared dialog. Props: `title`, `onClose`,
  `children`, `wide?`, `tall?` (full available height, for a dialog whose content is
  filtered — Meals — so a search never resizes it). Escape to close, focus trap, body-scroll lock, autofocus to
  `[data-autofocus]`, focus return; `role="dialog"`, `aria-modal`. Footer via
  `.modal-actions`. The panel never outgrows the viewport: the title stays fixed and
  only `.modal-body` scrolls (a body holding its own scrolling panel, like Progress,
  doesn't scroll too). A dropdown opened inside shrinks its list to the body's visible
  room below it (never under ~160px; then it scrolls into view), so the list and the
  body never both scroll. Every scrolling surface uses the thin `--border` scrollbar.
  `dirty?` (the add/edit Pokémon form sets it from `MemberForm`'s `onDirtyChange`):
  with unsaved input, a tap outside, Escape or ✕ first ask "Discard your changes?"
  in a `.modal-confirm` card over the content (Keep editing · Discard, the discard in
  `--danger`). The content stays mounted and `inert` underneath, so keeping on
  editing loses nothing; Escape on the question means "keep editing".
- **Dropdown / combobox pattern** — `SpeciesSelect`, `NatureSelect`,
  `SubSkillSelect` share one skeleton: trigger (`aria-haspopup/expanded`) + absolute
  panel (`role="listbox"`), arrow/Enter nav, outside `pointerdown` + Escape to close
  (`pointerdown`, not `mousedown`: iOS only fires the latter on clickable elements). Same
  pattern applied to filters as `.filter-pop / .filter-grid / .filter-list`; a
  `FilterPopover` near the right edge shifts left just enough to stay on screen (16px,
  the phone gutter), never wider than the screen.
- **Berry toggles** (`.island-tab__berry-grid`) — three per row across the picker's
  width, 40px tall, on every screen (Comparison's favorite-berries popover and Team
  Analysis's map dialog); under **640px** the popover spans the screen and the dialog's
  picker drops under its label. Below them, **`BerryCount`**: a bar with one 6px pill
  segment per **slot** (empty: `--muted` at 28%, so it shows on any surface), filled
  `--accent` where the slot holds a berry — an open slot stays empty in its place, like
  the "?" in the field's summary — and turning `--up` when all are in. The bar **is** the
  count — no "2 / 3" figures beside it (a `progressbar` named after what it counts, with
  "2 / 3" as its value text). The main favorite's ★ carries no legend: expert players
  already know the first berry counts most, so the star is a reminder, not a lesson.
- **Account menu** (`.avatar-btn` + profile dropdown) — the signed-in identity in the
  app bar. Trigger: a 34px pill (`--surface-2`, `--border`, `--text-sm` 600) holding the
  user's **photo** in a 28px circle (`.avatar-btn__photo`, `object-fit: cover`), falling
  back to **initials** on a neutral circle (`--surface` / `--muted`) when there is no
  photo, then the **first name** (`.avatar-btn__name`, ellipsis past 9rem) and a muted
  chevron; open/focus → `--accent` border. Panel: reuses the
  dropdown skeleton (`.filter-pop` + `.filter-list__item`) with a header (avatar +
  name + email), a **language row** (`.menu-lang`: "Idioma" in `--muted` left, the
  `.lang-select` pair of `.lang-chip`s right, the active one `.lang-chip--active`), and a
  **Player profile**, **Account & privacy** (leading `IconUser`; opens the *Your account*
  page) and **Sign out** items (leading `IconSignOut`), all **neutral** — no red in this
  menu: deleting the account lives on *Your account* (§6), rows split by
  `.filter-list__sep`. Click-outside + Escape to close.
- **`.lang-btn`** — the language control when **signed out**, next to `.btn--google`: a
  30px pill (`--surface-2`, `--border`, `--muted`, `--text-sm` 700) with `IconGlobe` +
  the current code ("ES"); hover/open → `--accent` border. Opens a right-anchored
  `.filter-pop` with the two languages as `.filter-list__item`s, the current one
  `.is-selected`. Signed in, the language lives in the account menu instead.
- **`Tooltip`** (`components/Tooltip.tsx`) — one bubble above its trigger, revealed
  on a **real mouse's** hover, **keyboard** focus (`:focus-visible`), or a **tap**, which
  toggles it (a tap elsewhere or Escape closes it); a touch's emulated hover and a tapped
  button's focus don't count, so nothing sticks open. `aria-label` on the trigger.
  `.tooltip--inline` keeps a wrapped run of text (a metric line) in the text's flow. What a
  user needs to read goes in a `Tooltip`, never a `title`, which touch never shows. Centers over the
  trigger and clamps to the page's width (`documentElement.clientWidth`, not
  `innerWidth`; any bubble width, either edge). Plain string or rich
  content via `Tooltip.Row / Tooltip.Label / Tooltip.Value` (e.g. a strength
  base/bonus breakdown). Wraps the trigger element (`.tooltip` + `.tooltip__bubble`).
  The bubble sets its own typography (weight 400, no uppercase, normal tracking), so a
  trigger inside an uppercase block heading doesn't restyle it.

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
  dropdown grouped by raised stat; the trigger and each option show a `NaturePill`.
  **`SubSkillSelect`** — uses `.ss-icon`.
- **`RibbonIcon`** — ribbon sprite with `--empty` variant.
- **Base inputs** — global `input, select` styles with the unified focus outline.
  `button, input, select, textarea` inherit the page's font family (one global rule),
  so no component re-declares it.

### Editable rule lists
- **Effect row** — one rule in a user-composed list (first use: the event bonus's
  effects). A grid row on `--surface-2` with `--border` and `--r-md`: **game icon +
  name + `.metric-mark`** (the value, `+1` / `×1,5`) · the **scope** in `--muted`
  `--text-sm` (its icon + a short label — "Ingredientes", "Psíquico", "Todo el
  equipo" — or a dimmed `—` when the rule has none) · **edit / remove** `.icon-btn`s.
  Under **640px** it stacks: name on the first line, scope on the second, actions
  spanning both on the right. Rows sit in a column with a small gap; the list's
  actions (`+ Agregar…` / `Quitar todos`, `.btn--ghost`) follow it.
- **Inline editor** — the controls for one row while it is being added or edited,
  in place below the list rather than in a nested modal: a `--surface` box with an
  `--accent-border` outline and `--r-md`, the controls stacked as label/control rows
  (the `.island-tab__row` rhythm), closing with `.btn--ghost` Cancel +
  `.btn--primary` confirm. Indigo because it marks a **state** (editing), not a
  bonus. Composes existing controls only (`.filter-btn` dropdowns, a stepper,
  `.specialty-toggle`).

### Shared patterns
- **App footer** (`.app-footer`) — one line after `<main>` on every route: a `--border`
  hairline above, `--text-xs` `--muted`, centered, `line-height 1.5`, a wrapping flex row
  (`gap 0.25rem 0.5rem`) of the **Privacy** link (`--muted`, underlined, `--text` on
  hover), the contact email as selectable text, and the fan-project / non-affiliation
  notice, joined by `aria-hidden` middots. Never fixed: `#root` is a column at least the
  window tall with `<main>` taking the slack, so on a short page the footer rests at the
  bottom of the window and on a long one it follows the content. Wraps to 2–3 centered
  lines on a phone; drops
  the email (and its dot) when none is configured.
- **Document page** — a non-tool page (*Your account*, *Privacy*): `.layout` with an
  inner 680px column, a `ToolHeader` with only its title (an optional `--text-sm`
  `--muted` line under it, e.g. "Last updated"), then a stack of `.card`s (`gap 1rem`),
  each with an `h2` (`--text-base` 700, or `--text-lg` for long-form sections) and text
  near 65ch. Facts read as a `dl` grid (`dt` `--muted`, `dd` tabular nums). No app-bar tab
  is active on these pages.
- **App bar** (`.appbar`) — the app's top menu, **sticky** (`top: 0`, `--bg`, a
  `--border` hairline below, full bleed; content in a 1100px row). Left to right: the
  **brand** (`.brand`: Snorlax sprite 30px, pixelated, + "sleepmon", `--text-lg` 800,
  linking to the first tool), the **tabs**, and the account cluster pushed right (account menu,
  or `.btn--google` + `.lang-btn`). Under **900px** the bar stays **one row**: the tabs
  collapse into a **menu button** (`.nav-menu__btn`, a 34px pill: `IconMenu` + the current
  tool's name, `--border`, `--text` 600; icon only under 640px, where the page title
  already names the tool) placed **left of the brand**. It opens `.nav-menu__panel`, which
  drops below the whole bar at full width (`--bg`, a `--border` hairline, `--shadow-dropdown`)
  with every tool as a `.nav-menu__item` row, the current one in the active-tab indigo. It
  closes on a pick, Escape (focus back to the button), a tap outside, or any navigation.
  The tools come in **two groups**: analysis first (Comparison, Team analysis — they work
  signed out), then what you keep (My box, My teams), each ordered Pokémon then team. A
  `.nav__sep` hairline (a faint `--muted`) sits between the groups: vertical in the tab
  row, horizontal in the menu panel. Tool names are **sentence case** ("My box", "Team
  analysis"), and so are their mentions in running text ("your box").
  Under 640px the signed-out `.btn--google` shows a short label, the full one minus "with
  Google" ("Iniciar sesión" / "Sign in") — the "G" already says Google; the full label
  stays everywhere else.
- **Tabs** — `.tabs / .tab / --active` (app bar and inner modal tabs). In the app bar a
  tab is a **pill** (`999px`, `--text-base`, `--muted`); the active one is filled
  indigo — `--accent-dim` with an `--accent-border` outline and `--text` ink — and
  carries `aria-current="page"`.
- **Swipe deck** (`.prod-cards--swipe` + `SwipePager`, `components/SwipePager.tsx`) — the
  card grids of Comparison and Team Analysis on a phone. Under **640px** the card grid becomes a horizontal scroll-snap
  track: **one card per screen**, a swipe moves exactly one (`scroll-snap-stop: always`),
  and the cards keep equal heights, so every metric sits at the same spot on every card;
  the add slot keeps its own height. The track is `position: relative`, the containing
  block of its slides' absolutely positioned bits. Above it, the **pager** docks sticky
  under the app bar (`top: --appbar-h`, `--bg`): one 38px round button per card with the
  species sprite (pixelated; a split slot shows both, smaller and overlapping), `+` for
  the add slot; inactive at 0.55 opacity, the current
  one in the active-tab indigo (`--accent-dim` + `--accent-border`, `aria-current`). It
  follows the swipe, a tap slides to that card, a new card slides into view, and a
  reorder (Make base, ‹ ›) follows the card that was showing. A slider inside a card
  (`touch-action: pan-y`) keeps its sideways drag. Above 640px the grid is
  unchanged and the pager hidden; also hidden with no cards.
- **Entrance (`appear-in`)** — the app's single entrance animation: `0.15s ease-out`,
  `opacity 0→1` + `scale(0.97)→none`, fired by the element being inserted. One
  keyframe shared by everything that shows up mid-interaction — `.prod-card--enter`
  (a card added to the comparison) and `.progress-diff` (a value going unsaved) —
  not one per component. Silenced under `prefers-reduced-motion`. A consumer that keys
  off `animationend` must check `e.target === e.currentTarget`, since the name now
  bubbles up from nested pieces.
- **Growth (`grow-in`)** — the companion for something whose arrival makes its line
  taller: same 0.15s ease-out, growing the piece's own `max-height`, padding and
  border from zero under `overflow: hidden`, so the container grows with it instead of
  snapping. Deliberately **not** part of `appear-in`, which the comparison cards share
  and which are far taller than its cap. All of it expires with the animation
  (`fill-mode: none`) — nothing stays capped or clipped, so a focus ring inside is
  never cut. Two limits worth knowing: `max-height` stands in for `height`, which
  cannot interpolate from `auto`, so the cap must clear the piece with room to spare;
  and the `gap` of a flex line that only exists once the piece wraps in still appears
  at once (~5.6px in the pot toolbar) — gaps are not animatable per line.
- **Exit (`leave-out`)** — the mirror of the two above, for a piece whose departure
  would otherwise be a cut: the same 0.15s ease-out, running opacity, scale and the
  box back to zero, with `forwards` so the collapsed state holds until it unmounts.
  It costs the component a little life of its own — `UnsavedMark` keeps rendering for
  one animation after its `unsaved` goes false, inert while it does (not clickable,
  not focusable, not read out), and drops itself on a timer rather than
  `animationend`, which never arrives when the animation is suppressed or its clock
  is frozen in a hidden tab. Under `prefers-reduced-motion` the exit is skipped
  outright, not silenced — a silenced animation would strand the piece on screen.
- **Error feedback** — `.error` (red text) + `ErrorBoundary` app fallback
  (`role="alert"`, title + "reload" `.btn--primary`).
- **`.gate-card`** — the anonymous gate that replaces a **reserved page's** content
  when there is no session — today the **Box** and **Teams**. Which pages those are follows
  from the rule, not from a list: a page is reserved when it reads or writes the Box
  (see PRD 0010), so a tool that only computes stays open and never shows this card.
  A centered `.card` composition: a **moon roundel** (`IconMoon` in `--accent-text`
  on `--accent-dim` / `--accent-border`), a title, a `--muted` line, and a `.btn--google`. Sits alongside the
  empty/loading `Placeholder` vocabulary but is a distinct pattern (a call to sign in,
  not an empty list). The empty **Box** state is separate and only shown once signed
  in.
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

- **One gold accent per card.** *(Superseded by «Function over identity», below.)* *Question:* how much identity gold on a data card?
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
- **Which red for a penalty.** *Question:* a gameplay rule makes a Pokémon produce
  *less* — is that `--error` or `--down`? *Resolution:* `--down`, and it may reach
  past a badge onto the card's own border. `--error` stays with destruction (the
  delete confirmation). *Why:* a penalty is a value falling, which is exactly what
  `--down` already means (`.badge--low`, a nature's `↓`); calling it an error would
  say something went wrong, when nothing did. It also keeps the two-voiced palette
  intact — `--down` is semantic, not a third voice.
- **Gold marks a state, and then it may repeat.** *(Superseded by «Function over
  identity», below — favored cards and their marks now use `--up`; the point about
  stacked states keeping a quiet step still holds.)* *Question:* "one gold accent per
  card" says a single element carries `--moon`, but a card the rules favor now has
  a gold border *and* a gold mark on each metric the favor touches. Which wins?
  *Resolution:* the one-accent rule governs **identity** — the single key figure,
  like a level badge. When gold encodes a **state the rules impose**, it may repeat:
  the border says *this one is favored*, each mark says what the favor does to that
  number. Scarcity is kept a different way — gold appears only on cards actually
  favored, and only beside metrics actually changed. *Why:* the rule existed to stop
  decorative gold, not to stop gold from carrying meaning; the card had already
  outgrown it (border + `×2` badge) before this was written down. Corollary: when
  two gold states stack (favored vs. *most* favored), the step between them stays
  quiet — a full `--moon` border against a `--moon-border` one is deliberately
  subtle, because the marks carry the hierarchy and hue does not.
- **Nothing hidden may widen the page.** *Question:* on a phone the whole page
  scrolled sideways with nothing visible out there — where from? *Resolution:* the
  tooltip bubbles: absolutely positioned, hidden with `visibility: hidden`, and
  still adding to the document's scroll width. They hide with `display: none` now.
  *Why:* "invisible" is not "absent" — an off-screen hidden element is as real to
  the scroll box as a visible one, so hiding must remove it from layout, not just
  from sight. The same goes for clipping: a horizontal scroll track (the swipe deck)
  is `position: relative`, or the `.sr-only` spans of its off-screen slides take the
  page as their containing block, escape the track's clip and widen the page.
- **Compare by swapping, not by stacking.** *Question:* on a phone the comparison
  stacked its cards, so the same metric on two Pokémon sat a screen apart. *Resolution:*
  one card per screen, swiped (the swipe deck), with a sprite pager that says how many
  there are and which one is showing. *Why:* comparing means looking at the same spot
  while the subject changes — a swipe keeps the eye still, a scroll makes it hunt.
- **A tooltip clamps to the page, not the window.** *Question:* on a phone a bubble near
  the right edge still ran off-screen, even with nothing else overflowing. *Resolution:*
  mobile browsers grow `innerWidth` to fit overflowing content, and the bubble overflows
  for an instant before it is moved — so the clamp measured a window the bubble itself
  had widened. It measures `documentElement.clientWidth` now. *Why:* clamp against
  something the thing being clamped can't stretch.
- **A split slot's actions ride with the slider.** *Question:* a team slot can hold
  two Pokémon, so its toolbar already carries the tabs (which of the two is showing)
  and the split slider. Once each Pokémon can also be edited and saved to the Box,
  do those actions join the tabs row? *Resolution:* no — the tabs row stays
  identity-only, and the actions sit at the right end of the **slider** row, which
  uses only a fraction of its width. They act on the active tab's Pokémon and say so
  in their `title` ("Edit Raichu"). The toolbar keeps the two-row height it already
  had (measured: 64px in both a single and a split slot), so the reserved height that
  single slots mirror does not grow. *Why:* the tabs row is the one that wraps — a
  species name plus its percentage, twice, already fills a 265px card at five columns,
  and four icons would push it to a third line; because single slots reserve the split
  header's height, that would make **every** card in the team taller. The slider's row
  has the space already. Keeping the actions in the toolbar rather than moving them
  into the card body also holds the earlier line that a card's first row belongs to
  name / level / ribbon.
- **Under 640px the shape changes, it doesn't shrink.** *Question:* a row of
  columns (top bar, Box entry) has no width left on a phone — squeeze it, or scroll
  it? *Resolution:* neither: it becomes a different shape. The top bar wraps into
  two rows; a Box entry becomes a **collapsible row** — identity plus only the
  metric its specialty is for, opening on tap into label/value rows grouped in two
  sections. Nothing is dropped, only deferred one tap. *Why:* columns carry meaning
  by position, and position is exactly what a narrow screen takes away; once the
  columns go, the labels have to come back, and the phone has room for labels only
  if it stops showing everything at once.
- **A mark may ride the control, not only the figure.** *Question:* a selector that
  turns a rule on for a whole screen — should its options repeat the `.metric-mark`
  the affected figures will carry, or say the multiplier in plain text? *Resolution:*
  they repeat the mark, in the trigger and in the option list, identical to the one
  that lands on the metric. *Why:* the mark is the name of the effect, not decoration
  on a number; naming it the same way where it is chosen and where it lands lets the
  reader connect cause and consequence without a legend. It stays scarce because it
  is still the *same* effect being named twice, not a new gold accent.
- **Nothing moves out from under the pointer; ease what's left.** *Question:* the
  unsaved mark appears the instant a slider moves or a stepper is tapped. It used to
  take a third of the track's width away, push every row below it down, and — worst —
  slide the pot stepper 141px left, far enough that a second click on `+` hit Guardar.
  Reserving a permanent slot removed the movement, but then the control always occupied
  more room than it needed. Animating the movement instead still left the control
  moving. *Resolution:* three steps, in order. **One:** nothing next to the mark may
  give up width to it. Under the slider that means pinning the slider's width, and the
  mark then either fits beside it or wraps. In the meals toolbar it could not mean that
  — its whole layout hangs off one flexible search box — so there the mark leaves the
  line entirely and hangs under the stepper, which also keeps it where it belongs: read
  as "unsaved" about *the pot*, not about the toolbar. Under the slider the same concern
  is why the slider and its mark share a group (`.bonus-control`): a mark wrapping
  against the row's edge landed under the label instead of the control. **Two:** with
  that settled, flexbox alone decides placement under the slider — beside it where the
  row has room (306px free against a 134px mark at a row of 818, so on desktop it opens
  to the right and nothing moves at all), on its own line where it does not. No
  breakpoint. **Three:** where a line does get added, the mark eases both its arrival
  and its departure by growing from and collapsing back to zero (`grow-in` /
  `leave-out`). *Why:* the order is the point. Easing a movement that shouldn't happen
  just makes a misclick prettier; removing it first leaves only the one change that is
  honest — the layout genuinely got taller — and that one is worth easing. Reserved
  space was the wrong trade for the same reason: a permanent cost paid for an occasional
  event the reader mostly never sees.
- **Marking a value that isn't saved yet.** *Question:* a value edited in a tool that
  differs from the user's saved record — is that a `.metric-mark`, and does the saved
  value sit beside the control? *Resolution:* neither. It is its own piece,
  `.progress-diff`, in **indigo**, and it names the **state** ("sin guardar") while the
  saved value moves into the tooltip. *Why:* `.metric-mark` names what a **rule** does to
  a figure and is a non-interactive span; this names what the **user** has left undone
  and has to hold a button, so it cannot be that piece with a new tint. Indigo is already
  the functional colour of state, which keeps gold identity-only. And the saved number
  stays out of the layout because the same mark repeats across nine areas and seventy
  recipes — the tooltip already exists for a value's breakdown and opens on keyboard
  focus as well as hover, so nothing is lost to the keyboard by moving it there.
- **A modifier without a switch is on when it has content.** *Question:* the event
  bonus had a No/Sí toggle beside its list of effects, meant to suspend the bonus
  without losing it — but reading the screen, nobody could tell what it switched.
  Keep it and label it better, or drop it? *Resolution:* drop it. A modifier built
  from a list is active exactly when the list has entries; emptying it (one by one,
  or `Quitar todos`) is how it turns off, and the Event field of the context bar reads
  "Sin evento" when the list is empty. *Why:* a switch over a list creates a second state — effects
  present but inert — that the reader has to track and the screen has to explain;
  for an ephemeral bonus rebuilt by hand, the comparison it bought was not worth the
  ambiguity. A binary modifier with no content of its own (the Good Camp Ticket)
  keeps its toggle.
- **A breakdown names its sources by icon; a list goes in the tooltip.** *Question:*
  Berry Burst brings berries from every teammate into one Pokémon's card — label that
  line ("from teammates"), list each berry inline, or neither? *Resolution:* neither.
  The line is the game's **generic berry** plus the total, no label, and its tooltip
  lists one row per berry type. The strength breakdown names each source by its icon —
  own berry, a strength skill's icon, the generic berry for teammates' berries — the
  same `.prod-ing__breakdown` shape the card already uses. In the team's berry rows,
  where the type *is* known, those berries simply add to their own row and the skill's
  share lives in that row's strength tooltip. *Why:* the icon already says what the
  figure is, so a label would only repeat it in a narrow card; a per-type list is detail
  you reach for, which is what the tooltip is for (§ Tooltip), and keeping berries on
  their own row keeps "everything that yields strength is in Berries" true without a
  second, parallel row.
- **Function over identity.** *Question:* the moon gold was both the app's identity
  (level badge, grand total, the night) and its "good" (bonus marks, favored cards),
  while coral meant "bad" — and the two sat at nearly the same brightness (0.39 vs
  0.36 relative luminance) only ~30° of hue apart, so good and bad were hard to tell
  apart, worse under color-blindness. The base palette was also a stock dark theme,
  which made the app read as a dev tool. Keep the identity and fix the contrast, or
  drop the identity? *Resolution:* drop it. `--moon` is gone: identity uses (level
  badge, Snorlax level, the night icon, strength figures) turn neutral or indigo, the
  grand total leads by size and weight, and every "good" use moves to a new `--up`
  (mint), paired with `--down` (coral) at 1.8x the luminance apart. Comparison deltas
  became `▲`/`▼` pills, natures follow the same pair, chart series avoid it, and cards
  separate from an own night navy by tone instead of outlines. Gold survives only as
  the game's gold sub-skill tier. *Why:* in a tool read for numbers, a color that
  means "this is us" competes with the colors that mean "this is better / worse" —
  and loses legibility for both. Giving every hue exactly one job makes the screen
  scannable at a glance, and the game's artwork already gives the app its character.
- **A card's state tints it; the base card has none.** *Question:* favored, main
  favorite, penalized and the comparison's base were all told by the card's border —
  and on a favored card the base ring was lost. Keep borders, or move the state into
  the surface? *Resolution:* the berry relation tints the card's **identity header** (`--up`
  18% / 30%, `--down` 20%), no border at all, and the base card drops its visual
  treatment — the `Base` tag already names it. A whole-card tint was tried first:
  subtle enough to keep the numbers readable, it didn't separate from a neutral card,
  and stronger it muddied the navy into teal/maroon behind every figure. *Why:* a
  one-pixel border competes with every other edge on a dense screen and two states
  can't share it; tinting only the header reads at a glance and keeps the data area
  neutral. "Which one is the base" is a label, not a state worth a color.
- **A state tint keeps the surface's lightness.** *Question:* the header tints were
  `--up` / `--down` mixed into `--surface` in sRGB, and they read as a muddy teal and a
  greyish mauve. Lower the percentage, mix in another space, or build them differently?
  *Resolution:* each tint is its own deep `oklch` color at about `--surface`'s lightness,
  with chroma added in the semantic hue (teal-green / wine). An `oklch` mix was tried:
  cleaner, but its hue path runs through blue and violet, so the favorite stopped reading
  as green. *Why:* `--up` and `--down` are light inks, so mixing them into the navy
  raises its lightness while the hue shift cancels chroma, which gives the grey cast.
  Keeping the lightness and adding only color reads as a tint instead.
- **What changes the numbers is on screen; how a tool works is in its empty state.**
  *Question:* each tool opened with a paragraph on how it works and a note on the day the
  calculation assumes, while the settings that reshape its numbers sat in odd places — a
  lone scenario dropdown at the right of Comparison, a loose Settings button in Team
  Analysis whose map, favorite berries and area bonus were nowhere on screen. Where do
  explanations and settings go? *Resolution:* every tool shares one shape — a title-only
  **tool header**, a **context bar** under it, then the content. The bar shows each
  setting that changes the tool's numbers as a labelled field, **even when off**, and the
  field is the way to change it (toggle in place, dropdown, or the setting's own dialog). Explanations move into the empty state, next to the actions that start the tool.
  The bar is built from existing controls in the Box toolbar's language (labelled
  `.filter-btn`s and `.specialty-toggle`s) rather than a new chip — chips in the title row
  were tried and left the Box, whose filters don't fit there, looking like a different
  app. *Why:* a returning user reads the data, not the instructions, so instructions that
  stay forever become noise; and a setting that changes every number but isn't visible
  makes the numbers unexplainable at a glance.
- **One dialog per setting, not one dialog with tabs.** *Question:* once every setting has
  its own field in the context bar, should the fields still open a shared Settings dialog
  on their tab? *Resolution:* no — each field opens its own `Modal`, titled after the
  setting (Map, Meals, Event), with no tab bar; what the bar already controls in place
  (dish type, Good Camp Ticket) leaves the dialogs. With no map chosen, the Map dialog
  still shows the berry grid, every chip disabled. *Why:* a tab bar inside a dialog you
  opened for one thing invites detours, and repeating a control that is already one tap
  away in the bar gives the same state two places to drift. A disabled grid shows what a
  map would let you pick instead of an empty gap.
- **A sleep's skill chance reads "at least once".** *Question:* a Skill specialist showed
  *1 vez* (exactly once) and *2 veces* on two lines; with a nap that becomes four lines,
  and in a comparison a stronger Pokémon could show a **lower** *1 vez* simply because more
  of its chance moved to *2 veces*. How should the chances read? *Resolution:* a
  `.night-grid` mini table, one row per sleep: specialists read **≥ 1 vez** and **2
  veces**, others a single **1 vez** (capped at one, so it is the same number). The
  alternative, one line per sleep (`1× 41% · 2× 22%`), abbreviates what the table names. *Why:* a
  cumulative chance only rises as a Pokémon gets more active, so a comparison never reads
  backwards; and a table names its columns once instead of on every line.
- **An overflow is marked by a shape, not by recoloring the figure.** *Question:* when the
  inventory fills before a sleep ends, how loud should the fill time be? *Resolution:* the
  time keeps its color, gets the dotted **tooltip cue**, and a red **`+`** follows it; the
  tooltip names each sleep and whether it fills. A `--down` time with a warning triangle
  (too loud for a common, expected state) and a red time with no shape (color alone) were
  both tried. *Why:* overflow is information, not an alarm — the production figures stay
  the focus — and the `+` keeps good/bad off color alone.
- **A saved team's state rides its name, not the page.** *Question:* how does Team
  Analysis say "this is Cyan curry, and you've changed it"? *Resolution:* the open
  team's name sits in the title row's action slot with the existing `.progress-diff`
  pill as a bare label ("sin guardar"), and **Save** is disabled until there is
  something to save. *Why:* the pill already means "changed, not saved" for profile
  values, so the same mark reads the same way here; putting the save inside the pill
  too would duplicate the Save button next to it.
- **A share has two owners, so it has two colors.** *Question:* the split slider and
  the saved team's split bar both draw a 60/40 split; what color is the 40? *Resolution:*
  `--accent-2` (sky), never a grey or a dimmed indigo. *Why:* the 40 is the second
  Pokémon's time, not unused time; a muted color read as "off". Sky is the hue the
  strength chart already gives skills, so it is in the app's vocabulary, and it sits far
  enough from indigo to read as a different Pokémon.
- **Touch is not a mouse.** *Question:* on a phone, labels lived in `title`s nobody could
  see, hovers stuck after a tap, 24px icons sat next to a destructive ✕, drag to reorder
  did nothing, and fields under 16px made iOS zoom. *Resolution:* explanations go in a
  tappable `Tooltip`; every `:hover` rule sits in `@media (hover: hover)` (a real state,
  like "open", stays outside it); under `(pointer: coarse)` icon buttons, steppers, the
  modal close, segmented toggles, filter triggers, chips and list rows get ~40px hit
  areas without growing their glyphs (the context bar and app bar keep one 36px row;
  small inline controls such as "Make base" extend their tap area with an invisible
  `::after`); on phones a modal takes nearly the whole screen and the form's submit
  stays pinned at its bottom; drag and drop is gone
  (the ‹ › controls reorder); fields are 16px on phones. *Why:* a fingertip has no hover,
  no precision and no tooltip delay — the same screen has to work with only taps.
- **Deleting the account is one page away, never one tap away.** *Question:* where does
  "Delete my account" live — the account menu, the Player profile, or a page? A red item
  in the account menu put an irreversible action next to everyday ones (language, sign
  out). *Resolution:* the menu gets a neutral **Account & privacy** item that opens the
  *Your account* document page; the page ends with a "Delete your account" card whose
  `.btn--delete` opens the typed-email confirmation (`.btn--danger` to confirm).
  *Why:* leaving must always be possible but never accidental; a page in between costs
  one click and keeps the menu free of destruction.
- **Stat and sub-skill icons are ours or the game's, never a third party's.**
  *Question:* the nature-stat and sub-skill icons had been taken from RaenonX, and two
  of them read wrong (a jagged "Pikachu tail" bolt for skill, chevrons for help speed).
  Keep them, or replace them? *Resolution:* keep the game's sprite where the game has
  one; draw an own filled glyph where it doesn't; give sub skills one marked SVG each
  (tier letter, `%` / `LV` subscript, ↑ on gold bonuses — §3). *Why:* the artwork must
  be the game's or the app's own; the marks let a tile say *which* sub skill (and which
  tier) without reading its name.
- **The card's four metric icons are filled glyphs.** *Question:* help cadence, helps,
  inventory capacity and fill time used line icons (a clock, a lucide hand, a box), while
  the stat and sub-skill icons for the same ideas had become filled glyphs (stopwatch,
  backpack). Redraw them as lines or fill them? *Resolution:* `IconStopwatch`, `IconHelp`,
  `IconBackpack` and `IconHourglass` are filled, in `currentColor`, drawn like the stat
  glyphs; every other UI icon stays a line icon. *Why:* these four
  name game mechanics the stat icons already draw; one drawing per idea reads the same
  on a sub-skill tile and on the card.
- **A nature is one pill, wherever it appears.** *Question:* on the card the nature
  was loose icons with arrows under the tiled sub skills, and read as hanging from
  nothing; the selector used two separate chips. *Resolution:* `NaturePill` — the two
  marks and the name in one pill — on the card, the Box row and the selector; the
  sub-skill unlock level moves to the tile's top-left, and compact tiles go to 28px
  with a 1.5px border. *Why:* each piece of a Pokémon's config reads as a contained
  unit, the nature looks the same in the place you set it and the places you read it,
  and the icon marks stay uncovered.
- **The card's metric glyphs are white, and the sparkle joins them.** *Question:* the
  card's metric icons were muted while the stat and sub-skill glyphs around them are
  white, and `IconSparkle` (skill triggers) was still a line icon among filled ones.
  *Resolution:* metric icons on the card's lines take `--text`; `IconSparkle` is a
  filled four-point sparkle, so the card has five filled metric glyphs. The comparison
  deltas keep their own up/down color. *Why:* one icon voice per card: every glyph
  that names a figure reads at the same weight and color.
