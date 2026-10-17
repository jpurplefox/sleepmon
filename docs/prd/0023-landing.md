# Landing

> Product document. The visual language lives in
> [`docs/design-system.md`](../design-system.md).

## Purpose

`/` used to open Comparison straight away. Someone arriving from a search or from a
link without context landed in an empty tool with no idea what sleepmon is, and search
engines had no text to describe it.

The landing answers *"what is this, what can I do with it, and how far can I trust its
numbers?"* — on one public page. It presents the app through **what a player does with
it**, not through a list of tools: the menu already names the tools; the landing shows
why you'd open them.

## What it does (scope)

1. **Header** — one line on what sleepmon is, the main action **Start comparing**, and a
   secondary action that depends on the session.
2. **What you can do** — four use cases, each with a short title, one or two lines, and
   a link that drops you where that use case starts, illustrated with real captures of
   the app.
3. **Without and with an account** — a table of what you can do signed out and what an
   account adds.
4. **Frequently asked questions** — the model's assumptions and the usual doubts in plain
   language, as expandable questions, reachable at `/#faq`.
5. **Ways back** — the **sleepmon** brand in the menu and a **Frequently asked
   questions** link in the footer.

## How it works

### Who sees it

- `/` is **always** the landing, signed in or not. The tools keep their own URLs
  ([ADR-0008](../adr/0008-client-side-routing-per-tool-urls.md)).
- An **unknown address** shows the landing, instead of falling back to a tool.
- It is public and follows the active language (ES / EN): every text, the FAQ included,
  and also the page's title and description, so search results and link previews
  describe the app in that language.
- It is a page, not a tool: no context bar and no empty state
  ([Tool shell](0014-tool-shell.md)); the menu is the same as everywhere, with **no tool
  marked**.

### Header

- One line: sleepmon helps you decide which Pokémon to keep, level up and team up in
  Pokémon Sleep, by estimating what each one produces.
- **Start comparing** (main) opens [Comparison](0002-comparison.md).
- Secondary: **Sign in with Google** when signed out; **Go to my Box** when signed in.

### What you can do

Four use cases, in this order — from deciding on a catch, to the week's plan, to investing in its members:

1. **Caught a new one: is it worth it?** Load it from a game screenshot
   ([Screenshot import](0019-screenshot-import.md)) and compare it in one tap with your
   Box Pokémon through the suggestions ([Comparison](0002-comparison.md)). Links to
   Comparison.
2. **Compare and share.** Put two or more Pokémon side by side and send the comparison
   to a friend as a link, so they open the same Pokémon under the same map terms and can edit it
   ([Sharing a comparison](0020-share-comparison.md)). Links to Comparison.
3. **Plan your week.** Build the team for your map, choose the meals, and read its
   production and the Snorlax rating it reaches ([Team Analysis](0005-team-analysis.md),
   [Map bonuses & rating](0007-map-bonuses-rating.md)); keep it in Teams with an account
   ([Saved teams](0016-saved-teams.md)). Links to Team Analysis.
4. **What does it take to level it up?** See at a glance the candies and dream shards
   to its next unlock level, and what it gains when it gets there
   ([Level-up cost](0021-level-up-cost.md)). Links to the Box.

- Use cases carry no account marker; the table below says what needs one. Signed out, a
  link still opens the tool, which shows its own sign-in prompt
  ([Authentication](0010-authentication.md)) — the landing does not gate anything.

### Without and with an account

Right before the FAQ, a table with one row per feature and two columns, *without an
account* and *with an account*. Rows that work signed out come first:

| Feature | Without an account | With an account |
|---|---|---|
| Compare Pokémon | ✓ | ✓ |
| Analyze teams, maps and meals | ✓ | ✓ |
| Share comparisons with a link | ✓ | ✓ |
| Load Pokémon from screenshots | — | ✓ |
| Keep your Pokémon in the Box | — | ✓ |
| Box suggestions while comparing | — | ✓ |
| Level-up cost of each Pokémon | — | ✓ |
| Save teams | — | ✓ |
| Sleep schedule and progress in the Player profile | — | ✓ |

- Signed out, the table closes with **Sign in with Google**; signed in, it has no action.

### Frequently asked questions

Expandable questions, all closed at first, in this order — first how the numbers are
made, then what they can take into account, then the account:

1. **Where do the numbers come from?** They are an estimate of daily production — helps,
   day and night, inventory, skills ([Production model](0008-production-model.md)) —
   not values read from the game.
