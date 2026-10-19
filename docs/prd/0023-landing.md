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

Expandable questions, all closed at first, in this order — first why sleepmon exists,
then how the numbers are made and why there is no rater, then what they take into
account, the expert-map detail and screenshot import, and last whether it is free:

1. **Why another calculator, when the community already has several?** The existing ones
   show a lot of information, which can overwhelm or be hard to read. sleepmon doesn't
   add tools; it answers the usual questions — is this catch worth it, how do I plan the
   week, which Pokémon gets the candies — with just the information needed to decide,
   easy to read.
2. **Where do the numbers come from?** They are an estimate of daily production — helps,
   day and night, inventory, skills ([Production model](0008-production-model.md)) —
   not values read from the game. They are averages: skills trigger at random, so a single
   day can come out higher or lower.
3. **Will there be a Pokémon rater?** Other tools already rate them, but many Pokémon
   can't be summed up in one number: context matters. A Charge Strength skill Pokémon is
   worth the total strength it adds, not its number of procs — fewer procs with Berry
   Finding S can add more; the same goes for skill Pokémon that gather ingredients. And
   the map can flip the order, above all among berry and strength Pokémon. So sleepmon
   compares them in the player's context.
4. **How is energy taken into account?** As if it were always high: the model applies
   the speed bonus of a well-rested Pokémon all day long, the way it plays out with a
   healer on the team that keeps energy topped up. Energy given by skills shows as the
   skill's output, but doesn't change anyone's speed.
5. **How is the Pokémon's inventory estimated?** During the day the model assumes you
   collect the ingredients before the inventory fills up. While you sleep, it calculates
   when it fills up and how that affects production. The Player profile holds up to two
   sleep sessions ([Sleep schedule](0015-sleep-schedule.md)); by default, a single one of
   8:30.
6. **What happens during event weeks?** Team Analysis already has the
   event's bonuses (extra ingredients, skill boosts, a bigger pot…) set, so there is
   nothing to load; they can still be set or adjusted by hand, and the whole team
   recomputes ([Event bonus](0012-event-bonus.md)).
7. **How does splitting a slot work in Team Analysis?** It simulates two Pokémon
   rotating through one slot. The math is simplified: each one's full-day production is
   prorated by the chosen percentage ([Team Analysis](0005-team-analysis.md)). It isn't
   meant for swaps every so many exact hours: in practice one rotates out once it has
   done its job (an ingredient Pokémon once it has stocked up), so a 66% / 33% split can
   mean two full days of one and a day of the other.
8. **Why doesn't Ingredient Magnet give specific ingredients?** They are too random to
   plan around: with 19 ingredients, counting on a particular one is too optimistic. So
   they show as generic ingredients and go into the pot as filler at the average value of
   all ingredients ([Cooking plan](0006-cooking-plan.md)). Ingredient Draw is the
   exception: each Pokémon draws from a short list aimed at specific recipes, so its
   ingredients count as specific ones.
9. **Why do meals count even when ingredients are missing?** What is missing can come
   from elsewhere — stock already on hand, ingredient tickets, daily login bonuses,
   Ingredient Magnet — so a meal adds its full strength anyway
   ([Cooking plan](0006-cooking-plan.md)). Team Analysis shows how much of each
   ingredient is missing; covering it is the player's call.
10. **Why doesn't a Pokémon's strength count its ingredients?** Berry and skill
   strength goes straight to Snorlax; ingredient strength doesn't. It depends on the dish
   and the recipe's level, on whether the ingredient belongs to the recipe or is filler,
   and it is often left out for lack of room in the pot. Adding it would be misleading
   and not comparable with the rest, so it stays out.
11. **Why do Ingredients specialists get +1 ingredient on expert maps, not +2?** The game
   gives them a *chance* at +2 but doesn't publish it; rather than invent the number,
   every member gets +1 ([Map bonuses & rating](0007-map-bonuses-rating.md)).
12. **How does loading Pokémon from screenshots work?** An AI model — Qwen3-VL 235B on
   Amazon Bedrock — reads the screenshots and fills the Pokémon form for the player to
   review ([Screenshot import](0019-screenshot-import.md)). The images are never stored,
   and the model only receives the images — nothing that says who uploaded them. It is
   restricted to registered users, with a per-user limit against abuse that normal use
   should never reach; the answer doesn't give the number.
