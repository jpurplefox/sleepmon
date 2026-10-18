# Screenshot import

> Product document. The visual language lives in
> [`docs/design-system.md`](../design-system.md).

## Purpose

Typing a Pokémon in field by field — species, level, nature, three ingredients, up to
five sub skills — is the slowest part of using sleepmon, and the most error-prone:
a sub skill picked from a long list, an ingredient in the wrong slot. The game already
shows all of it on the Pokémon's summary screens.

**Screenshot import** reads those screens for you: you upload screenshots of one
Pokémon and the [Pokémon form](0003-pokemon-form.md) opens already filled in, ready for
you to check and confirm. It answers *"how do I get this Pokémon from the game into sleepmon
without tedium or typos?"* — and makes a first load of a whole Box realistic.

## What it does (scope)

1. **A third way to add a Pokémon** — **+ From screenshots** (ES: **+ Desde
   imágenes**) — next to the ones that exist today, wherever a Pokémon is added: the
   Box, Comparison and Team Analysis.
2. **Reads 1 to 3 screenshots of the same Pokémon**, taken in any of the game's
   languages.
3. **Opens the Pokémon form filled** with what it read — species, level, nature, ingredients per slot,
   sub skills in slot order, main skill level, ribbon, and Mew's skill — and **marks
   what it could not read**.
4. **Never saves on its own.** The filled form is an ordinary unsaved form; the user
   reviews, corrects and submits it, and the caller decides persistence as always.
5. **Reserved and capped.** It needs a signed-in account and allows **50 reads per
   account per day**.

## How it works

### Where it lives

**+ From screenshots** sits with the other ways to add, always **second**: first what
you create (by hand, or from screenshots), last what you already saved.

- **Comparison** and **Team Analysis** — the add cell offers *+ New*, *+ From
  screenshots*, *+ My Pokémon*; Team Analysis's **Split** menu offers the same three,
  in the same order, for a slot's second Pokémon.
- **Box** — next to *+ Add Pokémon* in the header.

The Spanish label avoids *captura*, which in Pokémon means catching one: the button
says *Desde imágenes*, and *capturas de pantalla* appears only inside the dialog,
where the context is clear.

### Reading

The button opens an **Import from screenshots** dialog where the user adds **1 to 3
images** (PNG, JPEG or WebP, up to 5 MB each) — typically the summary screen and the
sub-skills screen, since the game spreads the data over several screens. All images
must show the **same Pokémon**. Images are checked before reading: none, a wrong
format or an oversized file is reported in the dialog and nothing is read; a 4th
can't be added.

While reading, the dialog shows progress; reading takes a few seconds. A reading
that got anything out of the screenshots replaces the dialog with the filled form —
even when the species itself wasn't recognized; one that read nothing at all stays in
the dialog with its error, so the user can change the images.

### What gets read

| Field | Read from the screenshots |
|---|---|
| Species | The Pokémon's artwork, within the evolution line named on its candies (the candies always carry the line's first stage, so they narrow the choice but never decide it) |
| Level | The level shown |
| Nature | The nature name |
| Ingredients | Each slot's ingredient, in slot order (Lv 1 / 30 / 60) — **locked slots too**: the game shows them dimmed, and the form already holds not-yet-unlocked slots |
| Sub skills | Each visible sub skill, in slot order (Lv 10 / 25 / 50 / 70 / 80) |
| Main skill level | The skill's level |
| Ribbon | Derived from the hours of **Sleeping Time Shared**: the highest ribbon threshold reached (200 / 500 / 1000 / 2000 h) |
| Mew's skill | The *Versatile* skill currently shown, for Mew only |

Every value is mapped to the **catalog**: the reading can only produce species,
natures, ingredients and sub skills sleepmon knows, whatever the screenshot's
language. A value that doesn't match the catalog — or that the species can't have
(e.g. an ingredient outside its pool) — is treated as **not read**, never invented.

### The filled form

