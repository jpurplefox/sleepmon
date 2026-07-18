# Authentication

## Purpose

Authentication turns sleepmon from an app of **shared** data into an app of
**personal** data: each person signs in with their Google account and, from then on,
their Box, their teams, and everything they save belong to them alone. It answers
*"whose Pokémon are these?"* — today the answer is "no one's / everyone's", and this
feature makes it "mine".

It is not a feature with its own page that the user "visits": it is a **cross-cutting
layer** that enables personal persistence and protects what is reserved. Its success
is measured by how little it is noticed — you sign in once and the app simply
remembers who you are.

## What it does (scope)

1. **Sign in with Google** — a single access method: the "Sign in with Google" button
   and the OAuth flow. No own username/password, no other providers.
2. **Visible identity** — once inside, a place where you recognize yourself (Google
   name and avatar) and from which you can **sign out**.
3. **Capability gate** — anything ephemeral stays open to anyone; anything that
   touches the Box asks for a session through a **contextual prompt** that, once
   resolved, returns you to what you were doing.
4. **Persistent, invisible session** — you stay signed in and the session renews on
   its own; you only sign in again after long inactivity or an explicit sign-out.
5. **Personal data** — each user sees and edits only their own Box/teams, starting
   empty (clean slate over the prototype's data).

## How it works

### Sign in with Google

The user taps **"Sign in with Google"**, picks their account in the Google flow, and
returns to the app already recognized. The first time an account signs in, the system
registers it (who they are — their Google identity, name, and avatar — is stored) and
creates their own space with an **empty Box**. On later visits, that same account
finds its data again. None of this asks for extra steps: choosing the Google account
is all it takes.

### The capability gate

The app distinguishes two classes of action:

- **Open** — purely ephemeral computation that neither reads nor writes the Box: the
  **Comparison in its volatile form** (Pokémon assembled on the spot, without pulling
  from the Box or saving), and the cross-cutting pieces (language, the production
  model as a calculation).
- **Reserved** — anything that reads or writes the Box: the **Box**, **"My Pokémon"**
  (Box picker), saving/pulling from Comparison, **Team Analysis** and, by dependency,
  the cooking plan and map bonuses.

When someone **without a session** attempts a reserved action, a **contextual prompt**
appears in place ("Sign in with Google to save to your Box") with the login button.
On completing the login, they **return to exactly what they were doing** — the action
that triggered the prompt resumes (or is one click away), without losing the context
they had built.

### Identity and sign-out

With a session active there is a place (profile menu) that shows the Google **name and
avatar** and offers **sign out**. On signing out, the app returns to the anonymous
state: reserved things lock again, open things stay available.

### The session that renews itself

After signing in, the user stays in **persistently**. As long as they keep using the
app now and then, the session **renews on its own, silently** — they never see a login
again. They are only asked to sign in again in two cases: **prolonged inactivity** (too
much time without using the app) or an **explicit sign-out**. If the silent renewal
fails (e.g. the session was revoked or fully expired), the app treats it as a finished
session: it degrades gracefully to the anonymous state and, if the user was in
something reserved, shows the contextual prompt to sign in again — no raw error screens,
no abrupt loss of what is on screen.

The concrete expirations, token rotation, and secure storage are **technical
concerns** outside this document; at the product level the promise is: *you sign in
once and never have to think about the login again*.

## Acceptance criteria

**Sign-in and registration**

- New user signs in with Google → registered, their space is created with an **empty
  Box** (empty-box message, not an error), and they see their name/avatar.
- Returning user signs in again → finds **their** Box and teams, not an empty one nor
  someone else's.
- Two different users → each sees **only** their own data; neither sees nor edits the
  other's.
- User cancels the Google flow (closes the popup / picks no account) → returns to
  where they were, stays anonymous, no raw error (at most "Sign-in wasn't completed").

**The gate**

- Anonymous uses the **ephemeral Comparison** (without pulling from the Box) → works
  in full, without asking for login.
- Anonymous taps a **reserved** action (save to the Box, open "My Pokémon", enter Team
  Analysis) → the **contextual prompt** appears with "Sign in with Google", not an
  error nor an abrupt redirect.
- Anonymous completes the login from that prompt → **returns to what they were doing**;
  the triggering action resumes or is one click away, with its context intact.
- Anonymous tries to reach a reserved page by direct URL → same treatment: contextual
  prompt / invitation to sign in, never someone else's data.

**Session**

- Signed-in user closes and reopens the app a while later → still in, without signing
  in again.
- The silent renewal happens without the user seeing anything (no "session expired"
  flicker during normal use).
- Renewal fails / session revoked / prolonged inactivity → the app degrades gracefully
  to the anonymous state; if the user was in something reserved, it shows the prompt to
  re-enter, with no raw error screen.
- **Sign out** → back to anonymous: reserved things lock, open things stay; reopening
  the app stays anonymous until signing in again.

**Isolation (observable security)**

- A request for reserved data without a valid session → is rejected; never returns
  data.
- Nothing lets a user read or modify another's Box/teams (not even by changing
  identifiers in the request).

## Guidelines

- **It shows by how little it shows.** Success is near-zero friction: you sign in once
  and the app remembers who you are. Any evolution keeps the session invisible (the
  rule of the chosen approach).
- **The gate is defined by persistence, not by screens.** The stable rule: *whatever
  reads or writes the Box asks for a session; anything purely ephemeral does not*. New
  features are classified by that yardstick, not case by case.
- **Always return to context.** No login may cost the user the ephemeral work they had
  assembled; the contextual prompt returns them to where they were.
- **Personal data, isolated by default.** Each user sees only their own; isolation is
  an invariant, not an option.
- **Google as the only door (v1).** A single provider, no own passwords; if another
  method is ever added, it is added without breaking the promise of simplicity.
- **Degrade gracefully.** A dropped/expired session is never shown as a raw error: it
  falls back to the anonymous state and invites the user to re-enter.

## Out of scope

- **Own username/password** and **other providers** (Apple, Facebook, magic email):
  Google only in v1.
- **Roles and permissions** (admin, sharing the Box with someone, collaborative teams):
  each account is an individual silo.
- **Advanced account management**: deleting the account, exporting data, merging two
  Google accounts, changing the associated email.
- **Preserving anonymous work across devices** or converting a "guest session" with
  saved data: the anonymous user persists nothing, so there is nothing to migrate on
  sign-in.
- **Technical detail** of tokens (expirations, refresh rotation, storage, endpoints):
  a technical concern, not a product one.
