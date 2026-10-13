# Sharing a comparison

## Purpose

A comparison is often made to **show someone else** — "which of these two Pikachu
should I keep?" asked in a group chat. **Sharing** turns a [Comparison](0002-comparison.md)
into something that travels: a **picture** of the cards, or a **link** that opens the
same comparison in sleepmon and, wherever it's pasted, **previews as that picture**.

It is built for the **phone**, where most sharing happens: on a phone the comparison
swipes one card per screen, but the picture always shows **every card side by side**,
so one image says what the whole comparison says.

## What it does (scope)

1. **Share** button in Comparison, once there is at least one card and every card has
   its numbers.
2. **The picture** — every card side by side, at the same fixed width whatever the
   screen, under a strip with the map terms (map, favorite berries, weekly bonus on an
   expert map). Shared through the phone's share sheet, or downloaded where the device
   can't share files.
3. **The link** — a short link (`…/s/<id>`) that previews as the picture and opens
   the comparison in sleepmon. Creating one needs a session.
4. **Opening a link** — the shared cards and map terms become the comparison.

## How it works

### The picture

- Drawn as the Share dialog opens, from the cards exactly as they are on screen: the
  same numbers, deltas against the base, the "Base" chip and the map's marks.
- A picture has nothing to tap: no action bar, no reorder arrows, no "Make base".
- The dialog shows it as a preview before anything is shared.
- **Share image** opens the phone's share sheet with the picture (a PNG). Where the
  device can't share files (most desktops) the button reads **Download image** and saves
  it instead.
- Needs no account: it never leaves the device unless the user shares it.

### The link

- **Share link** asks for a session first (the sign-in prompt explains that links are
  kept under the account, and that the picture needs none). Once signed in, it carries on.
- Creating the link uploads a **copy** of the cards' configs, the map terms, the
  sharer's language and a **lighter version of the picture** (for previews).
- The phone's share sheet then opens with the link; elsewhere it is copied to the
  clipboard. Either way the link stays on screen with **Copy** (and **Share**, on a
  phone) buttons, in case the first attempt was refused.
- **The preview** — pasted in WhatsApp, Telegram, Discord, X…, the link shows the
  picture with the title *"Comparación: Pikachu vs Raichu"* (or *"Comparison: …"*, in
  the sharer's language) and a one-line description.
- A share is a **frozen copy**: editing or deleting the Box Pokémon it came from, or
  changing the comparison afterwards, doesn't change it. Sharing again makes a new link.
- Anyone with the link can open it; links are random and unguessable, never listed.
- A share goes **with the sharer's account**: deleting the account deletes its links
  ([Account & privacy](0018-account-and-privacy.md)).

### Opening a link

- The link opens Comparison with the shared cards and map terms, **replacing** whatever
  the comparison held — as "Compare" from the Box does. While it loads: *"Opening the
  shared comparison…"*.
- The cards arrive as fresh, unlinked copies: the recipient can edit, clone, reorder or
  save them to their own Box like any other card.
- The numbers are computed again, with the **recipient's** sleep schedule (their Player
  profile, or the default night signed out), so they can differ from the picture's when
  the two schedules differ.
- Once opened, the address goes back to `/compare`: a reload doesn't reopen the share
  over later changes.
- An unknown or deleted link → *"That shared comparison doesn't exist or is no longer
  available."*, over whatever the comparison held.

## Acceptance criteria

- No cards → no Share button. A card still calculating → the button is disabled.
- The picture of a 4-card comparison shows the **4 cards in one row**, also on a phone,
  with deltas against the base and the "Base" chip, and no buttons.
- The picture's strip shows the map (or Normal), the favorite berries in their slots,
  and the weekly bonus only on an expert map.
- Signed out, **Share image** works; **Share link** opens the sign-in prompt with the
  link-specific text, and creates the link once signed in.
- A created link's page carries the picture as its Open Graph / Twitter image and the
  title *"Comparación: <species> vs <species>"* (or English, by the sharer's language).
- Opening `/compare?share=<id>` shows the shared cards (in order, the first as base)
  and map terms, unlinked from any Box, and the address becomes `/compare`.
- A card in the share that the catalog can't validate is refused when the link is
  created, not when it's opened.
- Deleting the account → its links answer "doesn't exist".

## Guidelines

- **The picture is the comparison.** Every card side by side, never the phone's
  carousel; the deltas and the base stay, since they are the point.
- **Phone first.** The share sheet is the main path; download and copy are the fallbacks.
- **Copy without coupling**, as everywhere in Comparison: a share copies configs, and
  opening one copies them again.
- **Only what's needed is kept**: the configs, the map terms, the language and the
  preview picture — nothing about the sharer is shown to the recipient.

## Out of scope

- Listing, renaming or deleting one's links (they go with the account).
- Sharing a Team Analysis line-up or a saved team.
- Carrying the sharer's sleep schedule or event settings into the recipient's numbers.
- Editing a share after it's created.
