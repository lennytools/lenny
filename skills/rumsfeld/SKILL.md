---
name: rumsfeld
description: After each development phase, audit the codebase and related artifacts for unknown-knowns - non-obvious insights, hidden concepts, latent assumptions, overlooked implications, and emergent patterns already present in the work but not yet explicitly recognized - and surface them for the broader audit + decision process.
---

# Rumsfeld

"There are known knowns… known unknowns… and unknown unknowns." The fourth box
Rumsfeld left out - and the one this skill hunts - is the **unknown known: the
thing you don't know that you already know.** Latent knowledge sitting inside the
work: an assumption the code enforces but never states, a pattern that emerged
three times without being named, a capability you already built without
realizing, an implication of a decision nobody traced. It is hiding in plain
sight. This skill drags it into the light so the team can decide what to do with
it.

## When to run
After each development phase (in a conductor: after each phase gates, before the
next begins). Also any time a body of work has accreted enough that latent
structure may have formed without anyone naming it.

## The four boxes - target the fourth
- **Known knowns** - documented, intended. Not your job.
- **Known unknowns** - open questions already tracked (the grill / ledger own these). Not your job.
- **Unknown unknowns** - unfindable by definition; do NOT pretend to enumerate them.
- **Unknown knowns** ← **your target.** Already present in the work, not yet recognized.

## What an unknown-known looks like (hunt these categories)
1. **Latent assumption** - the code assumes something it never states (UTC, single-tenant, sorted input, a file always existing). One input violates it and it breaks; nobody wrote it down.
2. **Emergent pattern** - the same shape appears 3+ times un-abstracted, OR a duplication reveals a missing primitive the work is implicitly asking for.
3. **Capability you already have** - the plan treats X as future work, but the code already supports X (or is one small seam from it). *A helper built for one integration turned out to support another; the capability was latent in work done for a different purpose.*
4. **Hidden coupling** - changing A silently requires B; two modules encode the same fact independently and can drift.
5. **Overlooked implication** - a decision made for reason X also implies Y no one noted (caching results also built a rate-limit shield; retries also changed latency semantics).
6. **Encoded contradiction** - two parts of the system embed conflicting beliefs (one path treats input as complete, another as streaming).
7. **One-off that's actually general** - something built for a single case is the reusable primitive three future cases will need.

## How to run (grounded - no philosophizing)
1. Read the phase's diff + the artifacts it produced (plan, ledger, tests, config) - from the work, not from memory.
2. For each candidate, **cite where it's evidenced** (`file:line` / artifact). If you can't point at it in the work, it is not an unknown-*known* - it's speculation; drop it.
3. State it in one line, say **why it's non-obvious** (why nobody named it), and give a **recommendation**: implement / document / park (with trigger) / discard.
4. Rank by leverage - what would most change a decision if surfaced now.

## Output
A short ranked list (typically 2–6 items; **zero is a valid, honest answer** - say so). Each item: the unknown-known · evidence (`file:line`/artifact) · why it's latent · recommended action. Feed it into the broader audit and the run ledger. This skill **surfaces and recommends - it does NOT silently implement**; the human/agent decides.

## What this is NOT
- Not `first-principles` (that verifies claims are true) - Rumsfeld surfaces what's *latent*.
- Not the grill (that resolves known-open forks) - Rumsfeld finds the *un-asked*.
- Not feature brainstorming - every item must already be **evidenced in the work**.
