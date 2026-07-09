---
name: plan
description: "Writes a detailed implementation plan to the session scratchpad (not the repo) and hands it off to `build`."
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the plan skill to create the implementation plan."

**Context:** If working in an isolated worktree, it should have been created via the `prepare` skill at execution time.

**Save plans to:** the session's scratchpad directory, under `plans/` (the path the harness injects), as `plans/YYYY-MM-DD-<feature-name>.md`. Do not `git add`/`commit` the plan.
- (User preferences for plan location override this default)

## Input

You're handed two things: a **design document** (the *what* — purpose, scope, rules, out-of-scope, acceptance criteria) and an **architecture doc** from the `architect` skill (the *how* — file structure, interfaces, data flow, error handling). Your job is neither of those: it's to turn that architecture into an ordered, task-by-task implementation plan. Don't re-decide the architecture — follow it. If it's missing, wrong, or contradicts the design document, raise it rather than inventing around it.

## Scope Check

If the design document covers multiple independent subsystems, it should have been broken into separate documents upstream. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

The architecture doc already defines the file structure and interfaces — which files exist and what each is responsible for. Don't re-derive it: read it and map your tasks onto it. Each task should produce self-contained changes over that structure that make sense independently.

## Task Right-Sizing

A task is the smallest unit that carries its own test cycle and is worth a
fresh reviewer's gate. When drawing task boundaries: fold setup,
configuration, scaffolding, and documentation steps into the task whose
deliverable needs them; split only where a reviewer could meaningfully
reject one task while approving its neighbor. Each task ends with an
independently testable deliverable.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `build` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

## Global Constraints

[The design document's project-wide requirements — version floors, dependency
limits, naming and copy rules, platform requirements — one line each, with
exact values copied verbatim from the design document. Every task's requirements
implicitly include this section.]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Interfaces:**
- Consumes: [what this task uses from earlier tasks — exact signatures]
- Produces: [what later tasks rely on — exact function names, parameter
  and return types. A task's implementer sees only their own task; this
  block is how they learn the names and types neighboring tasks use.]

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember
- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits

## Self-Review

After writing the complete plan, look at the design document with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

**1. Coverage:** Skim each section/requirement in the design document. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a design-document requirement with no task, add the task.

## Execution Handoff

After saving the plan, offer execution:

**"Plan complete and saved to `<scratchpad>/plans/<filename>.md`. Ready to execute with `build`: I dispatch a fresh subagent per task, review between tasks, fast iteration.**

**Proceed?"**

**If confirmed:**
- **REQUIRED SUB-SKILL:** Use `build`
- Fresh subagent per task + two-stage review
