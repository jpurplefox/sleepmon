---
name: finish
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for merge, PR, or cleanup
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and waiting
for the user's explicit confirmation before executing any of them.

**Core principle:** Verify tests → Detect environment → Present options →
**Wait for confirmation** → Execute the confirmed choice → Clean up (also
confirmed).

**Key behavior change from upstream:** this fork never runs `git commit`,
`git merge`, `git push`, or `gh pr` on its own. Every step that would execute
one of those commands is instead presented to the user as a proposal — the
exact command(s) that will run — and the skill stops and waits for an
explicit go-ahead before running anything. Showing the command is fine and
encouraged (the user should see what will happen); running it without
confirmation is not.

**Announce at start:** "I'm using the finish skill to complete this work."

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run the project's test suite, e.g.:
cd backend && pytest -m "not integration"
```

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Detect Environment

**Determine workspace state before presenting options:**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

This determines which menu to show and how cleanup would work:

| State | Menu | Cleanup |
|-------|------|---------|
| `GIT_DIR == GIT_COMMON` (normal repo) | Standard 4 options | No worktree to clean up |
| `GIT_DIR != GIT_COMMON`, named branch | Standard 4 options | Provenance-based (see Step 6), offered not forced |
| `GIT_DIR != GIT_COMMON`, detached HEAD | Reduced 3 options (no merge) | No cleanup (externally managed) |

### Step 3: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main — is that correct?"

Branch names in this project follow the convention enforced by the `branch`
skill (`feat/…`, `fix/…`, `task/…`, etc.). When referring to "the feature
branch" below, assume that convention rather than an arbitrary name — but
don't invent or rename anything; use the branch that's actually checked out.

### Step 4: Present Options

**Normal repo and named-branch worktree — present exactly these 4 options:**

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Detached HEAD — present exactly these 3 options:**

```
Implementation complete. You're on a detached HEAD (externally managed workspace).

