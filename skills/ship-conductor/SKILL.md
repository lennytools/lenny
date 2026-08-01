---
name: ship-conductor
description: Part of the Lenny suite (Lenny = the orchestration layer; the conductors are its skills); also triggers on lenny / drive with lenny / run lenny. Use when the user hands you a plan (or points at a plan doc) and wants it driven end-to-end - fresh branch, build, council reviews, code audit - up to merge-ready. Triggers "conductor", "ship conductor", "run the conductor", "get this merge-ready", "take this plan to merge-ready", "conduct this". Explicit-invocation only. It orchestrates other skills using the host harness's native execution model and STOPS at merge-ready - it does NOT open the PR; the human reviews, then opens the PR and merges.
---

# Ship Conductor

## Overview

You are handed a **plan** and told to take it to the finish. The conductor is the
score that turns one plan into a merge-ready branch by driving the whole pipeline:
**ground-truth → branch → build → council gates → ship cutoff → green
gate → two independent P0 audits → STOP at merge-ready → write-up.** It does not
open the PR - the human reviews and sanity-checks first, then opens the PR and
merges.

It does not invent the work - the plan does that. It guarantees the *process*:
that reality is verified before code is written, that councils actually gate
(not decorate), that "done" is a green fact not a vibe, and that the human - not
you - makes the irreversible calls.

This skill **composes other skills**. It is a conductor, not a soloist: at each
gate it reads and applies the real council or discipline skill below using the
host mapping in Harness adaptation.

## Project adaptation (read the repo's CLAUDE.md / AGENTS.md first)

The pipeline is project-agnostic; each repo supplies its specifics in its agent
instructions file under a `## Conductor` section:

- **Councils** - the review panels Phase 3 routes to, keyed by what a batch
  touches. The routing table in Phase 3 is one project's default; a repo that
  declares its own panels overrides it. If a repo defines none, default to
  a generic `council` with correctness / security / operability / user-impact
  seats.
- **Verification build** - the exact command(s) that match production builds
  (Phase 5). Dev-mode servers rarely typecheck or bundle like prod; never trust
  them alone.
- **Merge policy** - who merges, PR conventions, protected branches. Absent an
  explicit policy: stop at merge-ready and do NOT open the PR.
- **Domain rails** - anything with data-loss, security, or outward-facing
  blast radius in this project.

## When to use

- User says "conduct this", "run the conductor", "take this plan to launch/merge".
- User has a plan doc (or an agreed plan in-thread) and wants it driven to merge-ready.
- **Explicit invocation only.** A bare "build this" or "/loop" does NOT activate it.

**When NOT to use:** exploratory work with no plan yet (brainstorm/scope first);
a one-line fix (just do it); anything where the user wants to drive each step.

## Closed-run interlock - check before Phase 0

Before starting or resuming any phase, inspect `CONDUCTOR-RUN.md` and
`.lenny/evidence/*/manifest.json`. A passing manifest whose `claim.status` is
`merge-ready` is the durable completion tag for that run.

- Treat that run as **closed**. Do not rerun its councils, audits, debate,
  evidence bundle, or full gates merely because the user later asks to test,
  fix, commit, push, prepare/open a PR, or ship the already-reviewed work.
- Handle later changes as a **post-close delta** with the smallest scoped tests,
  build, live QA, and ordinary code review warranted by that delta. Never
  silently convert ordinary follow-up work into another conductor run.
- Later non-evidence code means the old bundle no longer attests to the current
  tip; it does **not** reopen the completed run. Report the distinction plainly:
  the prior conductor is closed, while the post-close delta has only its stated
  scoped verification.
- Reopen the full pipeline only when the user explicitly says to `reopen/rerun
  the conductor`, `rerun councils/audits`, or supplies a new plan as a new
  conductor run. Generic phrases such as `get the PR ready`, `ship this`, or
  `is this ready?` are **not** reopen authorization.
- Never overwrite a closed bundle. A deliberate rerun gets a new run ID and
  evidence directory.

## Hard rails - the conductor STOPS, never crosses these

Inherited from `garcia`. For each, take the safe reversible path autonomously and
surface only if none exists:

- **Stop at merge-ready - do NOT open the PR.** The conductor drives to
  merge-ready, pushes the branch, and STOPS. The human does their own review +
  sanity-check, then opens the PR and merges. Never open the PR, never merge to
  `main`, never force-push, never rewrite shared history. (Standing user rule,
  not a preference.)
- **User assets and data** - take no path that risks loss or corruption.
- **Credentials / secrets** - never print, commit, or echo them. Always critical path.
- **Irreversible / outward-facing** - deleting data/branches you didn't create,
  prod migrations that can't roll back, sending anything to external parties.

