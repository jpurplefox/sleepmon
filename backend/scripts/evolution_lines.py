#!/usr/bin/env python3
"""Builds the evolution-line data and reference sheets the screenshot reader uses.

    python3 backend/scripts/evolution_lines.py <pokemon.json> <sprites dir>

- <pokemon.json>: species data with each one's ``ancestor`` (the dex number of the
  line's first stage, whose name is on the game's candy label), in nitoyon/pokesleep-tool's
  format.
- <sprites dir>: a local folder with each species' Pokémon Sleep sprite as
  ``<slug>.png`` (see ``SPRITE_FILES`` for the exceptions). This script never fetches
  anything; a missing sprite stops it.

Writes backend/src/sleepmon/adapters/outbound/bedrock/evolution_lines.json and one WebP
sheet per line under …/bedrock/lines/. Re-run after adding species; never hand-edit the
output. Needs Pillow (not a backend dependency: the output is committed).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "src"))

from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog  # noqa: E402

OUT = ROOT / "backend/src/sleepmon/adapters/outbound/bedrock"
# Catalog names whose sprite file doesn't follow the plain slug.
SPRITE_FILES = {
    "Vulpix (Alola)": "vulpix_alolan.png",
    "Ninetales (Alola)": "ninetales_alolan.png",
    "Farfetch'd": "farfetchd.png",
    "Wooper (Paldea)": "wooper_paldean.png",
}

COLUMNS = 6
CELL_W, CELL_H = 210, 230
SPRITE = 170
LABEL_SIZE = 20


def sprite_file(name: str) -> str:
    return SPRITE_FILES.get(name) or re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") + ".png"


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def sprite(sprites: Path, name: str) -> Image.Image:
    path = sprites / sprite_file(name)
    if not path.exists():
        sys.exit(f"missing sprite for {name}: {path}")
    return Image.open(path).convert("RGBA")


def sheet(sprites: Path, names: list[str]) -> Image.Image:
    columns = min(len(names), COLUMNS)
    rows = -(-len(names) // columns)
    image = Image.new("RGB", (CELL_W * columns, CELL_H * rows), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=LABEL_SIZE)
    for index, name in enumerate(names):
        art = sprite(sprites, name)
        art.thumbnail((SPRITE, SPRITE))
        x0, y0 = (index % columns) * CELL_W, (index // columns) * CELL_H
        image.paste(
            art, (x0 + (CELL_W - art.width) // 2, y0 + 8 + (SPRITE - art.height) // 2), art
        )
        width = draw.textlength(name, font=font)
        draw.text((x0 + (CELL_W - width) / 2, y0 + SPRITE + 22), name, fill="black", font=font)
        draw.rectangle((x0, y0, x0 + CELL_W - 1, y0 + CELL_H - 1), outline="#d8d8d8")
    return image


def main(nitoyon_json: Path, sprites: Path) -> None:
    entries = json.loads(nitoyon_json.read_text())
    by_name = {e["name"]: e for e in entries}
    # The candy label names the first stage's base form (no regional/costume suffix).
    first_stage = {e["id"]: e["name"] for e in entries if "(" not in e["name"]}
    lines: dict[str, list[str]] = {}
    for species in sorted(StaticSpeciesCatalog().all(), key=lambda s: (s.dex, s.name)):
        ancestor = by_name[species.name]["ancestor"] or by_name[species.name]["id"]
        candy = first_stage.get(ancestor, species.name)
        lines.setdefault(candy, []).append(species.name)
    # A costume line keyed by a species of another line (Pikachu (Halloween) under
    # "Pikachu", while Pikachu sits in Pichu's line) joins that line.
    for candy in list(lines):
        home = next((k for k, v in lines.items() if k != candy and candy in v), None)
        if home is not None:
            lines[home].extend(lines.pop(candy))

    sheets = OUT / "lines"
    sheets.mkdir(exist_ok=True)
    for old in sheets.glob("*.webp"):
        old.unlink()
    for candy, names in lines.items():
        sheet(sprites, names).save(sheets / f"{slug(candy)}.webp", "WEBP", quality=80)
    data = json.dumps(lines, indent=1, ensure_ascii=False)
    (OUT / "evolution_lines.json").write_text(data + "\n")
    print(f"wrote {len(lines)} lines for {sum(map(len, lines.values()))} species")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
