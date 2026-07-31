---
name: meta-conductor
description: Part of the Lenny suite (Lenny = the orchestration layer; the conductors are its skills); also triggers on lenny / drive with lenny / run lenny. Use when a build is too large for one ship-conductor run and must be delivered as an ORDERED CHAIN of dependent conductors (conductor N+1 cannot start until conductor N is merge-ready) - drives the whole sequence to merge-ready branches, re-verifying each conductor's premises against the previous conductor's ACTUAL output, and pulling the human in only at genuine decision forks. Triggers "meta-conductor", "conduct the conductors", "drive the conductor chain", "run the meta-plan". Explicit-invocation only. Like ship-conductor, it STOPS at merge-ready and NEVER merges - the human merges the chain in dependency order.
---

# Meta-Conductor

## Overview

Ship-conductor takes ONE plan to ONE merge-ready branch. The meta-conductor takes
a **meta-plan** - an ordered chain of dependent conductors - and drives the whole
sequence, one ship-conductor run at a time, in dependency order.

Its job is not to build. Its job is to be the **reviewer between conductors** that
the human would otherwise be: after conductor N reaches merge-ready, re-verify that
conductor N+1's plan still holds against N's ACTUAL output, then either proceed
autonomously or STOP and surface a real fork to the human. This is how you abstract
the mechanical human-in-the-loop (approve-this-slice, kick-off-the-next-run) while
keeping the human at every decision that is actually theirs.

It composes ship-conductor; it is a conductor of conductors, not a soloist.

## When to use

- A build that is genuinely too big for one conductor AND has hard internal
  dependencies (C2's plan assumes C1's output exists).
- The user has explicitly authorized driving a chain without per-conductor kickoff.
- A meta-plan exists (or you write one first) naming the ordered conductors, their
  dependencies, and the per-conductor plan docs.

**When NOT to use:** a single feature (use ship-conductor); independent parallel
work with no ordering (dispatch parallel conductors, no meta needed); anything the
user wants to kick off run-by-run themselves.

## Hard rails - inherited from ship-conductor / garcia, non-negotiable

- **The human merges the chain, always.** Each conductor stops at a merge-ready
  branch, pushed, NO PR. The meta-conductor stacks conductor N+1 on N's branch
  (like a stacked-PR chain) and never merges, force-pushes, or rewrites shared
  history. At the end the human merges N branches in dependency order.
- **User assets and data, credentials, irreversible/outward-facing actions** - same rails; take the
  safe reversible path, surface only if none exists.
- "It's a big chain" / "the user probably wants the next one" are NOT rails -
  resolve those with the escalation policy below and keep driving.

## The escalation contract (this IS the safety story)

The meta-conductor drives autonomously EXCEPT it STOPS and surfaces to the human on
exactly three triggers. Everything else it resolves itself and logs.

1. **A broken premise that changes scope.** Between conductors, re-verify the next
   conductor's ground-truth premises against the previous conductor's actual output
   (its merge-ready diff, its council findings, its parked follow-ups). If a premise
   no longer holds and the delta changes what should be built, STOP and report the
   delta before building - never build on a stale plan.
2. **A conductor that cannot reach merge-ready** after its own internal remediation
   (a council BLOCKER that can't be fixed in scope, a gate that won't go green, an
   audit P0 with no clean fix). Surface it; do not force it through.
3. **A decision genuinely reserved to the human** - a merge, a spend, an
   irreversible/outward action, or a fork the meta-plan explicitly marks as a human
   gate (e.g. a feasibility unknown that resolves "no", a scope-defining choice).

4. **A runaway - a conductor whose actual spend passes ~2–3× its up-front working
   estimate.** Not the work going, the work *broken*: a stuck re-dispatch loop or a
   non-converging council burning tokens for no output. Normal 1–2× variance never
   trips it. One-line escalation: spend / conductor / likely cause / ledger -
   resume or kill? (Spend is a reserved rail and a runaway is unbounded + not
   self-recoverable, so this breaker is warranted even when every other gate is
   left fully autonomous.)

Mechanical things it does NOT escalate: kicking off the next conductor, approving a
slice, fixing validated council/audit findings, re-running a gate, committing
surgically, choosing between two viable designs at a fork (resolve with
claudes-gamble, log it). The value is escalating the RIGHT things and only those.

## The meta-pipeline (per conductor, in dependency order)

For each conductor C in the meta-plan's order:

1. **Prereq gate.** Confirm C's dependencies are satisfied: prior conductor(s)
   merge-ready on disk, branch pushed, base still current. If not, STOP (rail).
2. **Premise re-verification.** Run C's Phase-0 ground truth against the PREVIOUS
   conductor's actual output, not the assumptions in the meta-plan. Broken premise
   → escalation trigger 1.
