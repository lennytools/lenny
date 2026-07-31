---
name: elon-first-principles
description: Use before building, deploying, recommending, or keeping anything - ruthlessly test whether each requirement, part, step, feature, or safeguard is actually REQUIRED for the goal right now. Strip to bare bones, then strip further until reality forces an add-back. Apply whenever a plan, a review, a "best practice," or an expert's "blocker" is adding scope. Musk's 5-step design algorithm.
---

# Elon First Principles - "Is this required?"

The default failure mode of competent engineers and thorough reviewers is **adding** - every best practice, every safeguard, every "you should also." This skill is the counterweight: strip relentlessly, add back only when reality forces it. The goal is to live at the bare-bones edge - cut until it almost hurts, then add back the minimum.

## The one question, asked of EVERYTHING
For every requirement, part, step, feature, or safeguard: **"Is this required - for the actual goal, right now?"**
If the honest answer is "no," "nice to have," "best practice," "to be safe," or "for when we scale" → it is a candidate to **delete**, not keep.

## Musk's 5-step algorithm - IN ORDER (do not reorder)
1. **Make the requirements less dumb.** Question every requirement. The most dangerous requirements come from smart, senior people (or expert reviewers) because they go unchallenged. **Every requirement must carry a human NAME** - a person who owns it - never "the department," "best practice," or "the reviewer flagged it." A requirement you can't attach a name + a reason to is probably dumb.
2. **Delete the part or process.** Strip to bare bones, then strip further - until you're *forced* to add something back. **If you're not adding back at least ~10% of what you deleted, you didn't delete enough.** The bias must be on removal; under-deleting is the norm.
3. **Simplify or optimize - but ONLY after 1–2.** Never optimize a thing that should have been deleted. This is the most common mistake: making an unnecessary thing efficient.
4. **Accelerate cycle time.** Speed up what remains - only once it has survived 1–3.
5. **Automate - LAST.** Automating a process that shouldn't exist just entrenches the mistake in code.

## The operating move
- Split everything into **REQUIRED** (the goal fails without it) vs **DESIRABLE** (hygiene, safety, future-proofing, "best practice," "in case").
- **Ship only REQUIRED.** Park each DESIRABLE item as an explicit *"add back when <concrete trigger>"* - where the trigger is real and observable (real users, real load, real money at risk, a real incident), never "someday."
- When a reviewer/expert calls something a **"blocker,"** ask: blocker to **the goal**, or to **their idea of best practice**? Demand a name + a concrete failure mode that can occur *now*. Best-practice ≠ required.
- A safeguard against a risk that **cannot happen yet** (no users, no load, no material impact) is not required yet.
- When unsure: **delete and watch what breaks.** Adding back later is cheap; carried scope compounds.

## Red flags that you're adding when you should be deleting
"We should also…" · "best practice is…" · "to be safe…" · "in case…" · "for when we scale…" · a safeguard for an impossible-yet risk · optimizing/automating before deleting · a requirement with no human name on it.

## The finish test
The design should feel slightly *uncomfortable* - like you cut a touch too close. If it feels comfortably complete, you didn't cut enough. Then, and only then, add back the minimum that reality demands.
