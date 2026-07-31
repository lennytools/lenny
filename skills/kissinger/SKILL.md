---
name: kissinger
description: At the end of a phase, force an honest "is this the best you can do?" pass - the agent must find any MATERIAL improvement, revise + validate + resubmit, and repeat until it can truthfully say "yes, this is the best under current constraints," naming residual limitations. Bounded (hard pass cap + materiality gate) so it exhausts quality without polishing forever.
---

# Kissinger

The story (Isaacson's Kissinger; the aide was Winston Lord): Lord drafted a memo,
handed it up. Kissinger returned it without reading - *"Is this the best you can
do?"* Lord redrafted. Same question. Again. After several rounds Lord finally
said, *"Yes - this is the best I can do."* Only then did Kissinger read it. The
question wasn't cruelty; it was a **forcing function** that surfaced the gap
between "done" and "best" that Lord himself couldn't see until asked.

Agents have that gap too. Asked *"is this the best you can do?"*, an honest agent
usually finds it isn't - and improves. This skill codifies the question, **with a
bound** so it exhausts quality without iterating forever.

## When to run
At the end of every phase (in a conductor: after the phase's work is gated,
before it advances to the audit). Pairs with `rumsfeld`: run **Rumsfeld first**
(surface the latent / unknown-knowns), **then Kissinger** - asking whether the
whole, including anything Rumsfeld surfaced, is truly the best you can do.

## The loop
1. **Ask, honestly: "Is this the best you can do?"** Answer against the actual
   work, not pride in it.
2. **Hunt for a MATERIAL improvement** - one that changes correctness, coverage,
   clarity, robustness, risk, or user value. Cosmetic/subjective tweaks do NOT
   count (see the bound).
3. **If a material improvement exists → revise, VALIDATE it (re-run the
   gate/tests), resubmit,** and ask again.
4. **Stop when you can truthfully say: "Yes - this is the best I can produce
   under the current requirements and constraints,"** backed by what actually
   improved across the passes.

## The bound - root it in reality (NOT infinite polishing)
The goal is *rigorously exhausted*, not *forever iterated*. Stop - and give the
honest declaration - when ANY of these holds:
- **No material improvement remains** - the only changes left are cosmetic,
  subjective, or below the bar that would change a decision. That IS "best under
  constraints."
- **Diminishing returns** - this pass's improvement was materially smaller than
  the last and no longer worth a cycle.
- **Pass cap reached** - hard cap of **3 passes** by default. A phase rarely needs
  more; if it seems to, that's a signal the *plan/scope* is wrong, not the draft.
  At the cap without a truthful yes, STOP and surface: what's still improvable,
  why, and whether it's a scope problem.

Guard BOTH failure modes: a **premature "yes"** on pass 1 (laziness - the thing
Kissinger caught) AND an **endless "no"** (perfectionism). Neither is honest, and
the human reviewing the run afterward will catch either.

## The honest declaration (required output)
When you stop, state:
- **Verdict** - "best under current constraints," or "stopped at cap /
  diminishing returns."
- **What improved** across the passes - one line each (evidence the question did
  real work, not a rubber stamp).
- **Residual limitations** - what a better version would need (more time, a
  lifted constraint, data you don't have). "Best" means *exhausted within
  constraints, with the constraints named* - never merely asserted.

## What this is NOT
- Not a rubber stamp - "yes" on the first ask is suspect; show that you looked.
- Not perfectionism - cosmetic churn past the material bar is a bound violation.
- Not scope creep - improvements are to the CURRENT requirements, not new
  features (that's the plan's job, resolved via the grill).
