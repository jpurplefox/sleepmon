---
name: design
description: "Use before creative work: explores intent, requirements, and product; produces a product/functional document in docs/prd/."
---

# Help turn ideas into product designs

Help turn ideas into fully formed product/feature designs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design and get user approval.

**Scope boundary:** this skill owns the *product* definition — purpose, users, scope, functional mechanics, guidelines, out-of-scope. It does NOT own architecture or technical decisions. Technical topics (components, data flow, error handling, testing, file structure) are out of scope here: if one comes up in conversation, don't capture it — steer back to product.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.
</HARD-GATE>

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project goes through this process. A todo list, a single-function utility, a config change — all of them. "Simple" projects are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences for truly simple projects), but you MUST present it and get approval.

## Checklist

You MUST create a task for each of these items and complete them in order:

1. **Explore project context** — check files, docs, recent commits
2. **Ask clarifying questions** — one at a time, understand purpose/users/scope/success criteria
3. **Propose 2-3 approaches** — functional approaches (what the feature does and how it behaves for the user), with trade-offs and your recommendation
4. **Present design** — in sections scaled to their complexity, get user approval after each section
5. **Write feature doc** — save to `docs/prd/NNNN-<slug>.md` (numbered, kebab-case slug), following the existing template
6. **Update the features index** — add a line for the new feature in `docs/prd/README.md`
7. **Doc self-review** — quick inline check for placeholders, contradictions, ambiguity, scope (see below)
8. **User reviews written doc** — ask user to review the feature doc before proceeding
9. **Offer to commit the doc** — offer to commit the new PRD plus its index entry (stage only those two files); commit only if the user accepts
10. **Transition to the *how*** — invoke `visual` for a feature with a UI, or `architect` for a backend-only one

**The terminal state is the *how*.** Do NOT invoke mcp-builder or any implementation skill. After design you invoke `visual` (for a feature with a UI) or `architect` (backend-only) — nothing else.

## The Process

**Understanding the idea:**

- Check out the current project state first (files, docs, recent commits) — in particular skim `docs/prd/README.md` and a sibling feature doc to calibrate tone and altitude
- Before asking detailed questions, assess scope: if the request describes multiple independent subsystems (e.g., "build a platform with chat, file storage, billing, and analytics"), flag this immediately. Don't spend questions refining details of a project that needs to be decomposed first.
- If the project is too large for a single feature doc, help the user decompose into sub-projects: what are the independent pieces, how do they relate, what order should they be built? Then help design the first sub-project through the normal design flow. Each sub-project gets its own feature doc → plan → implementation cycle.
- For appropriately-scoped projects, ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: **purpose** (what question/need does this answer?), **users** (who uses it, when), **scope** (what's in, what's explicitly out), **success criteria**

**Exploring approaches:**

- Propose 2-3 different approaches with trade-offs — keep these functional/product approaches (different ways the feature could behave or be scoped for the user), not competing architectures
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**