13. **Is it free?** Yes, and it stays free: it is a personal project, used daily, that
   already has the essentials. The servers (about 35 dollars a month) are paid from other
   income; if that ever falls short, other ways are sought, never paid plans. The code is
   open source under the MIT license, so anyone can run their own server; the answer
   links to the [repository](https://github.com/jpurplefox/sleepmon).

- `/#faq` opens the landing at the FAQ.

### Ways back

- Touching **sleepmon** in the menu opens the landing.
- The footer ([Account & privacy](0018-account-and-privacy.md)) gains **Frequently asked
  questions**, opening `/#faq`, on every screen.

### Search engines and link previews

Search engines, link previews and AI crawlers often read a page without running the
app. `/` is written out for them in advance, so what they read is the landing itself.

- **Written out in English.** Until each language has its own address, `/` arrives with
  the whole landing already in English: the header, the four use cases with each
  story's steps, the account table and the thirteen questions with their answers. Its
  language, title, description and preview card are English too.
- **The same page comes alive.** Once the app loads, it takes over that page as it is:
  the stories play, the actions work, and the language switches to the visitor's.
- **No flash of the wrong page.** A visitor whose language is Spanish, or who opens a
  tool's address directly, sees a blank screen until the app loads, as before — never
  the English landing for an instant.
- **The FAQ as structured data.** The thirteen questions and answers are also published
  in the format search engines use for FAQs, with the same English text as the page.
- **One official address.** Every page names `https://sleepmon.app/` as the official
  address, and a sitemap listing it is announced to crawlers.
- **The page's language follows the app.** Inside the app, the page declares the active
  language, and the title and description follow it.

## Acceptance criteria

- **Signed out:** `/` shows the landing with **Start comparing** and **Sign in with
  Google**; the four use cases with no account marker; the account table with its
  first three rows marked in both columns and the other six only *with an account*,
  closing with **Sign in with Google**; the FAQ with its thirteen questions closed.
- **Signed in:** `/` shows the same landing; the secondary action reads **Go to my Box**
  and opens `/box`; the account table has no sign-in.
- **Main action:** **Start comparing** opens `/compare`.
- **Use case links:** case 1 and 2 open `/compare`, case 3 opens `/team-analysis`, case 4 opens
  `/box`. Signed out, case 4 shows the Box's sign-in prompt — not an error.
- **FAQ:** opening `/#faq` shows the landing scrolled to the FAQ; touching a question
  opens its answer, touching it again closes it.
- **Footer:** **Frequently asked questions** in the footer, from any tool, opens `/#faq`.
- **Brand:** touching **sleepmon** from any tool opens `/`.
- **Menu:** on the landing, no tool in the menu is marked as current.
- **Unknown address:** `/whatever` shows the landing.
- **Tool URLs:** `/compare`, `/team-analysis`, `/box`, `/teams`, `/account` and
  `/privacy` open as before.
- **Language:** switching to EN translates the whole page, FAQ included, and the
  page's title; switching back restores ES.
- **Narrow screen:** at 375px the page never scrolls sideways.
- **Without the app running:** fetching `https://sleepmon.app/` (e.g. with `curl`)
  returns the hero's title, the four use case titles, the nine account table rows and
  all thirteen questions with their answers, in English; the page declares English and
  its title, description and preview card are English.
- **Comes alive:** in a browser, that same page then plays its stories and its actions
  work as on any other visit; with reduced motion, each story rests on its last step.
- **Spanish visitor:** with Spanish as the saved or browser language, `/` shows a blank
  screen until the app loads, then the Spanish landing — never English text first.
- **Tool address:** reloading `/compare` never shows landing text, not even for an
  instant.
- **Structured data:** a structured-data validator (schema.org's Schema Markup
  Validator, or Google's Rich Results Test) reads the FAQ from `/` with its thirteen
  questions and reports no errors. Google may still not show it as a rich result: it
  reserves FAQ results for a few kinds of sites.
- **Official address and sitemap:** `/` names `https://sleepmon.app/` as its official
  address; `/sitemap.xml` lists it and `/robots.txt` points to the sitemap.
- **Declared language:** switching the app to ES makes the page declare Spanish and
  shows the Spanish title and description; switching back to EN declares English.

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
- **What crawlers read is what visitors see.** The written-out page and its structured
  data come from the same copy as the live landing; nothing is written only for
  crawlers.

## Out of scope

- An **"Is it official?"** answer: the footer and the privacy page already say it.
- Shared links' **expiry** and other sharing detail beyond use case 2.
- A **separate `/faq` page**.
- **Animations or interactive demos** of the tools.
- New **usage events** ([Usage metrics](0017-usage-metrics.md)).
- **One address per language** (`/es`, `/en`) so each is indexed on its own: it changes
  how the whole app picks its language ([Language](0009-language.md)).
- Writing out **other pages** (the tools, privacy) in advance, or listing them in the
  sitemap.
- Answering an **unknown address** with "not found": it keeps showing the landing.
- Sending a signed-in user **straight to a tool** from `/`.