"It's a big diff" / "the user probably wants X" are **not** rails. Resolve those
with a council and keep moving.

## The pipeline

Run phases in order. Each phase names the sub-skill(s) it invokes, its **gate**
(what must be true to advance), and keeps one line in the **decision log**.

### Phase 0 - Ground Truth  ·  invoke `grill-me` (if the plan has open forks), then `first-principles` (+ `elon-first-principles`)

The most expensive bug in this session came from skipping this: a constraint was
"verified fixed" on the **remote** DB while the app pointed at a **local** one.
Never build on assumed ground truth.

- **Grill the plan first.** If the plan still has unresolved design forks, run
  `grill-me` - one fork at a time, each with a recommended answer, exploring the
  codebase instead of asking whenever code can answer. A plan with open decisions
  is not ready to build; resolve them into the plan before proceeding. Skip only
  if the plan is already grilled/ratified.
- **Read the plan.** Restate the goal in one line + an **objective finish bar**
  (tests green, named acceptance check complete, build clean, feature demoable). If the plan is
  vague on the finish bar, pin it before touching code.
- **Verify the environment the work actually runs against**, not the one you assume:
  - What branch am I on? What's the merge-base with `main`? What's uncommitted?
  - **Which datastore/endpoint does the app actually use?** (Read the env the app
    loads, such as `DATABASE_URL`; do not assume local equals remote. Fix the DB the app
    reads, then verify *on that same DB*.)
  - Is the dev server running, and is it the build that loaded the current env/flags?
  - Are the CLIs/tools authed and pointed at the **right** target *this session*?
- **Apply the recursive check:** before any verification command, confirm its own
  preconditions (tool installed, authed, right target). Bundle the check in
  (`… || echo "need to log in"`) rather than firing five commands that all fail.
- **Read the project's learnings before deriving ground truth.** Check the
  project memory (`MEMORY.md` / memory dir) and any prior conductor run ledgers
  for recorded traps, such as "the CLI-linked database is not the application target." A trap
  someone already paid for must not be re-purchased.
- **Start the run ledger ON DISK: `CONDUCTOR-RUN.md`** (repo root or the plan's
  dir, gitignored or committed - but a file, not context). Context WILL compact
  mid-run; the ledger is how a post-compaction you resumes. Write the goal, the
  finish bar, and the Verified/Unknowns table into it now.
- **Gate:** the run ledger exists on disk with a Verified-facts / Unknowns table;
  no unknown blocks the plan. Strip any plan requirement that can't name a human
  owner + a real failure mode (`elon-first-principles`).

### Phase 1 - Branch

- Cut a **fresh branch** from an up-to-date `main` (fetch first). Never build on `main`.
- Place worktrees as siblings to the repo if isolating (user preference).
- **Gate:** on a new branch; `main` untouched; clean starting tree (or a noted,
  intentional set of pre-existing changes you will NOT commit).

### Phase 2 - Build  ·  event-driven subagent orchestration (PRIMARY) + `/loop` (backup)  ·  `karpathy` to measure, `claudes-gamble` on forks

- **Attended** (the user is present/steering): execute the slices **directly**,
  one at a time, in the session - the user watches each slice land.
