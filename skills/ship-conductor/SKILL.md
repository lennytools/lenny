---
name: ship-conductor
description: Drive one software implementation plan end to end in Codex: lock the outcome, branch, build, verify, review, audit and stop at a proven merge-ready branch. Also triggers on lenny, conduct, ship conductor, drive this plan and run lenny.
---

# Ship Conductor

Lenny's Codex-first software implementation workflow. It turns one accepted plan
into the smallest verified branch a human can review and merge. It does not
deploy, operate production, open a pull request, merge or become an agent runtime.

## Finish line

Merge-ready means all of these are true:

- the original user-visible outcome is frozen and satisfied;
- the work is on a feature branch and the base branch is untouched;
- the changed workflow was exercised at the strongest practical level;
- required tests, build, leak scan, council, audit and done review pass;
- all validated P0/P1 findings are closed;
- evidence is bound to the exact reviewed commit;
- the branch is pushed and equals its upstream;
- the strict evidence interlock exits `0`;
- no PR was opened and nothing was merged or deployed.

If a repository has no remote or the user forbids pushing, stop at **locally
verified; merge-ready closeout blocked by upstream proof**. Never weaken the term.

## Read first

1. Read `plan.md` or the plan the user named.
2. Read `.lenny/profile.md`.
3. Read the repository instructions and relevant code/tests.
4. Read `outcome-lock/SKILL.md`, `first-principles/SKILL.md` and
   `release-manager/SKILL.md` from the installed Lenny root.
5. Do not read every optional skill or reference up front. Read a reference when
   its named phase begins.

Use `.lenny/core` as the Lenny root in an installed project. Use the repository
root while developing Lenny itself.

## Phase 0: lock the outcome

- Verify repository, branch, worktree, remote and verification commands.
- Separate verified facts, user-stated requirements and unknowns.
- Translate the plan into observable acceptance criteria. Preserve the user's
  outcome even when a council suggests an easier substitute.
- Create `.lenny/runs/<run-id>/OUTCOME-CONTRACT.json` with Outcome Lock.
- Create `.lenny/runs/<run-id>/CONDUCTOR-RUN.md`. Keep it current after every
  phase through Phase 5 so another context can resume from disk.
- Run state is part of the reviewed change. Commit and freeze all
  `.lenny/runs/<run-id>` files before selecting `reviewedCommit` for Phase 6.
  Record later audit and closeout results only in `.lenny/evidence/<run-id>`.
- Freeze `Must ship now / Fast follow / Not doing`. New ideas default to fast
  follow unless the accepted path cannot work without them.

Ask the user only when new authority, spend, credentials, destructive action or
a materially different product decision is required. Resolve ordinary reversible
implementation choices from repository evidence and record the reversal path.

## Phase 1: classify risk and branch

Run and save the deterministic classifier:

```bash
node .lenny/core/bin/lenny.mjs risk --json \
  --files "comma,separated,paths" \
  > .lenny/runs/<run-id>/risk-classification.json
```

When developing Lenny itself, use `node scripts/lenny.mjs risk`.

- `standard`: reversible work without auth, secrets, money, custody,
  destructive persistence, migration, production infrastructure or a security
  boundary.
- `high-stakes`: any trigger above, uncertainty about material impact or an
  explicit escalation.

Repository semantics and the user may escalate. Never mechanically downgrade.
Re-run the classifier against the frozen reviewed commit and its exact merge
base after the Phase 5 freeze. Write the final receipt directly into the
evidence bundle; do not supply a hand-written file list:

```bash
node .lenny/core/bin/lenny.mjs risk --json \
  --reviewed-commit "<full-commit-sha>" --merge-base "<full-base-sha>" \
  > .lenny/evidence/<run-id>/risk-classification.json
```

Create a fresh feature branch from current base. Fetch first when a remote exists.
Preserve pre-existing user changes and stage only files owned by this run.

## Phase 2: build the smallest correct slice

- Generate a compact repo map with `rg` or `ctags` only when the code is larger
  than the directly affected slice.
- Apply first-principles software engineering: inspect before editing, verify
  command preconditions and make the smallest matching change.
- For shape-bearing work, read `codebase-design/SKILL.md`. Skip it for a localized
  edit that adds no module or seam.
- Implement one coherent slice at a time. Run touched tests after each slice and
  fix failures before proceeding.
- Do not introduce an abstraction until a real second use or adapter proves the
  seam.
- Commit the product implementation before reviews. Reviews bind to a commit,
  never to a moving worktree.

After the phase, read `rumsfeld/SKILL.md` and surface grounded unknown-knowns.
Then read `kissinger/SKILL.md` and ask whether a material improvement remains.
Bound this to three passes; cosmetic churn is not improvement.

## Phase 3: Software Implementation Council

Read `council/SKILL.md` and
`council/references/software-implementation-council.md`.