2. **How is energy taken into account?** As if it were always high: the model applies
   the speed bonus of a well-rested Pokémon all day long, the way it plays out with a
   healer on the team that keeps energy topped up. Energy given by skills shows as the
   skill's output, but doesn't change anyone's speed.
3. **Why do Ingredients specialists get +1 ingredient on expert maps, not +2?** The game
   gives them a *chance* at +2 but doesn't publish it; rather than invent the number,
   every member gets +1 ([Map bonuses & rating](0007-map-bonuses-rating.md)).
4. **Do the numbers follow my sleep?** Yes: they use your night sleep and, if you take
   one, your nap, saved in your Player profile
   ([Sleep schedule](0015-sleep-schedule.md)); signed out, a night of 8:30.
5. **Can I account for an event?** Yes: in Team Analysis you add the active event's
   bonuses (extra ingredients, skill boosts, a bigger pot…) and the whole team
   recomputes ([Event bonus](0012-event-bonus.md)).
6. **Will my team's ingredients be enough for my meals?** Team Analysis checks the three
   meals you choose against what the team gathers, and adds the cooking strength to the
   total ([Cooking plan](0006-cooking-plan.md)).
7. **How do I know what my Box is missing?** The Box shows which berries, ingredients
   and specialties your Pokémon cover and which they don't
   ([Box](0001-box.md)).
8. **Do I need an account, and what is saved?** Comparison and Team Analysis work
   without one. An account keeps your Box, saved teams and Player profile, and unlocks
   screenshot import; links to the [privacy page](0018-account-and-privacy.md).
9. **How does screenshot import work?** An AI model reads the screenshots and fills the
   Pokémon form for you to review. The images are never stored, and the model only
   receives the images — nothing that says who uploaded them
   ([Screenshot import](0019-screenshot-import.md)). It needs an account.

- `/#faq` opens the landing at the FAQ.

### Ways back

- Touching **sleepmon** in the menu opens the landing.
- The footer ([Account & privacy](0018-account-and-privacy.md)) gains **Frequently asked
  questions**, opening `/#faq`, on every screen.

## Acceptance criteria

- **Signed out:** `/` shows the landing with **Start comparing** and **Sign in with
  Google**; the four use cases with no account marker; the account table with its
  first three rows marked in both columns and the other six only *with an account*,
  closing with **Sign in with Google**; the FAQ with its nine questions closed.
- **Signed in:** `/` shows the same landing; the secondary action reads **Go to my Box**
  and opens `/box`; the account table has no sign-in.
- **Main action:** **Start comparing** opens `/compare`.
- **Use case links:** case 1 and 2 open `/compare`, case 3 opens `/team-analysis`, case 4 opens
  `/box`. Signed out, case 4 shows the Box's sign-in prompt — not an error.
- **FAQ:** opening `/#faq` shows the landing scrolled to the FAQ; touching a question
  opens its answer, touching it again closes it. Question 8 links to `/privacy`.
- **Footer:** **Frequently asked questions** in the footer, from any tool, opens `/#faq`.
- **Brand:** touching **sleepmon** from any tool opens `/`.
- **Menu:** on the landing, no tool in the menu is marked as current.
- **Unknown address:** `/whatever` shows the landing.
- **Tool URLs:** `/compare`, `/team-analysis`, `/box`, `/teams`, `/account` and
  `/privacy` open as before.
- **Language:** switching to EN translates the whole page, FAQ included, and the
  page's title; switching back restores ES.
- **Narrow screen:** at 375px the page never scrolls sideways.

## Guidelines

- **Use cases, not a tool list.** Each case starts from something a player wants to
  know or do; the tool it opens is how, not the headline.
- **Only what the app does today.** Every use case and every answer describes current
  behavior; when a feature changes, its use case or answer changes with it. Answers
  avoid figures that change with the feature (limits, quotas) and link to its PRD.
- **Plain language in the FAQ.** It explains assumptions in words a player uses; the
  detail stays in the feature's PRD.
- **No personal data on the landing.** It looks the same to everyone except the
  secondary action.
- **The landing never gates.** It links; the tools decide what needs an account.

## Out of scope

- An **"Is it official?"** answer: the footer and the privacy page already say it.
- Shared links' **expiry** and other sharing detail beyond use case 2.
- A **separate `/faq` page**.
- **Animations or interactive demos** of the tools.
- New **usage events** ([Usage metrics](0017-usage-metrics.md)).
- **How** the page becomes readable by search engines — a technical decision for
  architecture.
- Sending a signed-in user **straight to a tool** from `/`.
