# Account & privacy

> Product document. The visual language lives in
> [`docs/design-system.md`](../design-system.md).

## Purpose

**Account & privacy** answers two questions any player may ask before trusting a fan
site with their Google account: *"how do I leave, and take my data with me out of
here?"* and *"who runs this, and is it official?"*.

It is also what going public needs: Google only lets an app's sign-in leave testing
mode with a public privacy-policy URL, and a fan tool built on Pokémon names should say
plainly that it is not affiliated with their owners.

The scope is deliberately minimal: an account page that ends with deleting the account,
a short privacy page, and one footer line. Nothing more than that.

## What it does (scope)

1. **Your account** — a page reached from the account menu (*Account & privacy*): who
   you are signed in as, what you have saved, a link to the privacy page and, last,
   **Delete my account**.
2. **Delete my account** — at the end of that page, with a confirmation that requires
   typing your email; deletes the account and everything saved on it, at once.
3. **Privacy page** — a short public page (`/privacy`): what is kept, the analytics and
   error reports, how to delete, and the contact email.
4. **Footer** — on every screen: a link to the privacy page, the contact email, and the
   non-affiliation notice.

## How it works

### Your account

- The **account menu** (signed in) gains **Account & privacy**, a neutral item before
  sign out. Deleting is deliberately *not* in the menu: it is one page away, never one
  tap away.
- It opens **Your account** (`/account`, signed in only; signed out it shows the usual
  sign-in prompt):
  - your Google photo, name and email;
  - **What you have saved**: the Box (how many Pokémon), saved teams (how many), Player
    profile (saved or not), and a link to the privacy page;
  - last, **Delete your account**: one line saying it deletes everything at once and
    cannot be undone, and a **Delete my account…** button.

### Delete my account

- **Delete my account…** opens a confirmation dialog that states what will be lost, with the real counts:
  *"This deletes your account, the 23 Pokémon in your Box, your 4 saved teams and your
  Player profile. It cannot be undone."* Counts of zero still read naturally
  ("your Box is empty", "no saved teams").
- The dialog shows the account's email and asks to **type it** to confirm. **Delete
  permanently** stays disabled until the typed text matches — ignoring letter case and
  surrounding spaces.
- **On success:** the account and everything saved on it (Box, saved teams, Player
  profile, sessions) are deleted immediately; the user is signed out, lands on the first
  tool, and sees *"Your account was deleted."* What was on screen in Comparison or Team
  Analysis stays, exactly as after signing out, just no longer linked to a Box.
- **On failure:** an error message in the dialog; nothing is deleted; the dialog stays
  open with the typed email kept.
- Signing in again later with the same Google account starts a **new, empty account**.
- Usage metrics and error reports already sent stay with the providers, linked only to
  an internal id that no longer belongs to anyone. The privacy page says so.
- It records the usage event `account_deleted` ([Usage metrics](0017-usage-metrics.md))
  with the Box size and the number of saved teams — counts only.

### Privacy page

- Public: it opens without signing in, in the current language (ES / EN), at `/privacy`.
  That address is the one given to Google.
- Short, plain language, in this order:
  1. **Who runs sleepmon** — a personal fan project — and the **contact email**.
  2. **What is kept with your account:** your Google id, email, name and photo, and what
     you save: Box, saved teams, Player profile. Kept until you delete the account.
  3. **In your browser:** a session cookie and a sign-in token stored in your
     browser keep you signed in, and your language choice is stored there too. No
     advertising or analytics cookies, and usage metrics store nothing in your browser.
  4. **Usage metrics and error reports:** anonymous usage of the tools (PostHog) and
     technical error reports (Sentry), tied only to an internal id — never your email or
     name; those tools do not store IP addresses.
  5. **Deleting your data:** *Delete my account* at the end of *Your account* (account
     menu → Account & privacy), or write to the contact email.
  6. **Last updated** date.

### Footer

- One discreet line at the bottom of every screen — tools, sign-in prompts and the
  privacy page:
  *Privacy · contact@… · sleepmon is a fan project, not affiliated with Nintendo,
  Creatures, GAME FREAK or The Pokémon Company. Pokémon and its names are trademarks of
  their respective owners.*
- The contact email is a single value set by the maintainer, shown identically in the
  footer and the privacy page.

## Acceptance criteria

- Signed in with a Box of 23 Pokémon and 4 saved teams → the dialog reads *"…the 23
  Pokémon in your Box, your 4 saved teams…"*; with an empty Box and no teams it says so
  instead of "0 Pokémon".
- Account email `Ana@Example.com`: typing `ana@example.com ` enables **Delete
  permanently**; typing `ana@example.co` or nothing keeps it disabled.
- Confirming → the user is signed out, lands on Comparison, and sees *"Your account was
  deleted."*; signing back in with the same Google account shows an empty Box, no saved
  teams and a default Player profile.
- A failed deletion (e.g. no connection) → an error in the dialog, the account and its
  data intact, the typed email still in the field.
- Closing the dialog (✕, Escape, Cancel) deletes nothing.
- The account menu has no delete item; *Account & privacy* opens *Your account*, which
  shows the photo, name, email, "23 Pokémon", "4" saved teams and ends with *Delete my
  account…*.
- Signed out, `/account` shows the sign-in prompt instead of the page.
- One user deleting their account leaves every other user's data untouched.
- `/privacy` opens signed out, in Spanish when the language is ES and in English when
  EN, and shows the contact email and the last-updated date.
- Every screen — each tool, the Box and Teams gate cards, the privacy page — shows the
  footer with the privacy link, the contact email and the non-affiliation notice.
- A successful deletion records `account_deleted` with `box_size: 23, saved_teams: 4`
  and nothing else about the user; a failed one records nothing.

## Guidelines

- **Leaving is always possible, never accidental.** One page away from the menu, one
  confirmation; the typed email exists only to prevent accidents, never as a hurdle.
- **Delete means delete.** No soft delete, no grace period, no hidden copy of the
  account's data in the app.
- **The privacy page tells the truth in a few lines.** When what is stored or sent
  changes (a new provider, a new field), the page and its date change with it.
- **Minimal by design.** No terms of service, consent banner or legal boilerplate until
  something actually requires them.

## Out of scope

- Exporting your data.
- A grace period, undo, or account recovery after deletion.
- Deleting already-sent usage metrics or error reports from PostHog or Sentry.
- Terms of service, a cookie/consent banner, an "About" page.
- Changing the account's email or linking another Google account.
