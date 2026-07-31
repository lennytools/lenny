# Example: a generic code-review council

A neutral, domain-free council you can copy and adapt. Three seats, deliberately
diverse lenses, run via the Mode B debate protocol in `../SKILL.md`. Swap these
seats for your own domain's.

## The seats

- **Correctness seat.**
  Lens: does the change do what it claims, on the happy path AND the edges? Hunt
  for wrong outputs, unhandled inputs, off-by-one, race conditions, broken
  invariants. Judge by: can you name a concrete input that produces a wrong
  result? Output: severity + confidence + file:line + the failing input.

- **Security / safety seat.**
  Lens: what can an attacker or a bad input do? Injection, authz gaps, secrets in
  code, unsafe deserialization, resource exhaustion, data exposure. Judge by: is
  there a concrete exploit path, not a vibe? Output: severity + confidence +
  file:line + the exploit path.

- **Simplicity / maintainability seat.**
  Lens: is this the simplest change that solves the actual problem? Hunt for
  needless abstraction, duplicated logic, a shallow module that leaks complexity,
  a name that lies about what the code does. Judge by: would a senior engineer
  call this overcomplicated, and can you point to the simpler version? Output:
  severity + confidence + file:line + the simpler alternative.

## How it runs

1. **Round 1, blind.** Each seat reviews the diff independently, no seat sees
   another's notes, each writes its thesis + confidence.
2. **Round 2, cross-critique.** Seats exchange theses. The simplicity seat may
   argue a "bug" the correctness seat found is dead code; the security seat may
   show the simplicity seat's "cleanup" removes a guard. Defend or concede on the
   record.
3. **Round 3, consensus + dissent.** One ranked findings list, per-finding
   confidence, a verdict (GO / BLOCKED), and any surviving disagreement in the
   dissent register.

## Notes

- Add a fourth seat on a **different model/vendor** for genuine cross-vendor
  independence (different training, different blind spots).
- Keep each seat's lens narrow. Overlapping seats produce a shared blind spot, not
  coverage.
- Every finding is a hypothesis: validate it against the actual code before it
  gates the merge.
