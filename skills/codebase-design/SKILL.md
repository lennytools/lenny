---
name: codebase-design
description: Part of the Lenny suite (Lenny = the orchestration layer; the conductors are its skills); also triggers on "codebase design", "design this module", "deep modules", "is this module shallow", "where does the seam go". A compact synthesis of three canonical design disciplines - Ousterhout's deep modules (A Philosophy of Software Design), Feathers' seams (Working Effectively with Legacy Code), and Evans' ubiquitous language + ADRs (DDD). Runs as a Build-phase gate (after repo-map, before slicing) and as a typed council lens. Glossary/ADR files are opt-in; an in-context lens + gate by default.
---

# Codebase Design

The **module-shape lens** Lenny was missing. `karpathy` gives simplicity,
`first-principles` gives grounding, `repo-map` tells you *what exists* - this
tells you *what the shape should be*. It compacts three canonical disciplines
into one vocabulary + gate:

- **Ousterhout** - *deep modules*: a lot of behaviour behind a small interface.
- **Feathers** - *seams*: places you can alter behaviour without editing there.
- **Evans** - *ubiquitous language*: name things after the domain, and record
  hard-to-reverse decisions as ADRs.

Aim: **leverage** for callers, **locality** for maintainers, **testability** for
everyone. (Distilled from `mattpocock/skills`' codebase-design + domain-modeling
+ improve-codebase-architecture - rebuilt as Lenny doctrine, not ported.)

## The vocabulary (use these words exactly - don't drift to "component/service/API/boundary")
- **Module** - anything with an interface + an implementation (scale-agnostic:
  function, class, package, tier-spanning slice).
- **Interface** - *everything a caller must know*: type signature **plus**
  invariants, ordering, error modes, required config, performance. Not just the
  type-level surface.
- **Depth** - leverage at the interface: behaviour a caller/test exercises per
  unit of interface they must learn. **Deep** = lots of behaviour behind a small
  interface; **shallow** = interface nearly as complex as the implementation.
- **Seam** (Feathers) - the *location* where a module's interface lives; where you
  can swap behaviour without editing in place. Say "seam", not "boundary"
  (overloaded with DDD bounded context).
- **Adapter** - a concrete thing satisfying an interface at a seam (a role, not a
  substance).
- **Leverage** (what callers get) / **Locality** (what maintainers get: change,
  bugs, and verification concentrate in one place).

## The tests (the actual thinking tools - apply these at the gate)
- **Deletion test.** Imagine deleting the module. Complexity *vanishes* → it was a
  pass-through (shallow, delete it). Complexity *reappears across N callers* → it
  earned its keep (deep).
- **The interface is the test surface.** Callers and tests cross the same seam. If
  you need to test *past* the interface, the module is the wrong shape.
- **One adapter = hypothetical seam; two = real.** Don't introduce a seam until
  something actually varies across it.
- **Shallow-module smell.** Interface almost as complex as the implementation, or
  a pure function extracted only for testability while the real bug hides in how
  it's *called* (no locality).
- **Testable by construction.** Accept dependencies (don't `new` them); return
  results (don't mutate in place); keep the surface small.

## Ubiquitous language (Evans - the naming half)
- Name modules and seams after **domain concepts**, not `FooBarHandler` or a
  generic "service". If the domain has an "Order", it's "the Order intake module".
- **Challenge fuzzy terms inline.** "You say 'account' - Customer or User? Those
  are different things." Sharpen the moment it comes up.
- **Cross-check names against code.** If the glossary says cancellation means X but
  the code does Y, surface the contradiction.

## When it runs (inside a conductor)
1. **Build-phase gate - after `repo-map`, before slicing.** Pressure-test the
   planned module shape *before code is written*: anything shallow? is the seam
   real (2+ adapters) or speculative? is the interface the true test surface? are
   the names honest? Feed findings into the plan/slices. Log the verdict to
   `CONDUCTOR-RUN.md`.
2. **Council lens (typed-councils-as-config).** Available as a "deep-module" lens
   the Phase-3 councils can convene: scores the diff on depth / seam placement /
   locality using the vocabulary, emitting `severity + confidence + file:line`
   like any council seat. (A lens the council reads, not auto-wired machinery.)
3. **On demand.** Designing or refactoring a specific module outside a conductor
   run.

## Opt-in artifacts (default OFF)
- Evans' machinery - a `CONTEXT.md` glossary and `docs/adr/` ADRs - is **opt-in**.
  Maintain them only when the user asks OR the repo already has them. **Default:**
  the vocabulary + gate live in-context (notes in `CONDUCTOR-RUN.md`), creating no
  new repo files. Do not scaffold `CONTEXT.md`/ADR files into a repo unasked
  (simplicity-first).
- If ADRs already exist, **don't re-litigate them** - flag a *real* conflict when
  the friction warrants reopening the decision; don't enumerate every refactor an
  ADR forbids.

## Hard rails
- **Config the agent READS, never a runtime.** A lens + checklist, not an engine.
- **`karpathy` still wins.** "Deep" ≠ "clever" or "over-abstracted." A deep module
  is simple to *use*; prefer the simplest implementation that keeps the interface
  small. One adapter is never a reason to pre-build a seam.
- **Proportional to shape.** A gate for *shape-bearing* work - builds that add or
  restructure a module/seam. Skip it for a localized fix that introduces no new
  module (don't audit a one-line change for depth); applicability is the
  conductor's call at slice time.
- **Surgical-change discipline holds.** It *recommends* shape; it does not license
  refactoring adjacent code beyond the request's scope.

## What it is / isn't
IS: the compacted deep-module / seam / ubiquitous-language lens + a Build gate +
a council seat. ISN'T: a mandate to write `CONTEXT.md`/ADRs everywhere (opt-in), a
license to refactor beyond scope, or a runtime. Complements `repo-map` (what
exists) with what *should* exist, and `karpathy` (simplicity) with the depth frame.
