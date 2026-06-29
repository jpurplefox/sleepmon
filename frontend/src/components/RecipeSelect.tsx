import { useEffect, useRef, useState } from "react";

import { ingredientIcon } from "../ingredients";
import type { Recipe } from "../types";

interface Props {
  recipes: Recipe[];
  value: string | null;
  onChange: (name: string | null) => void;
  placeholder: string;
  id?: string;
}

// Normalize text for accent/case-insensitive search (same approach as BoxPicker).
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const TYPE_ORDER: Recipe["type"][] = ["Curry", "Salad", "Dessert"];

export function RecipeSelect({ recipes, value, onChange, placeholder, id }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = recipes.find((r) => r.name === value) ?? null;

  // Group and sort recipes: by type order, then within each group by base_strength desc.
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: recipes
      .filter((r) => r.type === type)
      .sort((a, b) => b.base_strength - a.base_strength),
  }));

  // Apply text filter across all groups.
  const q = normalize(query.trim());
  const filteredGrouped = q
    ? TYPE_ORDER.map((type) => ({
        type,
        items: grouped
          .find((g) => g.type === type)!
          .items.filter((r) => normalize(r.name).includes(q)),
      })).filter((g) => g.items.length > 0)
    : grouped.filter((g) => g.items.length > 0);

  // Flat list of all visible options (for keyboard nav).  Index 0 is "Sin receta".
  const flatOptions: Array<Recipe | null> = [null, ...filteredGrouped.flatMap((g) => g.items)];

  // Reset highlight when dropdown opens or query changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Click-outside and Escape to close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (name: string | null) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatOptions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatOptions.length) % flatOptions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = flatOptions[activeIndex];
      // opt is either a Recipe or null (the "Sin receta" option).
      pick(opt?.name ?? null);
    }
  };

  // Map flat index → a Recipe | null for highlight checks.
  const flatIndexOf = (r: Recipe | null): number => {
    if (r === null) return 0;
    return flatOptions.findIndex((o) => o?.name === r.name);
  };

  return (
    <div className="recipe-select" ref={ref} id={id}>
      <button
        type="button"
        className="recipe-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <span className="recipe-trigger__icons">
              {selected.ingredients.slice(0, 5).map((ic) => (
                <img
                  key={ic.ingredient}
                  className="mini-icon"
                  src={ingredientIcon(ic.ingredient)}
                  alt={ic.ingredient}
                  title={ic.ingredient}
                  style={{ width: 18, height: 18 }}
                />
              ))}
            </span>
            <span className="recipe-trigger__name">{selected.name}</span>
          </>
        ) : (
          <span className="muted">{placeholder}</span>
        )}
        <span className="recipe-trigger__chevron">▾</span>
      </button>

      {open && (
        <div className="recipe-dropdown">
          <input
            className="species-search"
            autoFocus
            placeholder="Buscar receta…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            role="combobox"
            aria-expanded
            aria-controls="recipe-options"
            aria-activedescendant={
              activeIndex === 0
                ? "recipe-opt-none"
                : flatOptions[activeIndex]
                  ? `recipe-opt-${flatOptions[activeIndex]!.name}`
                  : undefined
            }
            aria-label="Buscar receta"
          />

          <ul className="recipe-options" role="listbox" id="recipe-options">
            {/* "Sin receta" clear option */}
            <li>
              <button
                type="button"
                id="recipe-opt-none"
                role="option"
                aria-selected={activeIndex === 0}
                className={
                  "recipe-option" +
                  (value === null ? " recipe-option--active" : "") +
                  (activeIndex === 0 ? " recipe-option--highlight" : "")
                }
                onClick={() => pick(null)}
                onMouseEnter={() => setActiveIndex(0)}
              >
                <span className="recipe-option__name muted">{placeholder}</span>
              </button>
            </li>

            {filteredGrouped.map((group) => (
              <li key={group.type} role="presentation">
                <div className="recipe-group__title" role="presentation">
                  {group.type}
                </div>
                <ul role="presentation" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {group.items.map((r) => {
                    const flatIdx = flatIndexOf(r);
                    return (
                      <li key={r.name}>
                        <button
                          type="button"
                          id={`recipe-opt-${r.name}`}
                          role="option"
                          aria-selected={flatIdx === activeIndex}
                          className={
                            "recipe-option" +
                            (r.name === value ? " recipe-option--active" : "") +
                            (flatIdx === activeIndex ? " recipe-option--highlight" : "")
                          }
                          onClick={() => pick(r.name)}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                        >
                          <span className="recipe-option__ings">
                            {r.ingredients.slice(0, 5).map((ic) => (
                              <img
                                key={ic.ingredient}
                                className="mini-icon"
                                src={ingredientIcon(ic.ingredient)}
                                alt={ic.ingredient}
                                title={ic.ingredient}
                                style={{ width: 18, height: 18 }}
                              />
                            ))}
                          </span>
                          <span className="recipe-option__name">{r.name}</span>
                          <span className="recipe-option__strength">
                            {r.base_strength.toLocaleString()}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}

            {filteredGrouped.length === 0 && (
              <li className="species-empty muted">Sin resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