- **Unattended - PRIMARY: event-driven subagent orchestration.** Decompose the
  current slice or wave into well-scoped subagent tasks and
  dispatch them as **background subagents** (parallel where independent). Each
  completion notification **wakes the conductor**: verify the subagent's work
  yourself (run the gate - never trust a subagent's own "done"), update
  `CONDUCTOR-RUN.md`, commit surgically, dispatch the next wave. The event chain
  keeps the run alive without polling. **Liveness invariant: never end a turn
  with zero background tasks in flight while slices remain** - no pending event
  means no future wakeup means the run silently dies.
- **Unattended - BACKUP: `/loop`** at a long interval as a heartbeat, started
  alongside the subagent chain. /loop firing is unreliable (it can miss for
  hours), which is exactly why it is the backup, not the driver - but if the
  event chain ever drops (a subagent dies without notifying), the loop fires and
  resumes from the ledger. **If the loop fires while work is already in flight:
  say "already running," verify the children are alive, and stand down - never
  duplicate dispatched work.**
- One slice at a time (a slice's internal tasks may fan out to parallel subagents).
- **Commit surgically.** The tree may carry a large untracked scratch pile
  (review docs, `.glm-loop/`, notes) and files other agents touched. Stage **only
  your files**, then `git status` + `git diff --staged` to verify before every
  commit. Never sweep in files you didn't create. End commit messages with the
  Co-Authored-By line.
- **Tests are the per-slice gate**, not an afterthought. When behavior is
  checkable, reproduce it (`karpathy`) instead of reasoning about it.
- At a genuine fork (two viable designs), resolve it with `claudes-gamble` and
  log the why - don't escalate to the human first. This includes forks the plan
  pre-marked "reserved for the human": DOWNGRADE them to `claudes-gamble` unless
  they touch a hard rail (credentials, merge, spend, destructive, or irreversible). **A conductor
  parked on a mid-run question is a run FAILURE, not caution** - the human returns
  to merge-ready + a decision log (each entry with its reversal path), never to a
  stale question. Batch would-be questions into a "Human review queue" ledger
  section delivered at merge-ready.
- **Gate per slice:** its tests pass; the diff traces to the plan; decision logged.

### Phase 3 - Council gates  ·  invoke the councils below

Councils **gate, they do not decorate.** Run them on a *batch* at meaningful cut
points (end of a wave / before the ship cutoff), **not** per micro-slice. A
council **BLOCKER halts the loop** → fix → re-run that council on the fix.

Route by what the batch touched. Each row convenes a council built with the
generic `council` skill; define the seats for your domain (see
`skills/council/`). The rows below are examples - your project declares its own in
its `AGENTS.md` `## Conductor` section. If none are declared, default to a
generic `council` with correctness / security / operability / user-impact seats.

| The batch involves… | Convene (a `council` with these seats) |
|---|---|
| Core logic / correctness | a council: correctness · edge-cases · failure-modes |
| Security / data / auth | a council: exploit-path · authz · secret-handling |
| Runs unattended over time | a council: idempotency · state-persistence · safe-degradation |
| User-facing surface / UX / copy | a council: first-run legibility · affordance · honest-disclosure |
| Domain-specific correctness (your field) | a council whose seats are your domain's real lenses |

- Synthesize each council to **BLOCKER / concern / nit**. Only BLOCKERs stop the
  ship; log concerns as parked follow-ups with a concrete add-back trigger.
- **Gate:** zero open BLOCKERs across the convened councils.

### Phase 4 - Ship cutoff  ·  invoke `release-manager`

- `release-manager` calls the freeze line: what's **in** this merge vs. deferred.
- Everything cut is parked as an explicit *"add back when <real, observable
  trigger>"* - never "someday" (`elon-first-principles`).
- **Gate:** a written cut list; the in-scope set is coherent and shippable alone.

### Phase 5 - Green gate (objective, no vibes)

The bar from Phase 0, now proven. Run the **real** checks this repo ships on:
- Full test suite for the touched packages (rebuild dist if a worker typechecks
  against it).
- Any acceptance check the plan named - green.
- **Build parity with prod** (`next build`, tsc) - never trust `next dev` alone;
  it skips full typechecking. **Never `next build` an app dir while its `next
  dev` is serving** - it corrupts the shared `.next` and produces silent, wrong
  failures. Stop the dev server or build a clean checkout.
- **Gate:** every check green, output shown. If red, it's not done - back to Phase 2.

### Phase 5.5 - Phase Live-QA Covenant (mandatory)

At the end of every phase, run the strongest safe live check applicable to what
that phase changed. Planning/branch-only phases may record `not applicable - no
runnable change`; every phase that changes executable behavior, runtime config,
data flow, or a user surface must produce a passing live-QA receipt.

- Verify the target is local or otherwise explicitly authorized and
  non-production before starting it.
- If another worktree can mutate the same local database, use a worktree-owned
  project/container identity and unique ports. Verify its exact migration
  `version|name` ledger before writes; a shared local database is valid only
  while every other writer is mechanically stopped.
- Start the real app/API/worker/CLI path and exercise one expected journey, one
  honest failure path, and restart/recovery where applicable. Inspect the
  user-visible result together with API responses, logs, health, and durable
  state. A mock-only or unit-test-only result is not live QA.
- Debug validated failures in the running flow, rerun affected mechanical gates,
  restart cleanly, and repeat until green or a genuine hard rail is recorded.
- Record exact commit, target identity, commands, exits, redacted screenshots or
  outputs, observed state, and limitations. Any later code/config change
  invalidates affected live QA.

Before audits, consolidate current receipts into a required evidence gate with
`kind: live_qa`. The merge-ready validator must reject a Ship claim without it.
This covenant never authorizes production writes, credentials, destructive
actions, deployments, external messages, or irreversible operations.

### Phase 6 - Two independent P0 audits

- Compute the **review range**: `merge-base(main, HEAD)..HEAD`. Commit any of your
  own uncommitted work first (surgically) so the range reflects "now".
- **Leak-scan the bundle BEFORE it leaves the machine.** Reviewers are external
  models. Run the credential grep / gitleaks over the exact diff + any docs you're
  attaching, and fail closed on any finding.
- Get **two independent, adversarial reviews** using separate contexts and, when
  available, different model vendors. Independent means they do not see each other's output.
  Hand them `git diff <base>..<head>` and point them at the critical-path bulk.
- **Audit claims are hypotheses, not findings.** Validate every claimed P0/P1
  against the actual code before fixing anything. A rejected claim gets a cited
  rebuttal (`file:line` + why); a recurring false positive gets a learnings entry
  so the next run can reject it quickly. Only validated findings get fixed - fix
  **sequentially**, and **re-audit the fix**, don't assume.
- **code-review** alongside the two P0 audits - the P0 auditors hunt
  security and data-loss risks; code-review catches ordinary correctness and simplification
  (logic errors, resource/error handling, concurrency, API misuse, dead code) -
  domain-independent, not just the user-facing surface.
- **Synthesize** into one severity-ranked list. Only **P0/P1** (correctness,
  security, data-loss) gate the merge.
- **Gate:** zero open validated P0/P1. P2/P3 become parked follow-ups (logged,
  not silently dropped).

### Terminal cross-council debate gate (mandatory)

After Phase 6 is green, freeze one final code commit and reconvene **every
council selected anywhere in this run** as one terminal model council. This is
separate from the earlier batch councils and audits; neither substitutes for it.
Use debate-protocol mode on the exact frozen commit and complete gate evidence:

1. **Blind round:** one fresh delegate per selected council independently issues
   GO/NO-GO findings with severity, confidence, and file/evidence citations. If
   routing selected only one council, add an independent skeptical correctness
   seat so at least two blind rulings exist. **ALWAYS include a dedicated
   code-review delegate** among the blind seats - general software correctness
   (logic, resource/error handling, concurrency, API misuse, dead code),
   domain-independent, so the terminal consensus is never limited to specialized
   lenses. It scaffolds its own review, then argues it in the cross-critique
   round like every other seat.
2. **Cross-critique round:** reveal all rulings; every delegate challenges the
   others, defends or concedes, and explicitly addresses conflicts.
3. **Consensus round:** record GO/NO-GO, surviving dissent, residual limitations,
   and the exact commit. Cap at three rounds; never average away dissent.

Any new validated BLOCKER/P0/P1 reopens implementation: fix, rerun affected
gates/audits, freeze a new commit, and repeat the full terminal debate. Store the
rounds and verdict as `terminal-cross-council-debate.md`; require it as a passing
manifest gate before merge-ready.

### Mandatory conductor evidence bundle

Before claiming merge-ready, commit `.lenny/evidence/<run-id>/` on the conducted
branch. It contains `manifest.json` plus one artifact per required council,
audit, build, test, live proof, re-audit, terminal cross-council debate, and
Terminus done-council.
Every artifact records its invocation time, exact reviewed commit + merge-base,
diff SHA-256, and residual limitations. Machine-gate artifacts also record the
command and exit code. Review artifacts also record the reviewer seat/model/vendor,
prompt or prompt hash, full verdict/findings with file:line evidence, validation
status, fix commit, and re-audit verdict. Mark an inapplicable field explicitly;
do not silently omit it.

The manifest indexes every artifact with SHA-256, its required/pass state, the
single `reviewedCommit`, and finding lifecycle. Commit code first; reviews pin
that code commit; then commit an evidence-only attestation. Any later non-evidence
change invalidates the bundle and requires affected gates to rerun. Leak-scan the
bundle before commit.

From the project root, run
`node skills/ship-conductor/scripts/validate-evidence.mjs .lenny/evidence/<run-id>`.
Missing/stale artifacts, hash drift, code after the
reviewed commit, a failed required gate, or an open validated P0/P1 forbids
merge-ready. Prose in a ledger is an index, never proof.

The validator checks declared gate completeness, Git/diff binding, artifact
integrity, and clean upstream state. It does not parse the semantic truth of
arbitrary tool output or authenticate process provenance. Preserve raw process
outputs so humans and independent audits can inspect reviewer identity,
independence, commands, and verdicts. A structurally valid bundle is an auditable
record, not cryptographic proof that its claims are true.

### Merge-Ready Claim Interlock (mandatory)

The strict interlock is installed and tested - **invoke it.** The words
`merge-ready` are forbidden until this exact command exits `0`:

```bash
node skills/ship-conductor/scripts/validate-evidence.mjs \
  .lenny/evidence/<run-id> --claim-merge-ready
```

For a Ship claim, `manifest.json` must include `claim.status: merge-ready`,
`claim.scope: ship`, `claim.drivingVendor`, and the complete
`claim.requiredCouncils` list. Required passing gates use typed `kind` values:
`test`, `build`, `leak_scan`, `live_qa`, `council`, two independent
`p0_p1_audit` entries with distinct `reviewerId` values and at least one vendor
different from the driver, plus distinct `terminal_debate` and `done_council`
gates. Council gates carry `councilId`.

Strict mode also requires a fully clean worktree and exact local/upstream HEAD
identity. On success it prints `MERGE-READY INTERLOCK: PASS` and a JSON receipt
containing the reviewed commit, HEAD, manifest SHA-256, and validator exit `0`.
Include that receipt in the handoff. If strict mode fails, the strongest allowed
label is `implementation complete - conductor closeout pending`; fix the missing
gate and rerun. Never paraphrase, waive, or infer a pass.

### Unattended milestone covenant

After the plan is grilled and locked, own routine/reversible decisions, review
remediation, and phase transitions through merge-ready. Do not park on an
ordinary design question; use verified repo contracts and `claudes-gamble`, log
the choice/reversal path, and continue. Interrupt only for a hard rail requiring
new human authority or external state. Emit durable milestone receipts at
dispatch, verified commit, gate failure/blocker, plan lock, and merge-ready.
Runtime push limitations do not weaken liveness: keep the next safe task in
flight whenever the host permits, while describing queued delivery honestly.

#### Mechanical liveness gate (mandatory)

Before saying work is `active`/`in flight`, yielding, or returning a final
response, re-read the durable plan/ledger and inspect the actual task runtime.
An active claim requires a concrete task/agent ID assigned to the next unfinished
slice and observed in a running state; ledger prose or a prior dispatch message
is not proof. If locked work remains and no such task is running, dispatch or
resume it with a stable slice ID, then verify the running state before yielding.

The conductor may have zero running tasks only when all scoped work is
merge-ready, a validated hard rail is recorded, or the human explicitly held or
cancelled the run. A scheduled wake counts only when its scheduler is verified
active. Reconcile the ledger and dispatch the successor after every completion
event. A session-independent supervisor should run the same idempotent reconcile
on completion events with a 60-second watchdog fallback; without that supervisor,
state the host limitation and never promise continuous unattended execution.


#### Native host continuity

Lenny ships instructions, not a supervisor or Stop-hook runtime. Use the host's
native continuation mechanism: completion wakeups or `/loop` where supported,
and `/goal` in Codex. Keep `CONDUCTOR-RUN.md` current before every yield so a
later wake can resume from verified state. If the host provides no active
continuation mechanism, disclose that limit and never promise continuous
unattended execution.

When multiple agents can write the ledger or evidence bundle, serialize those
writes with the host's available coordination primitive. A single-agent run
needs no extra lock machinery.

### Phase 6b - Terminus done-council (MANDATORY before the merge-ready stop)

- After the audits pass, convene a **debate-driven done-council**: independent
  seats each RE-READ the ratified plan end-to-end plus the live-QA evidence,
  then debate (blind verdicts → cross-critique → consensus + dissent register)
  exactly one question: **"is this project ACTUALLY done?"**
- **Standing definition of done:** merge-ready = the agents
  have gone as far as agents can without the human - **backend live QA done
  faithfully, frontend live QA done to the extent agents can do it,** every
  finish-bar item green - so the ONLY remaining human acts are a final live QA
  pass and the merge itself. "Tests pass" alone is NOT done; un-exercised
  runnable paths are NOT done.
- A NO-GO or non-consensus reopens the pipeline (fix → re-audit → re-vote).
  Only an explicit consensus GO advances to Phase 7. Log the verdict, the
  per-seat confidences, and any dissent in the run ledger.
- When a cross-vendor auditor is available (see Phase 6), at least one
  done-council seat runs on the other vendor.

### Phase 7 - STOP at merge-ready + write-up  ·  invoke `pre-k` (+ `gbrain-capture` for lessons)

- **HARD RAIL.** Push the branch (backup + ready to PR). Confirm **`main` is
  untouched**. Deliver the write-up and **report merge-ready**. Do NOT open the
  PR and do NOT merge - the human runs their own review + sanity-check, then
  opens the PR and merges.
- **Produce the write-up** - it is a deliverable, not an afterthought, and doubles
  as the launch/marketing artifact. Use `writeup-template.md` in this skill dir.
  Use `pre-k` to keep the user-facing half plain.
- **Reconcile deferred infra debt** in the write-up's follow-ups - e.g. any
  out-of-band DB/DDL change applied directly (not through a tracked migration)
  leaves migration history unreconciled; name it explicitly so prod parity isn't
  silently broken.
- **Record the learnings - MANDATORY, not optional.** Append every trap paid for
  this run (wrong-target verifications, auditor false positives, env gotchas,
  flaky gates) to the project memory / `gbrain-capture` - one line each, phrased
  so Phase 0 of the *next* run can act on it. A run that hit zero new traps says
  so explicitly.
- **Gate:** branch pushed + merge-ready, `main` clean, PR NOT opened, write-up
  delivered, decision log + parked follow-ups handed over, learnings recorded.

## v1.5 - build + review upgrades (apply at the named phases)

Six upgrades. Orchestration-layer discipline holds throughout: these are
instructions + config the agent READS, never a runtime it executes.

**At Build (Phase 2):**
- **Repo-map.** Before dispatching build subagents, generate a repo-map once - a
  ranked symbol index of the whole codebase (tree-sitter → else `ctags` → else a
  grep symbol-index) - and inject it into every subagent brief. The subagent knows
  WHAT exists and WHERE without reading every file (fewer wrong-file edits).
- **Scoped priming.** Alongside the repo-map, inject only the *relevant slice* of
  accumulated guards / learnings / memories into each subagent brief - filtered by
  the files, symbols, and work-type that subagent will touch, NOT the whole guard
  set. A subagent on the auth path gets the auth-handling
  guards; one editing frontend copy gets neither. Sharper signal, less token bloat,
  and fewer irrelevant false-positive triggers than dumping every guard into every
  brief. Same discipline for the Phase-3 council briefs: give each seat only the
  guards relevant to the code it is reviewing. This remains a scoped READ of
  config, never a runtime.
- **Edit-loop (self-heal before returning).** Each coding subagent runs a bounded
  inner loop before it wakes the conductor: apply → lint → run the touched tests →
  fix → repeat to green (cap the passes). It returns GREEN work. The conductor
  still re-runs the gate (never trust "done") - but a subagent must not hand back a
  known-red slice for the conductor to catch.
- **Codebase-design pass (module shape).** After the repo-map, before slicing,
  invoke `codebase-design`: pressure-test the planned module shape with the
  deep-module / seam / ubiquitous-language lens (Ousterhout · Feathers · Evans) -
  anything shallow? is the seam real (2+ adapters) or speculative? is the interface
  the true test surface? are the names honest? Findings harden the slices before
  code is written; it also registers as a "deep-module" seat in the Phase-3
  councils. Opt-in glossary/ADR files; in-context lens + gate by default.

**At Councils (Phase 3):**
**Council modes (vocabulary).** A **model council** is the body: N model
perspectives convened over one question to produce one ruling. It runs in one of
two modes. **Conferring mode** - seats share one context and deliberate together;
cheap, fast, one blended voice, but the seats are never independent, so agreement
is a *feeling* (anchoring/groupthink risk - LLM conformity to majorities is
empirically documented). **Debate-protocol mode** - blind independent rulings →
cross-critique → consensus with surviving dissent preserved; ~2-3× cost, but
convergence is a *measurement* and every claim must survive attack. Match mode to
stakes: conferring for routine gates; debate-protocol for load-bearing,
safety-critical, or irreversible decisions.

- **Debate appendage (independent → cross-critique → consensus).** Councils run TWO
  rounds: (1) independent - each persona writes findings BLIND (preserves
  blind-spot coverage); (2) debate - each reads the others' and cross-critiques,
  defending or conceding, converging to a logged consensus. Independent-first is
  non-negotiable; the debate round kills false-positives AND surviving-bugs (a
  meta-review: they review each other's reviews). Bounded (cap 2–3 rounds).
- **Confidence-scored findings.** Every finding carries a **confidence (0–1)**
  alongside its severity. Severity = "how bad if real"; confidence = "how sure it's
  real." A high-severity / low-confidence finding gets extra validation-against-code
  before it is allowed to gate.
- **Typed councils as config.** Councils are structured config the skill READS - a
  registry entry `{persona, lens, output-schema: severity+confidence+file:line}` -
  portable, versionable, diff-able, output-checkable. HARD RAIL: config the skill
  reads, NEVER a runtime that executes it. An engine that parses+runs the config
  turns Lenny into a framework and forfeits its run-inside-any-harness portability.

**At Audits (Phase 6):**
- **Cross-vendor final audit.** One of the two independent P0 audits runs on the
  OTHER vendor's model. **The DRIVING vendor picks the direction** - and a same-vendor
  reviewer does NOT satisfy this (Codex spawning a Codex reviewer is not cross-vendor):
  Before dispatch, verify that repo policy or the user authorizes sharing the
  reviewed material with that vendor. Unknown authorization is a hard stop, not
  implied consent.
  - **Claude-driven →** dispatch a Codex auditor:
    `codex exec --skip-git-repo-check "<audit brief over merge-base..HEAD>"`
  - **Codex-driven →** dispatch a Claude Code auditor from the worktree directory:
    `CLAUDE_LIVENESS_EXEMPT=1 gtimeout 600 claude -p --permission-mode bypassPermissions "<audit brief over merge-base..HEAD>" </dev/null`
    (add `--model <claude-model>` to pin the tier). The audit must read files and
    run Git; the environment and permission mode keep the headless session usable.
  Cross-VENDOR independence (different training → different blind spots) beats two
  same-model instances. Findings stay hypotheses to validate against code. Needs the
  other CLI installed + authed; fall back to a same-vendor clean-context subagent if
  absent - never skip the audit.

**Guards (folded from the Rumsfeld + Kissinger passes on v1.5):**
- **Edit-loop can't game the gate.** Self-heal by FIXING code - never by weakening
  the gate (no skipping/xfail/deleting tests, no lint-ignore to go green). Gaming
  the gate is a P0 honesty violation the conductor's re-run must catch.
- **Debate preserves dissent.** A minority finding that SURVIVES the debate is
  logged with its rationale, never erased by "consensus" (same rule as 2/1 council
  splits - surface the dissent, don't average it away).
- **Repo-map refreshes.** Regenerate it at slice boundaries; a stale map late in a
  build misleads more than it helps.
- **Cross-vendor audit fails safe.** If the other CLI is absent OR the dispatch
  fails (unauthed / usage-limited / error), try the remaining third vendor's CLI first (e.g. `grok -p`), then fall back to a same-vendor
  clean-context subagent - never block or skip the audit.
- **Bound transport retries.** Make at most two total cross-vendor
  preflight/dispatch attempts per frozen tip. A missing CLI/auth/subscription,
  quota failure, provider error, timeout, or empty/unusable response consumes
  an attempt. After two failures, record both redacted receipts as a required
  `cross_vendor_unavailable` gate (`attempts: 2`), run one additional
  clean-context same-vendor P0/P1 audit so the tip has at least three distinct
  reviewers, disclose the waiver, and continue. Never call the waived audit
  cross-vendor; never waive returned findings or open P0/P1s.

**At merge-ready exit (the Bayesian pass - Lenny's self-improvement loop):**
- **Bayesian.** After the write-up, invoke `bayesian`: distill the run's recurring
  traps / false-positives into candidate guards (marked `origin: auto`), UPDATE
  each guard's confidence on application, **auto-promote a LOW-RISK guard after
  N=3 confident applications**, and **human-gate anything touching a high-impact
  or safety-sensitive path** (never auto-promoted). Never auto-touches human-authored skills;
  scans forked skills before adoption via `find-skills` (Lenny's surface-only
  discovery + vetting front door - search → vet installs/source/stars +
  injection-scan → PRESENT to the human, never auto-install; also invoked on a
  mid-run capability gap). Extends `gbrain-capture` from "record a note" to
  "draft a gated, self-promoting guard."
- **Repetition trigger (fires mid-run, not only at exit).** A correction or
  preference the user states TWICE - across turns or runs (e.g. "no em dashes,"
  "don't lead with margin") - is a first-class capture signal on its own: the lesson
  isn't sticking, so promote it to a guard/memory immediately, without waiting for
  the merge-ready reflection or N=3. Log it `origin: repetition` with the two
  occurrences; it still obeys the gate (style/UX self-promotes, high-impact work is
  human-gated). See `bayesian`.

**Lenny v2:** the two additions above, `codebase-design` (the
deep-module / seam / ubiquitous-language shape gate at Build) and `find-skills`
(surface-only registry discovery) - mark **v2**, distilled from a full survey of
the open skills registries. Same orchestration-layer rail: config the agent
READS, never a runtime.

**Deliberately NOT in v1.5:** a continuous every-turn advisor (unproven,
token-expensive, redundant with the per-slice test gate) and a formal checkpointer
(commits + the run ledger already deliver crash-recovery).

## The Rumsfeld pass - after every phase gates

Every phase ends with a **Rumsfeld pass** (invoke `rumsfeld`): audit the phase's
diff + artifacts for **unknown-knowns** - latent assumptions the code enforces
but never states, patterns that emerged un-named, capabilities you already built
without realizing, implications of a decision nobody traced, one-offs that are
actually reusable primitives. Surface 2–6 grounded items (each cited to
`file:line`/artifact, tagged implement / document / park / discard), log them to
`CONDUCTOR-RUN.md`, and feed them into the Phase 6 audit. It **surfaces and
recommends - it never silently implements**; the human/agent decides. Zero
findings is a valid, honest answer. This is how the run catches the non-obvious
thing that was hiding in plain sight the whole time.

## The Kissinger pass - after every phase gates (right after Rumsfeld)

Then ask the Kissinger question (invoke `kissinger`): **"Is this the best you can
do?"** If a MATERIAL improvement exists (correctness, coverage, clarity,
robustness, risk, user value - not cosmetics), revise → **validate (re-run the
gate)** → resubmit → ask again, until you can truthfully say *"yes, this is the
best under the current requirements and constraints,"* naming residual
limitations. **Bounded:** hard cap **3 passes**, stop earlier on no-material-gain
or diminishing returns; at the cap without a truthful yes, STOP and surface
what's still improvable (often a scope signal). Guards BOTH a lazy premature
"yes" and an endless perfectionist "no" - the human review afterward catches
either. Log the verdict + what improved + residual limits to `CONDUCTOR-RUN.md`.

## The run ledger + decision log (on disk, always)

`CONDUCTOR-RUN.md` is created in Phase 0 and updated **as each phase gates** -
phase, gate evidence (one line), decisions made, parked items. Every autonomous
call gets one line: **decision · why · how to reverse it.** The human audits
*after*, not before - this is what makes "I didn't ask" trustworthy.

Why on disk: long runs WILL hit context compaction. If you wake up mid-run with
thin context, your first move is `cat CONDUCTOR-RUN.md` - it tells you the goal,
the finish bar, which phase gated last, and what's parked. Deliver its final
state with the Phase 7 write-up.

## Red flags - you've stopped conducting and started freelancing

- You verified a fix but not on the datastore the app actually uses.
- The run ledger is stale (last entry two phases ago) - you're carrying state in
  context that compaction will destroy.
- You fixed an audit finding you never validated against the code.
- You called something "done" without showing a green check.
- You ran a council but let a BLOCKER through because the fix was tedious.
- You `git add -A`'d and swept in scratch / another agent's files.
- You `next build` an app whose `next dev` is live.
- You're about to merge / force-push / delete something to "finish" - **STOP**,
  that's the human's call.
- A council or reviewer contradicts a plan assumption and you rationalize past it
  instead of re-verifying.

## The finish

Done = **merge-ready (branch pushed), PR NOT opened, `main` untouched, green gate
shown, zero open P0/P1, write-up + decision log delivered.** Not "I made
progress." Then report: the result, the gate output, the audit synthesis, the
decision log, and the parked follow-ups - so the human can review, sanity-check,
open the PR, and merge.

## Harness adaptation (Lenny runs in more than one harness)

The conductor's method is harness-neutral; these idioms map per host:

- **Claude Code:** as written - `/loop` backup heartbeat, background subagents
  with completion wakeups, Skill-tool invocation.
- **Codex:** backup heartbeat = **`/goal`** (there is no /loop). Subagents exist,
  but background/wakeup lifecycles may not map cleanly; verify the live host
  before relying on completion events and default to sequential
  slice waves in-session. "Invoke `X`" means read X's `SKILL.md` from the
  installed suite - skills are files, there is no Skill tool.
- **zcode (GLM):** `/goal` heartbeat; install its `zcodes-gamble` adapter when
  using the separately packaged GLM port.
- **Grok Build (untested):** reads the Claude Code format natively (CLAUDE.md,
  `~/.claude/skills`, hooks, marketplaces), so Claude Code mappings likely
  apply; headless dispatch is `grok -p "<brief>" --no-auto-update`. Verify on
  first use before relying on it.

**Cross-vendor audit pool (three vendors).** The P0 auditor comes from a
DIFFERENT vendor than the one driving the run; first available wins:
Claude-driven → `codex exec --skip-git-repo-check` else `grok -p`;
Codex-driven → `claude -p` else `grok -p`; Grok-driven → `claude -p` else
`codex exec`. Check availability + auth BEFORE dispatching
(`command -v claude codex grok`); if no other vendor's CLI is installed and
authed, fall back to a clean-context same-vendor subagent and disclose the
fallback in the audit record.

**Independence fails closed.** A harness that cannot provide isolated reviewers
must not invent blind seats from the driver's own reasoning. Use separate
clean-context CLI processes when native subagents are unavailable (for Codex,
separate ephemeral `codex exec` calls), preserve each raw output, and mark the
council unavailable if isolation cannot be established.