3. **Conduct.** Invoke ship-conductor on C's plan doc (fresh branch stacked on the
   prior conductor's branch; councils + gates + audits per that plan). Ship-conductor
   owns its own internal loop.
4. **Cross-conductor gate.** On C's merge-ready: verify C's actual output matches
   what the NEXT conductor's plan assumes (the interface/contract between them). A
   mismatch that changes the next plan → harden the next plan (log it) or escalate
   if it's a real fork.
5. **Meta-ledger update.** Record C's result, the cross-conductor delta, decisions
   made, and what (if anything) the human was told. Advance.
6. **Advisory checkpoints** (meta-plan-defined): notify the human at named
   milestones and proceed unless told to hold - distinct from a hard STOP.

## Terminal chain-wide council debate (mandatory)

After the last child is evidence-valid but before Meta reports the chain
merge-ready, freeze the exact child tips/dependency graph and reconvene **every
distinct council selected by any child conductor** as one chain-wide model
council. Use debate-protocol mode: blind independent rulings from one fresh
delegate per council (minimum two seats, ALWAYS including a dedicated domain-independent code-review delegate - general software correctness: logic, resource/error handling, concurrency, API misuse, dead code - that scaffolds its own review then argues it like any seat), cross-critique, then bounded consensus
with surviving dissent preserved. Each seat reviews the final child evidence,
cross-conductor contracts, stack/merge order, and cumulative residual risk, not
only its original slice.

A validated BLOCKER/P0/P1 reopens the affected child and every downstream gate;
after fixes, repeat the terminal debate on the new frozen tips. Record all rounds,
prompt hashes, participants, exact tips, verdict, dissent, and limitations in
`.lenny/evidence/<meta-run-id>/terminal-cross-council-debate.md` and require it as
a passing Meta evidence gate. Child debates do not substitute for this chain-wide
exit debate.

## The meta-ledger (on disk, always)

`META-CONDUCTOR-RUN.md` at the repo root - created at start, updated as each
conductor gates. It holds: the ordered chain + dependency graph, per-conductor
status (pending / conducting / merge-ready / escalated), the cross-conductor deltas
found, every escalation and its resolution, and the decision log. This survives
compaction across a very long horizon: a post-compaction meta-conductor's first move
is `cat META-CONDUCTOR-RUN.md`. Each conductor keeps its OWN `CONDUCTOR-RUN.md`; the
meta-ledger is one level up and points at them.

## Universal unattended + evidence covenant

After a child plan is grilled and locked, do not stop for routine/reversible
questions, review remediation, or the transition to the next conductor. Resolve
them from verified contracts with `claudes-gamble`, log the decision/reversal path,
and continue. Interrupt only for a hard rail requiring new human authority or
external state. Emit durable milestone receipts at dispatch, verified commit,
blocker, plan lock, and merge-ready.

### Mechanical liveness gate (mandatory)

Before saying a child is `active`/`in flight`, yielding, or returning a final
response, re-read the meta-ledger and inspect the actual task runtime. An active
claim requires a concrete task/agent ID assigned to the next unfinished
conductor and observed running; ledger prose or a prior dispatch message is not
proof. If the locked chain remains and no such task is running, dispatch or
resume it with a stable conductor/slice ID, then verify the running state before
yielding.

Meta may have zero running tasks only when the chain is merge-ready, a validated
hard rail is recorded, or the human explicitly held or cancelled it. A scheduled
wake counts only when its scheduler is verified active. Reconcile and dispatch
the successor after every completion event. A session-independent supervisor
should run the same idempotent reconcile on completion events with a 60-second
watchdog fallback; without it, disclose the host limitation and never promise
continuous unattended execution.

#### Native host continuity

Lenny ships instructions, not a supervisor or Stop-hook runtime. Use the host's
native continuation mechanism: completion wakeups or `/loop` where supported,
and `/goal` in Codex. Keep the meta-ledger current before every yield. If the
host provides no active continuation mechanism, disclose that limit and never
promise continuous unattended execution.

When multiple agents can write a shared ledger or evidence bundle, serialize
those writes with the host's available coordination primitive.

A child is not merge-ready from ledger prose or a subagent message. Require its
checked-in `.lenny/evidence/<run-id>/manifest.json` and artifacts, then run that
Ship Conductor validator at `../ship-conductor/scripts/validate-evidence.mjs`. Independently confirm
the reviewed commit, artifact hashes, required gates, and zero open validated
P0/P1 before advancing the chain. Any later code change invalidates the evidence
and reopens the affected review gates.

Copy each child's validator receipt and manifest into the Meta evidence bundle.
The dependency gate records both paths and both SHA-256 values so the parent
validator can bind the receipt to the exact child claim.


## The quality stack (per conductor, wired into the exit)