1. Push as new branch and create a Pull Request
2. Keep as-is (I'll handle it later)
3. Discard this work

Which option?
```

**Don't add explanation** — keep options concise.

**Then stop and wait.** Do not pick a default, do not proceed on silence or
ambiguity — ask again if the reply doesn't clearly map to one option.

### Step 5: Confirm, Then Execute the Chosen Option

For whichever option the user picks, first show the exact command(s) that
will run, then wait for an explicit confirmation ("yes", "go ahead", "do it")
before running them. Never chain the confirmation and the execution in the
same turn without an actual reply from the user in between.

#### Option 1: Merge Locally

Propose:

```bash
# Get main repo root for CWD safety
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"

# Merge first — verify success before removing anything
git checkout <base-branch>
git pull
git merge <feature-branch>

# Verify tests on merged result
<test command>
```

Say: "I'll run the commands above to merge `<feature-branch>` into
`<base-branch>` and re-run tests. Confirm to proceed?" **Wait for the
confirmation.** Only then run them.

If the merge and tests succeed, propose cleanup (Step 6) and branch deletion
as a separate confirmed action:

```bash
git branch -d <feature-branch>
```

Say: "Merge succeeded. Want me to also remove the worktree (if any) and
delete the local branch `<feature-branch>`?" Wait for the answer before
running Step 6 / the `git branch -d`.

#### Option 2: Push and Create PR

Propose:

```bash
git push -u origin <feature-branch>
gh pr create --title "..." --body "..."
```

Say: "This will push `<feature-branch>` and open a PR with the title/body
above. Confirm to proceed?" **Wait for the confirmation** before running
`git push` or `gh pr create`.

**Do NOT clean up worktree** — user needs it alive to iterate on PR feedback.
This applies regardless of confirmation — cleanup is never offered for this
option.

#### Option 3: Keep As-Is

No git action needed. Report: "Keeping branch `<name>`. Worktree preserved at
`<path>`." Nothing to confirm here since nothing is executed.

**Don't cleanup worktree.**

#### Option 4: Discard

**Confirm first, in detail:**
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for the exact typed confirmation `discard` — a generic "yes" is not
enough for a destructive action like this one.

If confirmed:
```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
```

Then: propose cleanup (Step 6) and, once that's done, propose the force
branch delete as its own step:
```bash
git branch -D <feature-branch>
```

Even inside an already-confirmed "discard" flow, still show the exact
commands before running each of them — the typed `discard` confirms intent
to destroy the work, it does not blanket-authorize every command silently.

### Step 6: Cleanup Workspace (offered, not forced)

**Only relevant for Options 1 and 4.** Options 2 and 3 always preserve the
worktree, and this step is never invoked for them.

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

**If `GIT_DIR == GIT_COMMON`:** Normal repo, no worktree to clean up. Done.

**If the worktree path is under `.claude/worktrees/` (or `.worktrees/` /
`worktrees/`):** our own tooling (see the `prepare` skill) created this
worktree — we're allowed to offer to clean it up. Propose:

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git worktree remove "$WORKTREE_PATH"
git worktree prune  # Self-healing: clean up any stale registrations
```

Say: "Want me to remove the worktree at `<path>` and prune stale
registrations?" Wait for confirmation before running `git worktree remove` /
`git worktree prune`.

**Otherwise:** The host environment (harness) owns this workspace. Do NOT
propose removing it. If your platform provides a workspace-exit tool, mention
it as an option; otherwise leave the workspace in place.

## Quick Reference

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | yes (confirmed) | - | - | yes (confirmed) |
| 2. Create PR | - | yes (confirmed) | yes | - |
| 3. Keep as-is | - | - | yes | - |
| 4. Discard | - | - | - | yes, forced (confirmed via typed "discard") |

## Closing Checklist

Before declaring the branch "finished", make sure:

- [ ] Tests were verified green before any option was presented.
- [ ] Exactly one option (1-4, or 1-3 for detached HEAD) was chosen by the
      user, not assumed.
- [ ] Every git-mutating command (`commit`, `merge`, `push`, `gh pr`, `branch
      -d/-D`, `worktree remove`) was shown to the user and explicitly
      confirmed before running — none were run speculatively "to save a
      round trip".
- [ ] Worktree cleanup (if any) was offered and confirmed, not assumed, and
      only attempted for worktrees this tooling owns (under
      `.claude/worktrees/`).
- [ ] The user knows the final state of the branch/worktree/PR.

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests before offering options

**Open-ended questions**
- **Problem:** "What should I do next?" is ambiguous
- **Fix:** Present exactly 4 structured options (or 3 for detached HEAD)

**Executing before confirmation**
- **Problem:** Running `git merge`/`git push`/`gh pr create`/`git branch -d`
  right after presenting the option, without waiting for the user's reply
- **Fix:** Always show the exact command(s) and stop; only run them after an
  explicit confirmation message from the user

**Cleaning up worktree for Option 2**
- **Problem:** Remove worktree user needs for PR iteration
- **Fix:** Only offer cleanup for Options 1 and 4, and only after confirmation

**Deleting branch before removing worktree**
- **Problem:** `git branch -d` fails because worktree still references the branch
- **Fix:** Merge first, remove worktree, then delete branch — each step
  confirmed individually

**Running git worktree remove from inside the worktree**
- **Problem:** Command fails silently when CWD is inside the worktree being removed
- **Fix:** Always `cd` to main repo root before proposing/running `git worktree remove`

**Cleaning up harness-owned worktrees**
- **Problem:** Removing a worktree the harness created causes phantom state
- **Fix:** Only propose cleanup for worktrees under `.claude/worktrees/` (or
  `.worktrees/`/`worktrees/`) — for anything else, defer to the harness

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require the exact typed word `discard`, not a generic "yes"

**Assuming confirmation from context**
- **Problem:** Treating an earlier "sounds good" about the plan as
  authorization to run destructive/irreversible git commands later
- **Fix:** Ask again, specifically, right before running each mutating command

## Red Flags

**Never:**
- Proceed with failing tests
- Merge, push, or delete a branch without the user having confirmed that
  specific action
- Merge without verifying tests on the result
- Delete work without the typed `discard` confirmation
- Force-push without explicit request
- Remove a worktree before confirming merge success (Option 1) or discard
  intent (Option 4)
- Clean up worktrees you didn't create (provenance check) or without asking
- Run `git worktree remove` from inside the worktree
- Run `git commit`, `git merge`, `git push`, or `gh pr` automatically as part
  of this skill's normal flow

**Always:**
- Verify tests before offering options
- Detect environment before presenting menu
- Present exactly 4 options (or 3 for detached HEAD)
- Show the exact command(s) before asking for confirmation
- Wait for an explicit reply before executing any git-mutating command
- Get typed `discard` confirmation for Option 4
- Offer worktree cleanup only for Options 1 & 4, and only after confirmation
- `cd` to main repo root before worktree removal
- Run `git worktree prune` after removal
