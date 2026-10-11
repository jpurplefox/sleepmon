# Screenshot import

> Product document. The visual language lives in
> [`docs/design-system.md`](../design-system.md).

## Purpose

Typing a Pokémon in field by field — species, level, nature, three ingredients, up to
five sub skills — is the slowest part of using sleepmon, and the most error-prone:
a sub skill picked from a long list, an ingredient in the wrong slot. The game already
shows all of it on the Pokémon's summary screens.

**Screenshot import** reads those screens for you: you upload screenshots of one
Pokémon and the [Pokémon form](0003-pokemon-form.md) fills itself in, ready for you to
check and confirm. It answers *"how do I get this Pokémon from the game into sleepmon
without tedium or typos?"* — and makes a first load of a whole Box realistic.

## What it does (scope)

1. **An import action inside the Pokémon form** (create mode): *Import from
   screenshots*. Because the form is shared, the action is available wherever the form
   opens to create — the Box, Comparison and Team Analysis.
2. **Reads 1 to 3 screenshots of the same Pokémon**, taken in any of the game's
   languages.
3. **Fills the form** with what it read — species, level, nature, ingredients per slot,
   sub skills in slot order, main skill level, ribbon, and Mew's skill — and **marks
   what it could not read**.
4. **Never saves on its own.** The filled form is an ordinary unsaved form; the user
   reviews, corrects and submits it, and the caller decides persistence as always.
5. **Reserved and capped.** It needs a signed-in account and allows **50 reads per
   account per day**.

## How it works

### Starting an import

In a create form, *Import from screenshots* opens a small picker where the user adds
**1 to 3 images** (PNG, JPEG or WebP, up to 5 MB each) — typically the summary screen
and the sub-skills screen, since the game spreads the data over several screens. All
images must show the **same Pokémon**. Images are checked before reading: none, more
than 3, a wrong format or an oversized file is reported inline and nothing is read.

While reading, the picker shows progress and the form stays untouched; reading takes
a few seconds.

### What gets read

| Field | Read from the screenshots |
|---|---|
| Species | The Pokémon's name / sprite |
| Level | The level shown |
| Nature | The nature name |
| Ingredients | Each **unlocked** slot's ingredient, in slot order (Lv 1 / 30 / 60) |
| Sub skills | Each visible sub skill, in slot order (Lv 10 / 25 / 50 / 70 / 80) |
| Main skill level | The skill's level |
| Ribbon | The ribbon, when one is shown |
| Mew's skill | The *Versatile* skill currently shown, for Mew only |

Every value is mapped to the **catalog**: the reading can only produce species,
natures, ingredients and sub skills sleepmon knows, whatever the screenshot's
language. A value that doesn't match the catalog — or that the species can't have
(e.g. an ingredient outside its pool) — is treated as **not read**, never invented.

### Filling the form

- **Read fields** replace the form's current values.
- **Unread fields** keep the create defaults (level 30, no nature, no sub skills, no
  ribbon, skill level 1; ingredients at each slot's first valid option) and carry a
  **"Not read — check it"** mark that clears as soon as the user edits that field.
- A short line at the top of the form says how the reading went: *"Read from 2
  screenshots — check the marked fields"*, or *"Read from 2 screenshots"* when
  nothing is marked.
- If the **species** can't be recognized, nothing is filled and the picker says
  *"We couldn't recognize a Pokémon in these screenshots"*.

From there it is the regular form: plan-ahead slots, validation and submit work as in
[the Pokémon form](0003-pokemon-form.md). The user can import again; a new import
replaces the previous one's values and marks.

### Access and the daily cap

- Importing is a **reserved** action ([Authentication](0010-authentication.md)):
  without a session, *Import from screenshots* shows the contextual sign-in prompt and,
  after signing in, returns to the open form.
- Each account gets **50 reads per day**, reset at 00:00 UTC. A read counts when it
  reaches the model, whatever its outcome (including *not recognized*); images
  rejected before reading do not count.
- When the cap is reached, the action says *"You've used today's 50 imports — they
  reset at <local time>"* and stays unavailable until then; the form keeps working by
  hand.

### Privacy

Screenshots are sent to an AI model (Anthropic's Claude, through Amazon Web Services)
only to be read, and are **discarded right after**: sleepmon never stores them, and
the provider does not keep them or train on them. The
[privacy page](0018-account-and-privacy.md) says so.

## Acceptance criteria

- **Happy path:** screenshots of a Lv 25 Pikachu with a nature, 2 sub skills, skill
  level 3 and its Lv 1 ingredient visible → the form opens with species Pikachu, level
  25, that nature, those 2 sub skills in slot order, skill level 3 and the Lv 1
  ingredient; the Lv 30 and Lv 60 ingredient slots carry *"Not read — check it"*.
- **Any language:** the same Pokémon captured with the game in Spanish and in English
  fills the form with the same values.
- **Nothing is saved** until the user submits; dismissing the form after an import
  makes no changes anywhere.
- **Catalog only:** a value that isn't in the catalog or isn't valid for the species
  is never filled; its field is marked *"Not read — check it"*.
- **Unread mark** disappears from a field once the user changes it.
- **Not a Pokémon:** screenshots without a recognizable Pokémon Sleep species → *"We
  couldn't recognize a Pokémon in these screenshots"*; the form is unchanged; the read
  counts toward the cap.
- **Invalid images:** 0 images → the import can't be sent; 4+ images, a non
  PNG/JPEG/WebP file or a file over 5 MB → an inline error before reading; nothing
  counts toward the cap.
- **Signed out:** *Import from screenshots* shows the sign-in prompt; after signing in
  the user is back on the same form with what they had entered.
- **Daily cap:** the 51st read of the day is refused without reading, with the reset
  time in the user's local time; manual entry still works.
- **Service failure** (timeout, provider error) → *"We couldn't read the screenshots
  — try again"*; the form keeps whatever the user had entered.
- **Re-import** replaces the previous import's values and marks.
- **Edit mode** does not offer the import.

## Guidelines

- **A suggestion, never a save.** The reading only fills the form; a person always
  reviews and submits, and the domain validates it like any other config.
- **The catalog rules here too.** The reading can only produce values the catalog
  knows; when in doubt it leaves a field unread rather than guessing.
- **One form, still agnostic of its caller.** Import lives in the shared form, so
  every tool that creates a Pokémon gets it, and none of them handles it specially.
- **No image is kept.** Screenshots exist only for the duration of one read.
- **The cap protects the service, not the user's flow.** Hitting it never blocks
  manual entry.

## Out of scope

- **Edit mode.** Importing over an existing Pokémon is not offered.
- **Bulk import.** One Pokémon per import; no queue of several Pokémon.
- **Storing screenshots** or keeping a history of imports.
- **Reading anything else** from the game: teams, maps, Snorlax, recipes, the Player
  profile.
- **Open access.** Signed-out users can't import; there is no anonymous allowance.