Use the three public seats:

1. Contract / correctness
2. Failure / security
3. Simplicity / maintainability

Each seat receives the same outcome contract, project profile, merge base, exact
diff and verification receipts. Round 1 is blind. Then run one bounded
cross-critique and issue one `GO`, `NO-GO` or `BLOCKED` consensus with dissent.

### Codex isolation preflight

Probe native subagent dispatch once. A successful probe returns a real task ID.
If it errors, returns no ID or reports that the parent thread does not exist:

- do not retry it;
- do not call wait on it;
- immediately use one fresh `codex exec --ephemeral` process per seat;
- verify `codex --version` and `codex login status` first;
- bind every process to the same frozen commit and write each raw output to a
  different file;
- never ask a fallback reviewer to convene another council.

If neither native dispatch nor isolated CLI processes work, the council is
unavailable and the run is blocked. Never write three pretend-independent voices
inside the driver context.

Validate every finding against code before it gates. Fix validated blockers,
re-run affected proof and reconvene only the affected seat plus consensus.

## Phase 4: release cutoff

Apply the release-manager rule:

- freeze the accepted design;
- reject additions outside the exact acceptance path;
- retain fast follows in the ledger without changing this branch;
- once the core path works, fix only failures in that path.

## Phase 5: green gate and live workflow

Run every verified command from `.lenny/profile.md` that applies:

- focused tests, then the full relevant suite;
- build, lint and typecheck when present;
- leak/secret scan over the exact diff;
- the real user-facing workflow end to end.

For browser-facing behavior, follow the repository's browser QA rule. For a
library or CLI, run its exported or installed interface with success and failure
inputs. If no user-facing runtime exists, state why browser QA is inapplicable
and prove the real callable interface instead.

Do not use passing unit tests as a substitute for a runnable workflow.

Update the outcome contract and conductor ledger with all Phase 0-5 results,
commit the run state, and freeze that commit as `reviewedCommit`. Do not modify
`.lenny/runs/<run-id>` after this point. Then replay the final risk
classification, every deterministic gate and every required council against
that exact commit, writing the final receipts directly under
`.lenny/evidence/<run-id>`. Earlier receipts are exploratory and cannot satisfy
the merge-ready interlock.

## Phase 6: independent audit

Standard work requires one fresh P0/P1 audit. High-stakes work requires two
distinct audits plus a cross-vendor auditor when authorized and available.

An auditor receives the outcome contract, exact reviewed commit, merge base,
diff and proof artifacts. It does not receive the driver's conclusions. It must
return reproducible P0/P1 findings or `PASS`, with file/line evidence. Validate
every finding locally. Repair validated P0/P1s, commit, rerun affected gates and
reaudit the new tip.

For high-stakes transport and waiver rules, read
`references/high-stakes-audit.md`. Do not load that reference for standard work.

## Phase 6b: done council

After audits pass, independently re-read the locked outcome and live proof.
Answer one question: **Is this project actually done at the stated finish line?**

The done council must distinguish:

- implemented;
- locally verified;
- pushed and merge-ready;
- deployed or production-proven.

A `NO-GO` reopens the smallest affected phase. A `GO` must list residual limits
and confirm that the only remaining human acts are review and merge.

## Phase 7: evidence and stop

Read `references/evidence-contract.md`. Create the evidence bundle under
`.lenny/evidence/<run-id>`, hash every gate artifact and bind it to the exact
reviewed commit. Record deterministic tests, builds, leak scans and live QA with
the referenced gate runner rather than writing pass receipts by hand. Commit the
evidence directory only, push the branch when authorized and verify local `HEAD`
equals upstream. Do not add `.lenny/runs/` to the evidence commit.

The phrase `merge-ready` is forbidden until this exits `0`:

```bash
node .lenny/core/skills/ship-conductor/scripts/validate-evidence.mjs \
  .lenny/evidence/<run-id> --claim-merge-ready
```

When developing Lenny itself, omit `.lenny/core/` from the script path.

On pass, preserve the literal `MERGE-READY INTERLOCK: PASS` receipt. Use
`writeup-template.md` for the handoff. Stop. Do not open a PR, merge or deploy.

## Always-on rails

- Never use `git add -A` in a dirty repository.
- Never amend, reset, rebase, force-push, delete or merge without explicit scope.
- Never ask the user to run verification the agent can run.
- Never claim an external state from docs, memory or a source diff.
- Never let a council change the frozen outcome.
- Never leave active work with no real running task or explicit blocker.
- Never hide a failed gate behind a summary.

## Handoff

Lead with the observable result. Include:

- branch and reviewed commit;
- exact verification commands and outcomes;
- council and audit verdicts;
- strict interlock receipt or the precise blocker preventing it;
- fast follows and known limitations;
- confirmation that no PR, merge or deployment occurred.
