#!/usr/bin/env python3
"""Builds the ingredient reference sheet the screenshot reader sends to the model.

    python3 backend/scripts/ingredient_sheet.py

Every catalog ingredient's game icon (frontend/public/ingredients) with its English
name under it, on a white grid. Re-run after adding an ingredient; never hand-edit the
output. Needs Pillow (not a backend dependency: the PNG is committed).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "src"))

from sleepmon.domain.value_objects import Ingredient  # noqa: E402

ICONS = ROOT / "frontend" / "public" / "ingredients"
OUT = ROOT / "backend/src/sleepmon/adapters/outbound/bedrock/ingredient_reference.png"

COLUMNS = 5
CELL_W, CELL_H = 228, 196
ICON = 120
PAD = 16
LABEL_SIZE = 22


def slug(name: str) -> str:
    return re.sub(r"\s+", "-", name.strip().lower())


def main() -> None:
    names = [i.value for i in Ingredient]
    rows = -(-len(names) // COLUMNS)
    sheet = Image.new("RGB", (COLUMNS * CELL_W, rows * CELL_H), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=LABEL_SIZE)
    for index, name in enumerate(names):
        col, row = index % COLUMNS, index // COLUMNS
        x0, y0 = col * CELL_W, row * CELL_H
        icon = Image.open(ICONS / f"{slug(name)}.png").convert("RGBA").resize((ICON, ICON))
        sheet.paste(icon, (x0 + (CELL_W - ICON) // 2, y0 + PAD), icon)
        width = draw.textlength(name, font=font)
        draw.text(
            (x0 + (CELL_W - width) / 2, y0 + PAD + ICON + 12), name, fill="black", font=font
        )
        draw.rectangle((x0, y0, x0 + CELL_W - 1, y0 + CELL_H - 1), outline="#d8d8d8")
    sheet.save(OUT, optimize=True)
    size = f"{sheet.size[0]}x{sheet.size[1]}"
    print(f"wrote {OUT.relative_to(ROOT)} ({len(names)} ingredients, {size})")


if __name__ == "__main__":
    main()