- Once you believe you understand what you're building, present the design
- Scale each section to its complexity: a few sentences if straightforward, up to 200-300 words if nuanced
- Ask after each section whether it looks right so far
- Cover: **purpose** (what question it answers, why it exists), **scope** (what the user does, what they see), **functional mechanics** (how the behavior/calculation/flow works, in plain terms — not code), **acceptance criteria** (observable conditions that make the feature correct — including edge, error, and empty cases), **guidelines** (invariants the feature must keep respecting as it evolves), **out-of-scope** (explicitly what this does NOT do)
- Probe for the boundaries: what happens with no input, invalid input, or at the limits? Those answers become acceptance criteria — don't let them stay implicit.
- Technical questions that come up (how it's implemented, which module owns what, data flow) are out of scope here — don't capture them as design output. Steer the conversation back to product.
- Be ready to go back and clarify if something doesn't make sense

**Design for isolation and clarity:**

- Break the feature into smaller pieces that each answer one clear question for the user
- For each piece, you should be able to answer: what does the user get from it, when do they reach for it, and what does it explicitly not do?
- Can someone understand what the feature is for without reading the code? If the purpose needs the implementation to make sense, the scope needs work.

**Working in existing codebases:**

- Explore the current structure before proposing changes. Follow existing product conventions — check how similar features are documented in `docs/prd/`.
- Where an existing feature doc has problems that affect this work (stale scope, unclear guidelines), flag it and include a targeted fix as part of the design — the way a good product owner keeps docs honest.
- Don't propose unrelated changes to other features. Stay focused on what serves the current feature.

## After the Design

**Documentation:**

- Write the validated design to `docs/prd/NNNN-<slug>.md`, where `<slug>` is the feature name in kebab-case and `NNNN` is a zero-padded 4-digit number (e.g. `docs/prd/0001-<slug>.md`). Determine the next number by scanning the existing files in `docs/prd/`: take the highest existing `NNNN` and add 1; if the directory has no numbered docs yet, start at `0001`.
- Follow the structure already used in `docs/prd/`: a header blockquote ("Product document...") pointing at the design system (`docs/design-system.md`), then **Purpose**, **What it does (scope)**, a **How it works** section for the functional mechanics (no code, no architecture), **Acceptance criteria**, **Guidelines**, and **Out of scope**
- **Acceptance criteria** are observable, product-level conditions that make the feature correct — concrete, checkable, with real values where possible. Cover the happy path *and* the edges: no input / empty state, invalid or out-of-range input, and boundary/limit cases. Phrase them as outcomes the user can observe, never as implementation — a specific input mapped to its exact expected result, plus what the user sees for empty and invalid inputs (e.g. `given <specific input> → <exact expected output>`; `empty input → a clear empty state, not an error`).
- Add a bullet for the new feature to `docs/prd/README.md`, in the same style as the existing index entries (name, link, one-line description of what it does)
- Do NOT write any separate architecture document — that's out of scope for this skill
- Use elements-of-style:writing-clearly-and-concisely skill if available

**Feature Doc Self-Review:**
After writing the document and updating the index, look at both with fresh eyes:

1. **Placeholder scan:** Any "TBD", "TODO", incomplete sections, or vague requirements? Fix them.
2. **Internal consistency:** Do any sections contradict each other? Does "What it does" match "Out of scope" (no overlap, no gaps)?
3. **No architecture leakage:** Did any component names, data flow, file structure, or error-handling *implementation* slip into the doc? Move it out — a product doc doesn't carry technical detail. (Observable error/empty behavior is fine — that belongs in acceptance criteria.)
4. **Scope check:** Is this focused enough for a single implementation plan, or does it need decomposition?
5. **Ambiguity check:** Could any requirement be interpreted two different ways? If so, pick one and make it explicit.
6. **Acceptance criteria check:** Is each criterion concrete and observable (not vague, not implementation)? Do they cover the edges — empty/no input, invalid input, and boundary/limit cases — not just the happy path?

Fix any issues inline. No need to re-review — just fix and move on.

**User Review Gate:**
After the self-review loop passes, ask the user to review the written feature doc before proceeding:

> "Document written to `<path>` (and the index updated in docs/prd/README.md) — take a look and let me know if you'd like changes before we move on."

Wait for the user's response. If they request changes, make them and re-run the self-review loop. Only proceed once the user approves.

**Commit offer:**
Once the doc is approved, offer to commit it:

> "Want me to commit the new PRD? I'll stage only `<path>` and `docs/prd/README.md`."

If the user accepts, commit exactly those two files and nothing else — e.g. `git add <path> docs/prd/README.md && git commit -m "docs(prd): add <slug>"`. If they decline, leave it uncommitted. Either way, then move on.

**The *how*:**

- For a feature with a UI, invoke the `visual` skill; for a backend-only feature, invoke `architect` directly.
- Do NOT invoke any other skill.

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 functional approaches before settling
- **Incremental validation** - Present design, get approval before moving on
- **Product, not architecture** - purpose, users, scope, mechanics, guidelines, out-of-scope live in the product doc; components, data flow, and technical trade-offs are out of scope
- **Be flexible** - Go back and clarify when something doesn't make sense
