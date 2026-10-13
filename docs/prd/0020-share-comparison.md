# Sharing a comparison

> Product document. The visual language lives in
> [`docs/design-system.md`](../design-system.md).

## Purpose

A comparison is often made to **show someone else** — "which of these two Pikachu
should I keep?" asked in a group chat. **Sharing** turns a [Comparison](0002-comparison.md)
into something that travels, in two forms:

- a **picture** of every card, readable on its own;
- a **link** that, wherever it is pasted, previews as that same picture, and opens the
  comparison in sleepmon for the recipient to **edit or save** as their own.

It is built for the **phone**, where most sharing happens. On a phone the comparison
swipes one card per screen, but the picture always shows **every card side by side**.

## What it does (scope)

1. **Share button** in Comparison, once there is at least one card.
2. **Share dialog** — a preview of the picture, and two actions: **Share image** and
   **Share link**.
3. **The picture** — every card side by side, under a strip with the context they were
   compared in: sleepmon's logo, the map, the favorite berries, the weekly bonus (expert
   map only), the sharer's sleep schedule, and the address `sleepmon.app`.
4. **The link** — created only when asked for. Anyone can create one, with or without
   an account (signed out, behind an anti-bot check that is usually invisible). It is a
   frozen copy of the comparison and expires after **90 days without being opened**.
5. **Opening a link** — the shared comparison replaces the recipient's, as cards of
   their own; the numbers use the recipient's sleep schedule, with a notice when it
   differs from the sharer's.

## How it works

### The share button

- Shown once the comparison has at least one card; **disabled** while any card is
  still calculating (the picture needs every card's numbers).
- Opens the share dialog.

### The picture

- Drawn as the dialog opens, from the cards exactly as they are on screen: the same
  numbers, the deltas against the base, the "Base" chip and the map's marks.
- A picture has nothing to tap: no action bar, no reorder arrows, no "Make base".
- **The strip** above the cards:
  - sleepmon's logo and name;
  - the map — the expert map's name, or "Normal";
  - the favorite berries, each in its slot (only when there are favorites);
  - the weekly bonus, only on an expert map;
  - the sharer's sleep schedule — the night, plus the nap when there is one (e.g.
    "8:30", "7:00 + nap 1:00"); signed out, the default night;
  - the address `sleepmon.app`, so the picture leads back to sleepmon even when it
    travels without the link.
- All text follows the sharer's language.
- **Share image** opens the phone's share sheet with the picture. Where the device
  can't share files (most desktops) the button reads **Download image** and saves it.
- The picture never leaves the device unless the user shares it.

### The link

- **Share link**:
  - signed out, first passes an anti-bot check — usually invisible; only suspicious
    traffic gets a challenge to tap. Signed in, there is no check;
  - keeps a copy of the cards, the map terms, the sharer's sleep schedule, the sharer's
    language and the picture;
  - then opens the phone's share sheet with the link; on a desktop, copies it to the
    clipboard.
- The link stays visible in the dialog with **Copy** (and **Share**, on a phone), in
  case the first attempt didn't go through.
- **The preview** — pasted in WhatsApp, Telegram, Discord, X…, the link shows the
  picture, the title *"Comparación: Pikachu vs Raichu"* (*"Comparison: …"* when the
  sharer used English) and a one-line description.
- **A frozen copy** — editing the comparison or the Box Pokémon afterwards doesn't
  change the link. Sharing again makes a new link.
- Links are random and unguessable, and never listed anywhere.
- **Expiry** — every time someone opens the link its 90 days start over; after 90 days
  without anyone opening it, it expires.
- **Deleting the account** deletes the links created while signed in to it
  ([Account & privacy](0018-account-and-privacy.md)). Links created signed out belong
  to no one and live until they expire.

### Opening a link

- While it loads: *"Opening the shared comparison…"*.
- The shared comparison **replaces** whatever Comparison held, without asking — as
  "Compare" from the Box does.