Each conducted run carries, beyond its own councils/gates/audits:
- **The councils selected by the child repository's `AGENTS.md`**, including a
  first-run-legibility seat for user-facing, onboarding, or microcopy changes.
  Terminology rulings route to the relevant domain panel; design rulings route
  to the user-impact panel.
- **rumsfeld** after each build phase - the unknown-knowns audit (latent
  assumptions and emergent patterns already in the work but unspoken). Findings
  feed the councils and the next phase.
- **code-review** alongside the two P0 audits - the P0 auditors hunt security
  and data-loss risks; code-review catches ordinary correctness and simplification.
- **kissinger** as the EXIT GATE - no conductor declares merge-ready until it can
  truthfully answer "this is the best under current constraints," with residual
  limitations named in its write-up. Bounded per that skill (pass cap +
  materiality gate).
- **Engine choice:** where the work lives in a repo with a project-tuned
  conductor (e.g. ship-conductor for your monorepo), invoke THAT as the
  per-conductor engine - read its skill at drive time and confirm it carries the
  ship-conductor pipeline (councils, cutoff, green gate, audits, merge-ready
  stop); fall back to ship-conductor if not.

## v1.5 quality upgrades (carried by each conductor's engine)

Each conducted run now carries the v1.5 upgrades (see the per-conductor skill):
**repo-map** + **scoped-priming** (inject only the relevant slice of guards /
learnings into each subagent + council brief, filtered by the files + work-type it
touches - never the whole guard set) + **edit-loop** (self-heal to green before
return) + **codebase-design**
(deep-module / seam / ubiquitous-language shape gate - Ousterhout · Feathers · Evans)
at Build; **council
debate** (independent → cross-critique → consensus) + **confidence-scored findings**
+ **typed-councils-as-config** at Councils; and a **cross-vendor final audit** (the
driving vendor picks the auditor's vendor - Claude-driven → a Codex auditor via
`codex exec --skip-git-repo-check`; Codex-driven → a Claude Code auditor via
`CLAUDE_LIVENESS_EXEMPT=1 gtimeout 600 claude -p --permission-mode bypassPermissions "<brief>" </dev/null`; a same-vendor reviewer does
NOT count) at the P0 audits. Before conducting a conductor, confirm its engine
carries these - including the **Bayesian** self-improvement pass at each
conductor's merge-ready exit (distill run learnings → auto-provenance guards;
auto-promote LOW-RISK guards after N=3 confident applications; human-gate anything
touching a high-impact or safety-sensitive path; plus the **in-run repetition trigger** - a correction the
user gives twice promotes immediately, without waiting for the exit or N=3; scan
forked skills via `find-skills` - surface-only, human installs). This plus
`codebase-design` at Build marks **Lenny v2**. (Deliberately excluded: a continuous every-turn advisor and a formal
checkpointer - commits + the meta-ledger cover resumption.) Orchestration-layer
rail holds: config the agent READS, never a runtime it executes.

## Split authority

If a conductor's Phase-0 sizing shows it is too large to hold its freeze
discipline (a single conductor should be about one session's
build plus its gates), the meta-conductor MAY split it into sub-conductors with
the same union DoD, inserting them into the chain in dependency order. Log the
split and its rationale in the meta-ledger; this is mechanical (no escalation)
so long as the union DoD is preserved and no human gate moves.

## Resumption protocol (session limits and compaction WILL happen)

On any wake-up with thin context, in order:
1. `cat META-CONDUCTOR-RUN.md`, then the active conductor's `CONDUCTOR-RUN.md`.
2. `git status` + `git log --oneline -5` - establish actual tree/branch state
   before trusting any remembered state.
3. Check in-flight agents: a killed agent may have left partial writes - if the
   tree is dirty with unowned changes, inspect before relaunching; if clean,
   relaunch the dead agents with their original briefs.
4. A subagent that returned zero tool calls / seconds / off-topic text has
   misfired - re-dispatch it; never fold its output into a synthesis.
5. Never end a turn with zero tasks in flight while the chain is live: either
   work is running, a wake-up is scheduled, or the chain is finished/escalated.

## Red flags - you've stopped meta-conducting and started freelancing

- You kicked off conductor N+1 without re-verifying its premises against N's output.
- The meta-ledger is stale (a conductor gated two steps ago and it's unrecorded).
- You forced a conductor past a council BLOCKER because the chain was waiting.
- You merged, force-pushed, or opened a PR to "keep the chain moving" - STOP.
- You escalated a mechanical decision (churn) OR you failed to escalate a broken
  premise (danger). Both are miscalibrations of the one job.

## The finish

Done = every conductor in the chain at a merge-ready branch, stacked in dependency
order, all pushed, NO PRs; the meta-ledger complete with every escalation and
decision; the human handed the chain to merge in order. Report: the chain status,
each conductor's gate/audit synthesis, the cross-conductor deltas, the decision log,
and the parked follow-ups - then hand the merges to the human.

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