- It is the regular **Add Pokémon** form, opened with the **read values**.
- **Unread fields** keep the create defaults (level 30, no nature, no sub skills, no
  ribbon, skill level 1; ingredients at each slot's first valid option) and carry a
  **Not read** mark next to their name, which clears as soon as the user edits that
  field.
- A line at the top of the form says how the reading went and **names** what to
  check: *"Read from 2 screenshots · check Nature, Ingredients and Ribbon"*. It
  updates as marks clear, and reads *"Read from 2 screenshots"* when none is left.
- If the **species** can't be recognized, the form still opens with everything else
  that was read, the species empty and marked *Not read*. Read ingredients are kept
  as they are until a species is picked; then each one the species can't hold in its
  slot falls back to the slot's first option, and Ingredients is marked *Not read* if
  any did.
- Only when **nothing** could be read does no form open: the dialog says *"We
  couldn't recognize a Pokémon in these screenshots"*.

From there, plan-ahead slots, validation and submit work as in
[the Pokémon form](0003-pokemon-form.md). **One reading per import:** the form offers
no way to import again — to retry, the user closes it and starts a new import.

### Access and the daily cap

- Importing is a **reserved** action ([Authentication](0010-authentication.md)):
  without a session, *+ From screenshots* shows the contextual sign-in prompt and,
  after signing in, opens the import dialog.
- Each account gets **50 reads per day**, reset at 00:00 UTC. A read counts when it
  reaches the model, whatever its outcome (including *not recognized*); images
  rejected before reading do not count.
- When the cap is reached, the button stays available and the dialog says *"You've
  used today's 50 imports. They reset at <local time>"* and points to *+ New*;
  adding by hand keeps working.

### Privacy

Screenshots are sent to an AI model (Qwen3-VL, through Amazon Bedrock)
only to be read, and are **discarded right after**: sleepmon never stores them, and
the provider does not keep them or train on them. The
[privacy page](0018-account-and-privacy.md) says so.

## Acceptance criteria

- **Happy path:** screenshots of a Lv 57 Magnezone with its nature, 5 sub skills, skill
  level 7 and its three ingredients (the Lv 60 one shown locked) → the form opens with
  species Magnezone, level 57, that nature, the 5 sub skills in slot order, skill level
  7 and all three ingredients, the locked one included; nothing is marked *Not read*.
- **Evolution line:** a Sceptile whose screen reads "Treecko Candies" is read as
  Sceptile, not Treecko.
- **Any language:** the same Pokémon captured with the game in Spanish and in English
  fills the form with the same values.
- **Nothing is saved** until the user submits; dismissing the form after an import
  makes no changes anywhere.
- **Catalog only:** a value that isn't in the catalog or isn't valid for the species
  is never filled; its field is marked *Not read*.
- **Unread mark** disappears from a field once the user changes it, and the top line
  stops naming it.
- **Species not recognized:** screenshots whose species can't be told but show its
  level, nature, ingredients or sub skills → the form opens with those values and
  Species marked *Not read*; picking a species keeps the read ingredients it allows in
  each slot.
- **Not a Pokémon:** screenshots from which nothing can be read → *"We couldn't
  recognize a Pokémon in these screenshots"* in the dialog; no form opens; the read
  counts toward the cap.
- **Invalid images:** 0 images → *Read* is disabled; a 4th image can't be added; a
  non PNG/JPEG/WebP file or a file over 5 MB → an error in the dialog before reading;
  nothing counts toward the cap.
- **Button order:** in every add cell and the Split menu → *+ New*, *+ From
  screenshots*, *+ My Pokémon*; in the Box header → *+ Add Pokémon*, *+ From
  screenshots*.
- **Signed out:** *+ From screenshots* shows the sign-in prompt; after signing in the
  import dialog opens.
- **Daily cap:** the 51st read of the day is refused without reading; the dialog shows
  the reset time in the user's local time; *+ New* still works.
- **Service failure** (timeout, provider error) → *"We couldn't read the screenshots.
  Try again"* in the dialog, with the images still there.
- **One reading per import:** the filled form has no re-import action.
- **Editing** an existing Pokémon offers no import.

## Guidelines

- **A suggestion, never a save.** The reading only fills the form; a person always
  reviews and submits, and the domain validates it like any other config.
- **The catalog rules here too.** The reading can only produce values the catalog
  knows; when in doubt it leaves a field unread rather than guessing.
- **One more way to add, the same form after it.** Import sits wherever adding does
  and ends in the shared form, so every tool gets it the same way and persistence
  stays the caller's.
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
