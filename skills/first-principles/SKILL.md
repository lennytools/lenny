---
name: first-principles
description: Use when a problem is being approached by analogy, convention, or "how it's always done," and you need the actually-correct answer rather than a copied one. The classical first-principles method - decompose the problem to its fundamental, undeniable truths, then reason UP from only those. Distinct from elon-first-principles (which deletes scope from a design) and karpathy (which measures reality); this one derives the right answer from scratch.
---

# First Principles - Reason Up From What's Actually True

Most answers are inherited: we do X because that's how it's done, because a competitor does it, because the framework defaults to it, because it worked last time. First-principles thinking refuses the inheritance. You **boil the problem down to the few things that are fundamentally, physically, logically true - and rebuild the answer from only those.** The result is often something the analogy-followers never reach.

## The method

1. **State the real goal** - the outcome that actually matters, stripped of the current solution. Not "make the cron job faster" but "the user needs fresh data within N seconds." The current implementation is not the goal.

2. **List the fundamental truths.** What is *actually* constrained - by physics, math, the protocol, the money, the data that exists? These are the things that remain true no matter who's solving it or how. Separate them ruthlessly from assumptions ("we've always…", "everyone uses…", "the library wants…") which are NOT truths - they're conventions, and conventions are negotiable.

3. **Challenge every "requirement" until it's a truth or it's gone.** For each constraint someone hands you, ask: *is this physically/logically necessary, or is it just convention/habit/someone's preference?* Attach a name and a reason to each. If it can't survive that, it's not a constraint - drop it from the foundation.

4. **Rebuild from the truths only.** Construct the solution using only what survived step 2–3. Ignore how it's normally done. The point is to derive what the fundamentals *permit*, which is frequently far better (cheaper, simpler, faster) than the inherited approach.

5. **Then sanity-check against reality** (hand to `karpathy`: go measure) and **strip to the minimum** (hand to `elon-first-principles`: delete what the goal doesn't need).

## The discipline
- Reasoning by **analogy** ("X is like Y, so do what Y does") is the default failure mode - fast, comfortable, and often wrong. First principles is slower and derives the answer instead of copying it.
- The phrase **"because that's how it's done"** is a flag that you've stopped at a convention, not a truth. Push through it.
- A "constraint" with no physical/logical/economic reason behind it is an assumption wearing a costume. Take the costume off.

## The finish
Done = you can trace the solution back to a small set of things that are *actually* true, with every inherited assumption either justified as a real constraint or discarded. If a step rests on "that's just how it's done," you haven't finished reasoning.
