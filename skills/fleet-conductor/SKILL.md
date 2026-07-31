---
name: fleet-conductor
description: Part of the Lenny suite (Lenny = the orchestration layer; the conductors are its skills); also triggers on lenny / drive with lenny / run lenny. Use to drive MULTIPLE worktrees in parallel from ONE session to merge-ready - the cross-worktree layer above ship/meta-conductor. It coordinates worktrees you're driving live (never touching them) and drives session-less ones via focused subagents, holding the merge order + rebase discipline so you don't. STOPS at merge-ready; the human merges the fleet in dependency order. Triggers "fleet conductor", "drive the fleet", "conduct the worktrees". Explicit-invocation only.
---

# Fleet Conductor

One THIN session driving many worktrees to merge-ready in parallel. It is **not**
the per-worktree builder - `ship-conductor` (or `meta-conductor`
for a within-worktree chain) do that. The fleet-conductor sits one level above:
it owns the **cross-worktree state** - which worktree is where, the merge order,
the rebase discipline, the file-collision hotspots - and dispatches focused
subagents to do the work, so you stop being the human relay between six repos.

## The hard constraint (design around it)
It CANNOT reach into your other live sessions - a session in another terminal is
a separate process it can't steer or see. So it **coordinates around** live
worktrees and **drives** only session-less ones. It never guesses what it may
touch. The manifest tells it.

## Why one session isn't one bloated, hallucinating head
The coordinator stays THIN: its context holds only the fleet ledger. All real
build work happens in **focused, disposable subagents** - a clean isolated
context per worktree-task, born to do one thing, verified against git + the gate,
then gone. The subagents ARE the focused agents separate sessions give you; the
fleet just wires them together. Backbone: **on-disk ledger** (drift-proof) +
**verify-before-trust** (never believe a subagent's "done" - check git, run the
gate). The coordinator never does deep build work in its own context.

