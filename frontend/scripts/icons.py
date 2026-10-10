#!/usr/bin/env python3
"""Generates the app's own stat and sub-skill icons (docs/design-system.md §3).

    python3 frontend/scripts/icons.py

Writes the SVGs into frontend/public/{nature,subskill}. Every glyph is drawn white
on a 24-unit box; where the game has a sprite (energy, ingredient, dream shard,
generic berry), the sprite is embedded as-is from frontend/public. Sub skills
carry marks: the tier letter (S/M/L) top-right, a % or LV subscript bottom-right,
↑ on gold bonuses. Edit a glyph here and re-run; never hand-edit the output.

Standard library only.
"""

import base64
from collections.abc import Callable
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "public"

# A glyph takes an id prefix (masks and clip paths need ids unique per file) and
# returns SVG markup for the 24-unit box.
Glyph = Callable[[str], str]

W = 'fill="#fff"'


# --- Base glyphs -----------------------------------------------------------------


def exp(p: str) -> str:
    return f'''<clipPath id="{p}c"><rect x="0" y="7.5" width="24" height="9"/></clipPath>
<path {W} d="M1 7.5h5.6v2H3.2v1.5h3.1v2H3.2v1.5h3.4v2H1z"/>
<path d="M8.4 7.5l5.4 9M13.8 7.5l-5.4 9" stroke="#fff" stroke-width="2.4" clip-path="url(#{p}c)"/>
<path {W} fill-rule="evenodd" d="M15.4 7.5h4.4a2.85 2.85 0 0 1 0 5.7h-2.2v3.3h-2.2zM17.6 9.4v1.9h2a.95.95 0 0 0 0-1.9z"/>'''


def bolt(p: str) -> str:
    # Straight, not the jagged "Pikachu tail" shape.
    return f'<path {W} d="M15 2 5 13.5h6L9 22l10-12h-6z"/>'


def stopwatch(cx: float, cy: float, r: float) -> Glyph:
    def f(p: str) -> str:
        return f'''<rect {W} x="{cx-1.8}" y="{cy-r-3.4}" width="3.6" height="2.2" rx=".6"/>
<rect {W} x="{cx-.8}" y="{cy-r-1.6}" width="1.6" height="2"/>
<mask id="{p}m"><circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff"/>
<path d="M{cx} {cy}V{cy-r*.55}M{cx} {cy}l{r*.4} {r*.3}" stroke="#000" stroke-width="2" stroke-linecap="round"/></mask>
<circle {W} cx="{cx}" cy="{cy}" r="{r}" mask="url(#{p}m)"/>'''

    return f


def speed(p: str) -> str:
    return stopwatch(12, 13.6, 8.6)(p)


def two_watches(p: str) -> str:
    # Helping Bonus: the whole team helps faster.
    return (f'<mask id="{p}g"><rect width="24" height="24" fill="#fff"/><circle cx="15" cy="14.8" r="8.7" fill="#000"/>'
            '<rect x="12.4" y="3" width="5.2" height="4.6" rx="1" fill="#000"/></mask>'
            f'<g mask="url(#{p}g)">{stopwatch(7.2, 11.2, 5.4)(p + "a")}</g>'
            f'{stopwatch(15, 14.8, 7.2)(p + "b")}')


def backpack(p: str) -> str:
    return f'''<path d="M8.5 7.5V6a3.5 3.5 0 0 1 7 0v1.5" fill="none" stroke="#fff" stroke-width="2"/>
<mask id="{p}m"><rect x="3.5" y="7" width="17" height="15" rx="3.2" fill="#fff"/>
<rect x="3" y="11.4" width="18" height="1.4" fill="#000"/><circle cx="12" cy="12.1" r="3.3" fill="#000"/>
<circle cx="12" cy="12.1" r="2.3" fill="#fff"/><circle cx="12" cy="12.1" r="1" fill="#000"/></mask>
<rect {W} x="3.5" y="7" width="17" height="15" rx="3.2" mask="url(#{p}m)"/>'''


def clipboard(p: str) -> str:
    # Research EXP Bonus.
    return (f'<mask id="{p}m"><rect x="4" y="3.5" width="16" height="18.5" rx="2.2" fill="#fff"/>'
            '<rect x="7.8" y="1.6" width="8.4" height="5.4" rx="1.6" fill="#000"/>'
            '<path d="M7.5 11h9M7.5 14.5h9M7.5 18h5.5" stroke="#000" stroke-width="1.6" stroke-linecap="round"/></mask>'
            f'<rect {W} x="4" y="3.5" width="16" height="18.5" rx="2.2" mask="url(#{p}m)"/>'
            f'<rect {W} x="8.8" y="1.5" width="6.4" height="4.2" rx="1.1"/>')


def sprite(rel: str, mime: str) -> Glyph:
    """A game sprite from frontend/public, embedded as-is."""
    uri = f"data:{mime};base64," + base64.b64encode((PUBLIC / rel).read_bytes()).decode()
    return lambda p: f'<image href="{uri}" width="24" height="24"/>'


ENERGY = sprite("nature/mood.png", "image/png")
INGREDIENT = sprite("nature/ingredient.png", "image/png")
SHARD = sprite("shard.png", "image/png")
BERRY = sprite("skill/generic-berry.webp", "image/webp")


# --- Marks -----------------------------------------------------------------------

