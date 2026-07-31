---
name: karpathy
description: Use when building, debugging, or validating anything where reality can be measured - code, models, data pipelines, a feature's real behavior. The empirical engineering lens (Andrej Karpathy's method) - become one with the data, get the simplest thing working end-to-end first, assume your code is buggy until proven otherwise, and let measurement (not argument) decide. Pairs with first-principles (which derives the right answer) and elon-first-principles (which deletes scope).
---

# Karpathy - Become One With the Data

The complement to reasoning: **don't argue about what the system does - go look.** Andrej Karpathy's engineering method is relentless empiricism plus brutal simplicity. Most mistakes come from trusting a mental model of the system instead of observing the system. This skill is the antidote.

## The core moves

1. **Become one with the data.** Before building anything, inspect the actual inputs and outputs by hand. Read the real prompts, the real rows, the real API responses, the real rendered DOM. Find the duplicates, the malformed cases, the surprising distributions. You cannot fix what you haven't looked at. The bug, and the right design, are almost always visible in the data first.

2. **Assume it's broken until measured.** Your code is buggy. Treat "it should work" as a hypothesis, not a fact. The neural net (and the deterministic system) will *silently* do something subtly wrong and still appear to run. Verify outputs, don't infer them.

3. **Simplest thing, end-to-end, first.** Get a dumb full-loop working and measured before adding any cleverness - the skateboard before the car. A complete ugly pipeline you can measure beats an elegant half that you can't.

4. **One change at a time, re-measure.** Add complexity in the smallest increments, and after each, look at the numbers/outputs again. If two things changed and the result moved, you've learned nothing. Overfit a single example first to prove the path works at all.

5. **Don't be a hero.** Use the simplest proven approach that fits. Novel/clever is a liability until the simple thing is measured and found wanting. Reach for the boring, battle-tested path by default.

6. **Visualize / instrument everything.** When unsure, add the print, capture the network request, dump the intermediate, screenshot the render. Make the invisible visible, then decide from what you see.

## The operating loop
- **Look** at real data/outputs by hand → form a specific hypothesis.
- **Build** the simplest end-to-end version that tests it.
- **Measure** the actual result (don't assume).
- **Change one thing**, measure again.
- Stop when the measurement - not the argument - says it's right.

## Red flags (you're theorizing, not measuring)
"It should work" · "obviously this returns X" · "the model will just…" · adding a second change before measuring the first · building the fancy version before the dumb one runs · trusting a result you didn't inspect · debating in the abstract when you could just run it and look.

## The finish
Done = the measurement confirms it, on real data, end-to-end - and you *looked at* the output, you didn't infer it. If you can't point to the data that proves it, you're not done.
