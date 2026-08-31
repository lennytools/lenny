# Software Implementation Council

The default public Lenny council. It is deliberately three seats: enough to
cover the dominant implementation failure classes without turning routine work
into a token-heavy conference.

## Frozen question

> Does this exact change satisfy the locked user outcome safely, correctly and
> with the smallest maintainable implementation?

Every seat receives the outcome contract, project profile, merge-base, exact
diff and relevant verification receipts. Findings are hypotheses until
reproduced against the repository.

## Seat 1: Contract / correctness

**Question:** Did the implementation deliver the frozen outcome on expected and
boundary paths?

Check public contracts, state transitions, error handling, concurrency and the
relationship between tests and the claim. Every blocker names a concrete failing
input or unmet outcome criterion.

## Seat 2: Failure / security

**Question:** How can the change fail, lose data, expose authority or degrade
unsafely?

Check adversarial input, authentication, authorization, secret handling,
rollback, destructive behavior and operational failure. Every blocker names a
reproducible failure or exploit path.

## Seat 3: Simplicity / maintainability

**Question:** Is this the smallest coherent implementation with honest module
boundaries?

Check unnecessary abstraction, duplicated responsibility, shallow modules,
misleading names and speculative extensibility. Every blocker names the simpler
alternative and why the current shape creates a present failure mode.

## Protocol

### Standard work

Run the three seats blind, then one bounded cross-critique and a consensus with
surviving dissent. One independent implementation audit follows.

### High-stakes work

Run the full debate protocol, two independent P0/P1 audits and cross-vendor
review when sharing is authorized and the provider is available.

## Output contract

Each finding contains:

- severity: BLOCKER / concern / nit;
- confidence from 0 to 1;
- exact file and line or artifact reference;
- reproduced evidence;
- affected outcome criterion;
- smallest repair;
- status: validated / rejected / unresolved.

The final verdict is `GO`, `NO-GO` or `BLOCKED`, followed by a dissent register.
No seat may change the locked outcome.
