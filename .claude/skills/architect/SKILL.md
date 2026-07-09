---
name: architect
description: Decides the technical architecture from the design document — file structure, module boundaries, interfaces, data flow, error handling. Writes an architecture doc to the session scratchpad and hands off to `plan`.
---

# Architecting the Solution

## Overview

Turn the *what* into the *how*. Given a design document that describes what to build, decide the technical shape of the solution — file structure, module boundaries, interfaces, data flow, error handling — **before** any task breakdown. Here you make the architectural decisions the implementation will rest on.

**Announce at start:** "I'm using the architect skill to design the technical architecture."

**Input:** the design document describing what to build — purpose, scope, rules, out-of-scope. Read it as the source of what to build; it deliberately leaves the *how* to you.

## Process

1. **Read the design document** and understand the product intent and its acceptance criteria.
2. **Read the ADRs already in force.** Check the index at `docs/adr/README.md` and read the records whose status is **Accepted** (skip `Deprecated` and `Superseded` ones — they no longer bind). Your architecture must respect these decisions; if you think one should change, that's a new ADR, not something you quietly work around.
3. **Explore the current codebase** before proposing anything — existing structure, patterns, and boundaries. Follow what's there.
4. **Decide the architecture** (see what this skill owns). For any significant decision with real alternatives, propose 2-3 options with trade-offs, lead with your recommendation, and get the user's approval before locking it in.
5. **Write the architecture doc** to the scratchpad. Whenever a decision is durable and cross-cutting, **flag it to the user**: say an ADR may be warranted and why. The user decides whether to record it — only if they agree, invoke the `adr` skill. Do not write ADRs yourself and do not create one without the user's go-ahead.
6. **Self-review the architecture doc** with fresh eyes (see below); fix any gaps inline.
7. **User reviews the architecture doc** before handoff.
8. **Hand off to `plan`.**

## What this skill owns

The design document says *what*; this skill decides *how*. The architecture doc must capture:

- **File structure** — which files/modules exist and what each is responsible for. Clear boundaries, one responsibility each; files that change together live together; split by responsibility, not by technical layer. In existing codebases, follow established patterns — don't unilaterally restructure, but if a file you're touching has grown unwieldy, a split is reasonable.
- **Interfaces** — the contracts between components: exact signatures, parameter and return types. Make them concrete.
- **Data flow** — how data moves through the pieces.
- **Error handling** — the strategy for failures at each boundary.
- **Test seams** — for each unit/boundary, how it gets verified: what is tested in isolation, what is faked at which port, and what needs an integration test.
- **Constraints & invariants** — the project-wide rules the implementation must hold, distilled from the ADRs in force and the design (e.g. layering rules, parameterized queries, no infra imports in the domain). Capture them explicitly.
- **Acceptance-criteria traceability** — map each acceptance criterion from the design to the component(s)/seam that satisfy it, so nothing falls through the cracks.
- **Integration points** — where this meets existing code: what it touches, which patterns to follow, and what must not break (from your codebase exploration).

Design units you can understand and test independently: for each, what does it do, how is it used, what does it depend on?

## Output

- **Architecture doc → scratchpad.** Write the technical design to the session's scratchpad directory, under `architecture/` (the path the harness injects), as `architecture/YYYY-MM-DD-<slug>.md`. It is ephemeral scaffolding — do **not** `git add`/`commit` it. It carries everything in *What this skill owns*: file structure, interfaces (with exact signatures), data flow, error handling, test seams, constraints & invariants, acceptance-criteria traceability, and integration points.
- **Cross-cutting decisions → flag, don't decide.** When a durable decision reaches beyond this feature (a new dependency, a boundary or pattern that outlives it), **detect it and report it to the user** — say an ADR may be warranted and why. The user decides whether to create one; only with their go-ahead, invoke the `adr` skill to write it. Never write ADRs yourself or create one unprompted. Routine architecture stays in the scratchpad doc.

## Architecture Doc Self-Review

After writing the architecture doc, look at it with fresh eyes against the design document:

1. **Placeholder / TODO scan:** any "TBD", "TODO", "decide later", or vague hand-waving ("handle appropriately", "some service")? The doc must be concrete enough to build from without guessing. Fix them.
2. **AC coverage:** does every acceptance criterion in the design trace to a component/seam here? List any criterion with no home and close the gap.
3. **Interfaces concrete:** does every interface have exact signatures and types — not prose descriptions?
4. **Test seams:** does every unit/boundary say how it is verified? A piece with no test approach is a gap.
5. **Constraints & ADRs:** are the project-wide invariants captured, and does nothing in the architecture contradict an ADR in force?

Fix any issues inline. No need to re-review — just fix and move on.

## User Review Gate

Ask the user to review the architecture before proceeding:

> "Architecture written to `<path>` — take a look, especially the interfaces and the acceptance-criteria coverage. Let me know if you'd like changes before I hand it to `plan`."

Wait for the user's response. If they request changes, make them and re-run the self-review. Only proceed once the user approves.

## Handoff

Invoke the `plan` skill to turn this architecture into a task-by-task implementation plan. Do NOT invoke any other skill. `plan` is the next step.