- The cards arrive unlinked from any Box, as fresh cards: they can be edited, cloned,
  reordered or saved to the recipient's Box. The map, favorite berries and weekly bonus
  are the ones the sharer left.
- The numbers are computed with the **recipient's** sleep schedule (their Player
  profile, or the default night signed out), like every number they see.
- When the two schedules differ, a notice shows above the cards: *"Whoever shared this
  comparison sleeps 7:00 + nap 1:00; the numbers use your schedule (8:30) and may not
  match theirs."* It can be closed with ×, and goes away on moving to another tool or
  reloading. When the schedules match, there is no notice.
- Once opened, the address goes back to `/compare`, so a reload doesn't reopen the link
  over later changes.
- **An expired or unknown link** → *"That shared comparison doesn't exist or has
  expired."*; the recipient's comparison stays as it was.

## Acceptance criteria

**Button and dialog**

- No cards → no Share button. A card still calculating → the button is disabled.
- One card → the picture shows that card alone, with no "Base" chip and no deltas.

**The picture**

- A 4-card comparison shared from a phone → a picture with **the 4 cards in one row**:
  the first with the "Base" chip, the other 3 with their deltas against it, none with
  buttons.
- The strip shows "Normal" on the normal map; the favorite berries in their slots; the
  weekly bonus only on an expert map.
- The strip shows the sharer's sleep schedule — "8:30" signed out, "7:00 + nap 1:00"
  for a profile with a nap — and `sleepmon.app`.
- On a device that can't share files → the button reads "Download image" and saves the
  picture.
- The picture can't be drawn → *"Couldn't put the image together. Try again."*; both
  actions stay disabled.

**The link**

- Signed out, "Share link" creates the link without asking to sign in. Failing the
  anti-bot check → *"We couldn't verify you're not a bot. Try again."*; nothing is
  created.
- Signed in, the link is created with no check.
- Creating the link fails → *"Couldn't create the link. Try again."*
- A created link previews with the picture and the title *"Comparación: Pikachu vs
  Raichu"*; shared from the app in English, *"Comparison: Pikachu vs Raichu"*.
- Changing the comparison after creating the link → the link still opens the original.

**Opening a link**

- Opening a 2-card link while holding 3 cards → exactly those 2 cards, in the shared
  order (the first is the base), with the shared map, berries and weekly bonus; the
  address becomes `/compare`.
- The opened cards are tied to no Box: "Save to Box" creates a new Pokémon in the
  recipient's Box.
- Schedules differ (sharer 7:00, recipient 8:30) → the notice shows; × closes it.
  Schedules match → no notice.
- A link last opened 89 days ago still opens, and its 90 days start over. A link not
  opened in more than 90 days → *"That shared comparison doesn't exist or has
  expired."*, the same as a link that never existed; the recipient's comparison stays
  as it was.
- Deleting an account → the links created signed in to it answer "doesn't exist or has
  expired".

## Guidelines

- **The picture is the comparison.** Every card side by side, never the phone's
  carousel; the base and the deltas stay, since they are the point.
- **Phone first.** The share sheet is the main path; download and copy are the
  fallbacks.
- **Copy without coupling**, as everywhere in Comparison: sharing copies the cards, and
  opening a link copies them again; nothing stays tied to anyone's Box.
- **No account needed** to open a link, nor to share. A session only skips the anti-bot
  check and makes one's links go with the account.
- **The numbers are always yours.** An opened comparison computes with the recipient's
  sleep schedule, like everything else they see; a different schedule is pointed out,
  never applied.
- **Only what's needed is kept**: the cards, the map terms, the sleep schedule, the
  language and the picture. The recipient sees nothing about the sharer beyond their
  sleep schedule in the notice.

## Out of scope

- Listing, renaming or deleting one's links — they go by expiry or with the account.
- Sharing a Team Analysis line-up or a saved team.
- Carrying the sharer's event settings (events are not part of Comparison).
- Editing a link after it's created.
- Choosing which cards go in the picture: it always has all of them.
