# Language

## Purpose

The app is **bilingual** — Spanish and English. Everything the user reads, both the
**interface copy** and the **game vocabulary** (natures, berries, ingredients, sub
skills, specialties, main skills, types), is shown in their language, and the game
terms use the **official in-game translation**, never an invented or literal one.

It answers: *"can I use the whole app in my language, with the terms the game
actually uses?"*.

## What it does (scope)

1. **Choose the language** — Spanish or English — from anywhere in the app.
2. **Localize everything** — interface copy **and** game terms follow the choice.
3. **Remember the choice** and start in a sensible default.

## How it works

### Switching

- A compact **ES / EN** switcher lives in the top navigation; the active language is
  marked.
- Switching is **immediate** — all interface copy and all game terms update at once,
  with no reload.

### What gets localized

- **Interface copy** — every user-facing string in the UI.
- **Game terms** — natures (and their stats), berries, ingredients, sub skills,
  specialties, main skills, and types. Each shows its **official** name in the chosen
  language.

### Default and memory

- On first visit with **no saved choice**, the app follows the **browser language**
  (Spanish if it starts with "es", otherwise English).
- The choice is **remembered** and reused on the next visit.

## Acceptance criteria

- The navigation shows an **ES / EN** switcher, with the **active** language marked.
- Switching updates **all** interface copy **and all** game terms **immediately**,
  without a reload.
- On a first visit with no saved choice, the app opens in **Spanish** if the browser
  is Spanish, otherwise **English**.
- The chosen language is **remembered** across sessions.
- Game terms show the **official** in-game name in each language — not a guess or a
  literal translation.
- A missing translation **falls back** gracefully (to English, then the raw key),
  never a blank.

## Guidelines

- **Everything localizes.** Both interface copy and game terms; no user-facing string
  is hardcoded in a single language.
- **Official game terms only.** Game vocabulary uses the official localization; never
  invent a term or translate it literally.
- **Remember and respect the user's choice**, and fall back to English rather than
  showing nothing when a string is missing.

## Out of scope

- **Species names** are **not translated yet** — they display in their canonical form
  in both languages.
- **Languages beyond Spanish and English.**
- **Locale-specific number/date formatting** — only the language of the text changes.
