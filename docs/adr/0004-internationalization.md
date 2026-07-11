# 0004. Custom lightweight internationalization (i18n)

Date: 2026-07-11

## Status

Accepted

## Context

The app must be bilingual (Spanish/English) — the product definition lives in
[Language](../prd/0009-language.md). The text falls into two distinct kinds:
**interface copy** (UI prose, some of it with interpolated values) and **game
vocabulary** (natures, berries, ingredients, sub skills, specialties, main skills,
types, nature stats). The game vocabulary has a hard product constraint: it must use
the **official** in-game localization, not a machine or literal translation.

The scope is small and fixed (two languages), the strings are known at build time, and
we do not need pluralization rules, ICU message syntax, or locale-aware
number/date formatting. A full i18n library (i18next, react-intl) would add a
dependency and API surface out of proportion to that need.

## Decision

We will implement our **own lightweight i18n** in `frontend/src/i18n`, with **no
external library**:

- **Interface copy** lives in a flat key → `{ es, en }` table (`ui.ts`), read through a
  `t(key, vars)` function that interpolates `{var}` placeholders.
- **Game vocabulary** lives in a separate module (`terms.ts`) with per-category
  lookups (`tNature`, `tBerry`, `tIngredient`, `tSubSkill`, `tSpecialty`,
  `tMainSkill`, `tType`, `tNatureStat`). Keeping it apart from UI copy makes the
  official terminology auditable in one place.
- A React context (`LanguageProvider` / `useI18n`) holds the active language and
  exposes `t` plus the term helpers already bound to it.
- **Language resolution**: saved choice (`localStorage["sleepmon.lang"]`) → browser
  language (Spanish if `navigator.language` starts with `es`) → English. The choice is
  persisted to `localStorage` and reflected on `document.documentElement.lang`.
- **Fallback**: a missing UI key resolves to English, then to the raw key — never a
  blank.
- **Term source**: game vocabulary is transcribed from the **official** localizations,
  never auto-translated.

## Consequences

- **Easier**: zero runtime dependency and a tiny footprint; a simple, transparent
  mental model; full control over resolution and fallback. Splitting UI copy from game
  terms keeps the official vocabulary in one reviewable place.
- **Harder / accepted trade-offs**:
  - No pluralization or ICU message features — interpolation is plain `{var}`
    substitution. If a future string needs plural rules, we handle it ad hoc.
  - All strings ship in the bundle (no lazy-loaded locale chunks). Fine at two
    languages; revisit if the set grows.
  - Adding a language means extending every table by hand, and there is **no
    build-time check** for missing keys — only the runtime English fallback.
  - **Species names are not translated** (no official term source wired yet); they
    render in their canonical form regardless of language.
