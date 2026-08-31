---
name: outcome-lock
description: Preserve a principal's original user-visible outcome across long autonomous runs, plans, Lenny conductors, councils, scope cuts, safety gates, and completion claims. Use when locking a goal, ratifying a plan, running Garcia/Lenny, convening a terminus council, or preventing semantic goal drift. A blocker may pause delivery but may never redefine “done.”
---

# Outcome Lock

Lock what the principal asked users to be able to do, not merely the artifact an agent proposes to build.

## Create the contract before work

Write an `OUTCOME-CONTRACT.json` beside the plan or run ledger:

```json
{
  "version": 1,
  "originalOutcome": "Verbatim user-visible outcome",
  "lockHash": "",
  "status": "in_progress",
  "criteria": [
    {"id": "C1", "text": "Externally observable success", "required": true, "status": "pending", "evidence": []}
  ],
  "blockers": [],
  "scopeChanges": []
}
```

Stamp it once, then validate it at checkpoints and before any completion claim:

```bash
node <this-skill>/scripts/validate-outcome.mjs OUTCOME-CONTRACT.json --stamp
node <this-skill>/scripts/validate-outcome.mjs OUTCOME-CONTRACT.json
node <this-skill>/scripts/validate-outcome.mjs OUTCOME-CONTRACT.json --claim-complete
```

## Principal-owned invariant

> This outcome may not be narrowed, reinterpreted or replaced by an agent,
> council, release cutoff, safety gate or evidence manifest. Any proposed change
> requires the principal to approve the exact before-and-after wording.

- Preserve `originalOutcome` and every required criterion verbatim after stamping.
- Agents may propose a scope change but may not approve it or restamp the
  contract. Record the proposal and continue all unaffected work. Only an
  explicit principal response quoting or unambiguously accepting the
  before/after wording authorizes a new contract version.
- A hard rail, missing credential, production approval, financial canary or
  provider limitation changes the status to `blocked`; it never changes the
  outcome and never permits `complete`.
- Do not substitute “merge-ready,” “within authorized scope,” “default-off,”
  “held,” “simulated” or “documented” for a broader runnable outcome unless the
  original contract says that is the outcome.

## Automatic checkpoint

At each phase boundary and every 30–60 minutes, compare actual work to the locked
criteria. The user does not need to monitor this.

```text
Original outcome:
Criteria passed: X/Y
Observable progress:
Current blocker:
Next action:
Was scope changed? YES/NO
Reorientation performed (if YES):
```

If scope changed without principal approval: stop the narrowed path, restore the
original finish line, mark any honest blocker and continue the next unaffected
action. Never merely report drift and proceed with it.

## Council rule

Every council prompt starts with the verbatim `originalOutcome` and a
criterion-by-criterion table. Each seat must mark every required criterion
`PASS`, `FAIL`, `BLOCKED` or `UNPROVEN` with evidence. Councils may critique
implementation or propose a principal decision; they may not rewrite the
outcome.

The terminal question is the original user-visible question, not “is this diff
good?” A terminus GO requires every required criterion to pass. Otherwise the
verdict is NO-GO or BLOCKED and the run remains open.

## Evidence honesty

Match evidence to the claim. Unit tests, fixtures, local QA, read-only provider
calls, financial canaries, production UAT and ordinary-user UAT are different
proof classes. Narrower evidence cannot satisfy a broader criterion.
