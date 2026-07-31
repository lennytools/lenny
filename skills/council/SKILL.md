---
name: council
description: Part of the Lenny suite. The generic debate and model-council framework for convening N independent seats, having them reason blind, then debating to a consensus with a dissent register. Use to build your own review board for any domain instead of trusting one model's single pass. Triggers "council", "convene a council", "debate council", "model council", "adversarial review", "build a review board". This is the pattern; you supply the seats.
---

# Council: the debate framework (bring your own seats)

A council is a structured way to get MORE than one model's single opinion: several
independent seats, each carrying a distinct lens, that reason separately and then
argue to a consensus. It exists because one model's one pass has one set of blind
spots. Diverse seats that must defend their claims against each other catch both
false positives (a claim that does not survive scrutiny) and surviving bugs (a
real problem the happy-path pass missed).

**This skill is the pattern, not a fixed panel.** You define the seats for your
domain. A code team defines correctness / security / simplicity seats; a research
team defines different ones. The protocol below is the same regardless.

## When to use

- Any decision or artifact important enough that one model's single review is not
  enough: a design, a diff, a plan, a risky change.
- As a gate inside a larger pipeline (e.g. a conductor's review phase).
- Whenever you catch yourself trusting a lone "looks good to me."

## Define your council (this is the only thing you supply)

A council is a list of **seats**. Each seat is config the agent READS:

```
seat:
  name: <who/what this lens is>
  lens: <the ONE thing this seat interrogates, and how it judges>
  output: severity (BLOCKER/HIGH/MEDIUM/LOW) + confidence (0-1) + file:line or section evidence
```

Seats can be **role lenses** ("the security reviewer") or **embodied personas**
("a veteran operator who has run this in production"). Both work; the honesty rail
below governs personas.

A neutral worked example (a generic code-review council) ships in
`references/example-code-review-council.md` - copy it and swap the seats for yours.

## Mode A - roundtable (default, fast)

Round 1 only. Each seat, as an INDEPENDENT and BLIND pass (it has not seen the
other seats' output), gives a **thesis** (a committed ruling, not a hedge) plus a
**confidence 0 to 1**. Synthesize the theses. Use when you want diverse coverage
quickly and the stakes do not warrant a full debate.

## Mode B - debate protocol (merge-blocking, three rounds)

1. **Round 1, independent and BLIND.** Each seat is a SEPARATE pass that has NOT
   seen any other seat's output. It writes a thesis: a load-bearing argument, a
   ruling, and a confidence 0 to 1. A seat that hedges without ruling has failed
   its round. Independence here is non-negotiable; it is what preserves the
   blind-spot coverage the whole method exists for.
2. **Round 2, cross-critique.** Every seat now receives the others' theses and
   attacks or defends them. Claims get strengthened with new argument, softened,
   or killed. This round kills false positives AND surfaces bugs the first round
   missed (the seats review each other's reviews).
3. **Round 3, consensus + dissent register.** ONE unified verdict from what
   survived, recording what changed between rounds, per-finding confidence, and a
   **dissent register** of any disagreement that did NOT resolve. Bounded to 3
   rounds; if it does not converge, surface the deadlock honestly rather than
   faking consensus.

## Cross-cutting doctrine (applies to every council)

- **Diversity charter.** Consensus among *diverse* seats is signal; consensus
  among *similar* seats is a shared blind spot wearing a badge. Make the seats
  genuinely different lenses, and where possible run at least one seat on a
  different model/vendor (different training, different blind spots).
- **Shared-blind-spot rule.** Answer the upstream question before the downstream
  one (e.g. "is the data / premise sound?" before "is the method good?"). A
  council that all assumes a bad premise agrees its way off a cliff.
- **Honesty framing.** Embodied personas are an ANALYTICAL DEVICE, not real
  people. Never fabricate a quote or a credential; any quoted text must be a real,
  cited quote. A persona's value is the lens, not a fake biography.
- **Per-seat known-limits.** Each seat states what it is NOT positioned to judge,
  so its silence on something is not mistaken for a pass.
- **Findings are hypotheses.** A council finding is a claim to validate against the
  actual artifact/code before it gates anything. Cite evidence (file:line or
  section). An unvalidated finding never blocks on its own.

## Output schema (what a council returns)

A ranked findings list, each with: **severity** (BLOCKER / HIGH / MEDIUM / LOW),
**confidence** (0 to 1), **evidence** (file:line or section), and a one-line
statement of the defect. Then a **verdict** (e.g. GO / BLOCKED, or
adopt / adopt-with-fixes / reject) and the **dissent register**. Nothing else.
Severity is "how bad if real"; confidence is "how sure it is real" - keep them
separate, and give a high-severity / low-confidence finding extra validation
before it gates.

## Hard rails

- **Config the agent READS, never a runtime it executes.** A council is a lens
  the agent applies, not an engine. Do not build a parser that "runs" councils;
  that forfeits portability across harnesses.
- **Independence before debate.** Never let seats see each other's Round 1 output.
  If they do, you have one opinion in three costumes.
- **Dissent is preserved, never averaged away.** A minority finding that survives
  the debate is logged with its rationale, not erased by "consensus."
- **No fabricated quotes or credentials** (see honesty framing).