## FLEET.md - the manifest (source of truth; lives ABOVE the worktrees)
Not inside any worktree (it spans them) - keep it at the worktrees' parent dir.
Per worktree:
- `path` · `branch`
- `status`: `hands-off` (you're driving it live → coordinate only) · `delegate`
  (fleet may drive) · `ready` (driven to merge-ready, awaiting your merge) · `done`
- `plan`: `locked` (grilled → safe to drive) · `seed` (ungrilled → DO NOT drive; surface the grill)
- `depends-on` · `merge-priority` (the semantic order git can't infer)

You maintain it. The fleet can't detect when you've finished poking a `hands-off`
worktree, so YOU flip it to `delegate` when it is the fleet's to drive.

## The loop (event-driven; per wake)
1. **Re-read actual state** - `cat FLEET.md`, then per worktree `git fetch` +
   status + its `CONDUCTOR-RUN.md`. Never trust remembered state; worktrees change under you.
2. **Reconcile merges** - if `main` advanced (you announced a merge, or the fetch
   shows it), rebase every `delegate`/`ready` dependent onto it
   (force-with-lease on its OWN branch - the one allowed exception). **Never
   rebase a `hands-off` branch - that's the human's live tree; a rebase would
   clobber their in-progress work.** A rebase that conflicts (the collision-check
   predicted it) → STOP + surface; never force a semantic conflict.
3. **Derive collisions** - flag delegate worktrees sharing hot files (for example,
   `shared-config.ts`) so merge order is not accidentally treated as free.
4. **Drive** - for each `delegate` + `plan: locked` worktree with no work in
   flight, dispatch a focused subagent to conduct it one slice/wave forward (its
   own `ship-`/`meta-conductor` engine). Its completion wakes you → verify → next.
5. **Surface, don't guess** - a `plan: seed` worktree → surface its grill. A
   `ready` worktree → surface it in dependency order for the human to merge.
6. **Liveness** - never end a turn with zero tasks in flight while delegate work remains.

## Terminal fleet-wide council debate (mandatory)

After every scoped lane is evidence-valid but before Fleet reports the fleet
merge-ready, freeze the exact lane tips/dependency graph and reconvene **every
distinct council selected by any lane conductor** as one fleet-wide model
council. Use debate-protocol mode: blind independent rulings from one fresh
delegate per council (minimum two seats, ALWAYS including a dedicated domain-independent code-review delegate - general software correctness: logic, resource/error handling, concurrency, API misuse, dead code - that scaffolds its own review then argues it like any seat), cross-critique, then bounded consensus
with surviving dissent preserved. Each seat reviews all lane evidence, shared
seams, collisions, merge order, and cumulative fleet risk, not only its original
lane.

A validated BLOCKER/P0/P1 reopens the affected lane and its dependents; repeat the
terminal debate after fixes on the new frozen tips. Record rounds, prompt hashes,
participants, exact tips, verdict, dissent, and limitations beside the Fleet
ledger as `FLEET-EVIDENCE/<run-id>/terminal-cross-council-debate.md`; require it
before the fleet-ready claim. Lane/Meta debates do not substitute for this
fleet-wide exit debate.

## Unattended covenant

Once the human has grilled and locked a lane, Fleet owns ordinary decisions and
continuity through merge-ready. Do not stop for reversible defaults, routine
design choices, implementation patterns, review findings, or the transition to
the next dependency-ready locked lane. Apply the locked plan, existing product
contracts, first-principles verification, and `claudes-gamble`; record the choice
and continue.

When a lane becomes merge-ready, immediately dispatch every downstream
`delegate` lane whose plan is locked against that lane's verified actual output.
The human does not need to return to trigger the transition. Merge-ready still
does not authorize a PR or merge.

Interrupt the human before merge-ready only for a hard rail that needs new human
authority or external state: missing credentials/access, an irreversible or
destructive action, a semantic contradiction in the locked contract, a merge
conflict requiring product judgment, or a spend circuit-breaker. Surface one
precise blocker card with the verified failure, exact action needed, and work
continuing elsewhere; do not turn it into an open-ended design interview.

Runtime caveat: if the host cannot wake or visibly publish after the chat yields,
events and downstream dispatches can queue until the next wake. Never describe
that host as continuously autonomous; use a session-independent event/notifier
and scheduler when true unattended continuity is required.

### Mechanical liveness gate (mandatory)

Before saying a lane is `active`/`in flight`, yielding, or returning a final
response, re-read `FLEET.md` plus the Fleet ledger and inspect the actual task
runtime. An active claim requires a concrete task/agent ID assigned to that
lane's next unfinished slice and observed running; ledger prose or a prior
dispatch message is not proof. If locked delegate work remains and no such task
is running, dispatch or resume it with a stable lane/slice ID, then verify the
running state before yielding.

Fleet may have zero running tasks only when every scoped lane is merge-ready, a
validated hard rail is recorded, or the human explicitly held or cancelled the
fleet. A scheduled wake counts only when its scheduler is verified active.
Reconcile and dispatch the successor after every completion event. A
session-independent supervisor should run the same idempotent reconcile on
completion events with a 60-second watchdog fallback; without it, disclose the
host limitation and never promise continuous unattended execution.

#### Native host continuity

Lenny ships instructions, not a supervisor or Stop-hook runtime. Use the host's
native continuation mechanism: completion wakeups or `/loop` where supported,
and `/goal` in Codex. Keep the fleet ledger current before every yield. If the
host provides no active continuation mechanism, disclose that limit and never
promise continuous unattended execution.

When multiple agents can write a shared ledger or evidence bundle, serialize
those writes with the host's available coordination primitive.

## Universal evidence gate

A lane is not verified or merge-ready from a worker message or ledger prose.
Require its checked-in `.lenny/evidence/<run-id>/` bundle and run the producing
Ship Conductor validator at `../ship-conductor/scripts/validate-evidence.mjs`. Confirm the exact
reviewed commit, artifact hashes, required council/audit/test/build/live-proof
receipts, and zero open validated P0/P1. Required councils include the panels
selected by the lane's `AGENTS.md`, with a first-run-legibility seat for
user-facing or onboarding changes. A later code change invalidates the
bundle and reopens affected gates. Fleet status cards link the bundle manifest;
"no artifact" means "not verified."

Copy each lane's validator receipt and manifest into the Fleet evidence bundle.
The lane gate records both paths and both SHA-256 values so the fleet validator
can bind the receipt to the exact lane claim and compute the frozen lane graph.


## Fleet signals (milestone-driven visibility)

Keep the human visibly oriented without streaming atomic tool noise. Emit one
compact fleet status card when a worktree is dispatched, a slice commit is
independently verified, a gate fails or blocks, a plan changes `seed` → `locked`,
or a lane becomes merge-ready. Each row reports: lane · phase/slice · last
verified commit · gate result · next action.

Completion events are PRIMARY. Do not poll healthy in-flight work on a fixed
cadence. A five-minute heartbeat is fallback-only when an expected event is
silent: inspect agent status, Git state, and the lane ledger, then resume or
re-dispatch without duplicating work. Never publish an agent's self-reported
commit as verified until the coordinator checks Git and reruns the relevant gate.

## Stop / reserved (inherited rails)
- **The human merges the fleet**, in dependency order. Never merge, open a PR, or force-push.
- **Grill forks → the human.** Never `claudes-gamble` a foundation. Only
  in-scope forks *inside a locked plan* get `claudes-gamble` + a logged why.
- **Spend circuit-breaker** - a worktree past ~2–3× its estimate → surface (runaway, not progress).
- **Bounded concurrency** - the fleet's per-worktree driver-subagents share the
  harness subagent pool with those subagents' OWN fan-out, so bound the number of
  *actively-driven* worktrees to keep combined dispatch under the cap; coordinate
  the rest. **Residual (unverified):** if subagents can't nest deeply, each driven
  worktree runs its conductor *sequentially* inside one subagent - still correct,
  just parallel *across* worktrees rather than *within* one. Verify nesting depth
  before assuming within-worktree fan-out under the fleet.

## The fleet ledger
`FLEET-CONDUCTOR-RUN.md`, beside `FLEET.md`: merge order + dependency graph,
per-worktree status, collisions found, rebases done, every escalation + decision,
what you were told. Points DOWN at each worktree's own `CONDUCTOR-RUN.md`.
Survives compaction - first move on a thin wake is `cat` it.

## Composes
`ship-conductor` / `meta-conductor` (per-worktree engines) ·
`rumsfeld` + `kissinger` + `bayesian` (ride each driven conductor's phase +
merge-ready exits; `bayesian` distills run learnings into gated, self-promoting
guards - including the **repetition trigger**: a correction the user gives twice,
across worktrees or runs, promotes immediately without waiting for N=3) ·
`codebase-design` (deep-module / seam / ubiquitous-language shape gate at each
driven Build) · `find-skills` (surface-only registry discovery on a capability
gap; `bayesian`'s vetting front door - human installs) ·
`claudes-gamble` (in-scope forks only). Each driven Build also carries
**scoped priming** (relevant-slice guards per subagent brief) via its engine; a
repetition seen across *different* worktrees is an especially strong promote signal.

## What it is NOT
Not a puppeteer of your live sessions (can't reach them). Not a builder
(subagents build). Not a merger (you merge). Not a driver of ungrilled plans (it
surfaces the grill).

## Harness adaptation

Harness-neutral method; idioms map per host - Claude Code: `/loop` +
background-subagent wakeups as written. Codex: `/goal` heartbeat (no /loop);
subagents spawn but background/wakeup lifecycles don't map cleanly, default to
sequential waves; "invoke X" = read X's SKILL.md (no Skill tool). zcode (GLM):
`/goal`; install `zcodes-gamble` with the separate GLM port. Grok Build (untested): reads the Claude format
natively; headless = `grok -p`. Cross-vendor audit pool is three vendors -
auditor from a different vendor than the driver, first available of
codex/claude/grok CLIs (check `command -v` + auth first); else clean-context
same-vendor, disclosed. Full map: see ship-conductor's Harness adaptation.