# ↑ top-right: gold bonuses and "more" event effects.
UP = f'<path {W} d="M20.25 0 24 4h-2.65v3.5h-2.2V4H16.5z"/>'

# Tier letter, top-right.
LETTER = {
    "S": '<path d="M23 1.2H19.3a1.275 1.275 0 0 0 0 2.55h1.4a1.275 1.275 0 0 1 0 2.55H17.3" fill="none" stroke="#fff" stroke-width="2"/>',
    "M": f'<path {W} d="M16.6 7V.5h2.3l1.35 2.5L21.6.5h2.3V7h-2.1V3.8l-1.55 2.6-1.55-2.6V7z"/>',
    "L": f'<path {W} d="M17.8 .5H20v4.4h3.6V7h-5.8z"/>',
}

# Subscript bottom-right, at the letter's size: % for chance, LV for skill level.
SUB = {
    "pct": ('<circle cx="17.9" cy="18.6" r="1.15" fill="none" stroke="#fff" stroke-width="1.3"/>'
            '<circle cx="22.6" cy="22.9" r="1.15" fill="none" stroke="#fff" stroke-width="1.3"/>'
            '<path d="M23.4 17.4 17.1 24" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>'),
    "lv": (f'<path {W} d="M16.2 17.5h1.75v4.8h1.5V24H16.2z"/>'
           f'<path {W} d="M20.1 17.5h1.6l.65 3.5.65-3.5h1.6L23.1 24h-1.9z" transform="translate(-.3 0)"/>'),
}

# Clears the glyph around a corner mark so the two never touch.
TOP_RIGHT_GAP = '<circle cx="20.25" cy="3.75" r="5.4" fill="#000"/>'
BOTTOM_RIGHT_GAP = '<circle cx="20.3" cy="20.7" r="5.6" fill="#000"/>'


def badged(base: Glyph, badge: str) -> Glyph:
    """Glyph shrunk to the bottom-left, with a mark (↑) top-right."""
    def f(p: str) -> str:
        return f'''<mask id="{p}b"><rect width="24" height="24" fill="#fff"/>{TOP_RIGHT_GAP}</mask>
<g mask="url(#{p}b)"><g transform="translate(0 5.3) scale(.78)">{base(p+"i")}</g></g>{badge}'''

    return f


def tiered(base: Glyph, letter: str) -> Glyph:
    """Glyph shrunk to the bottom-left, with its tier letter top-right."""
    def f(p: str) -> str:
        return (f'<mask id="{p}b"><rect width="24" height="24" fill="#fff"/>{TOP_RIGHT_GAP}</mask>'
                f'<g mask="url(#{p}b)"><g transform="translate(0 5.28) scale(0.78)">{base(p + "i")}</g></g>'
                + LETTER[letter])

    return f


def subscripted(base: Glyph, sub: str, letter: str | None = None) -> Glyph:
    """Glyph nudged left to balance a % / LV subscript, with an optional tier letter."""
    def f(p: str) -> str:
        gaps = (TOP_RIGHT_GAP if letter else "") + BOTTOM_RIGHT_GAP
        return (f'<mask id="{p}b"><rect width="24" height="24" fill="#fff"/>{gaps}</mask>'
                f'<g mask="url(#{p}b)"><g transform="translate(-2.2 2.65) scale(.78)">{base(p + "i")}</g></g>'
                + (LETTER[letter] if letter else "") + SUB[sub])

    return f


# --- The set -----------------------------------------------------------------------

ICONS: dict[str, Glyph] = {
    # Nature stats (energy and ingredient stay the game's own PNGs).
    "nature/exp": exp,
    "nature/mainSkill": bolt,
    "nature/speed": speed,
    # Gold bonuses: ↑.
    "subskill/sleep-exp-bonus": badged(exp, UP),
    "subskill/research-exp-bonus": badged(clipboard, UP),
    "subskill/helping-bonus": badged(two_watches, UP),
    "subskill/energy-recovery-bonus": badged(ENERGY, UP),
    "subskill/dream-shard-bonus": badged(SHARD, UP),
    "subskill/berry-finding-s": tiered(BERRY, "S"),
    # Tierless versions for event effects.
    "subskill/skill-trigger": subscripted(bolt, "pct"),
    "subskill/skill-level-up": subscripted(bolt, "lv"),
    "subskill/ingredient-finder": badged(INGREDIENT, UP),
    "subskill/berry-finding": badged(BERRY, UP),
    "subskill/inventory-up": badged(backpack, UP),
}
for t in "SM":
    ICONS[f"subskill/helping-speed-{t.lower()}"] = tiered(speed, t)
    ICONS[f"subskill/skill-trigger-{t.lower()}"] = subscripted(bolt, "pct", t)
    ICONS[f"subskill/ingredient-finder-{t.lower()}"] = subscripted(INGREDIENT, "pct", t)
    ICONS[f"subskill/skill-level-up-{t.lower()}"] = subscripted(bolt, "lv", t)
for t in "SML":
    ICONS[f"subskill/inventory-up-{t.lower()}"] = tiered(backpack, t)


def main() -> None:
    for name, glyph in ICONS.items():
        prefix = name.split("/")[1].replace("-", "")
        (PUBLIC / f"{name}.svg").write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="72" height="72">'
            + glyph(prefix) + "</svg>\n"
        )
    print(f"{len(ICONS)} icons written to {PUBLIC}")


if __name__ == "__main__":
    main()
