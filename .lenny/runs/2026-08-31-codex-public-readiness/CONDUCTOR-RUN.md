# Conductor Run: Codex Public Readiness

## Goal

A stranger can safely install and configure Lenny in an existing Codex
repository, receive the default implementation council, diagnose the setup and
conduct work under a risk-adaptive, evidence-bound process.

## Objective finish bar

- All required criteria in `OUTCOME-CONTRACT.json` pass with evidence.
- Automated tests and GitHub Actions configuration pass locally where runnable.
- A real temporary non-empty repository completes install, setup, doctor,
  refresh and uninstall checks.
- Three-seat implementation council and independent audits report no validated
  blockers.
- Branch is pushed and the merge-ready evidence interlock exits 0.
- No PR is opened and `main` remains untouched.

## Verified facts

| Fact | Evidence |
|---|---|
| Public source repository is `lennytools/lenny` | `git remote -v` and authenticated `gh repo view` on 2026-08-31 |
| Isolated branch starts from current `origin/main` | branch `codex/public-install-v1`, base `1844cae` |
| Personal Lenny worktree has unrelated modified and untracked files | `/Users/bradleymiles/Documents/lenny` status inspected before worktree creation |
| Public main has 18 skills and no release tags, releases or CI | repository and GitHub state inspected on 2026-08-31 |
| Current installer stops when `skills` or `AGENTS.md` exists | `README.md` install block |
| Evidence validator has a passing self-test | `node skills/ship-conductor/scripts/validate-evidence.test.mjs` |
| Outcome validator has a passing self-test | local generic `outcome-lock` validator, exit 0 |

## Unknowns

| Unknown | Resolution |
|---|---|
| Exact installer and profile schema edge cases | Resolve through fixtures before freezing interfaces |
| Cross-platform shell behavior | Test macOS and Linux in CI; Windows is explicitly unsupported in this release |
| Whether Codex is installed and authenticated in every user environment | Doctor reports capability honestly; authentication is never inferred |

## Decision log

- Use `origin/main` as the public core baseline because it is the only shared,
  reviewable source. Reverse by abandoning this isolated branch.
- Keep personal councils out of the public branch because strangers need generic
  defaults. Reverse later through an optional profile package.
- Support Codex on macOS/Linux first because the user explicitly cut Claude Code
  to fast-follow. Reverse by adding a separately tested host adapter.
- Keep Lenny as instructions plus deterministic support scripts, not an agent
  runtime. Reverse only if a proven user workflow requires a resident process.
- Install the public core under `.lenny/core` and reserve `.lenny/skills` and
  `.lenny/councils` for project-owned overlays. Reverse through a profile-schema
  migration if real installations show the boundary is wrong.
- Treat unchanged, integrity-verified reinstalls as no-ops. A mismatched hash
  triggers atomic repair even when the semantic version is unchanged.

## Release boundary

### Must ship now

- Safe install/update/uninstall
- Conversational setup skill and canonical profile
- Doctor
- Default three-seat implementation council
- Risk-adaptive orchestration contract
- Automated tests and CI
- Version and release management
- Codex-facing documentation

### Fast follow

- Claude Code and Zcode adapters
- Personal and domain council packs
- Deployment, DevOps, monitoring and auto-merge

### Not doing

- GUI, daemon, cloud control plane, marketplace or hosted runtime

## Phase status

- Phase 0 ground truth: passed; public baseline, product boundary, finish bar and
  source-of-truth decision are recorded.
- Phase 1 branch: passed, isolated worktree on `codex/public-install-v1`
- Phase 2 build: implementation complete; current verification covers 24 tests,
  evidence-validator self-test, outcome-validator self-test, release metadata,
  syntax, YAML parse and whitespace checks.
- Phase 3 councils: two blind review rounds completed. The first round found and
  closed installer rollback, symlink, marker, CLI-option, local-manifest, Doctor,
  risk binding and release ancestry defects. The second found and closed risk
  downgrade, default Doctor command execution, incomplete release-matrix gating
  and hand-written deterministic receipt defects.
- Phase 4 cutoff: passed; no fast-follow scope entered the release.
- Phase 5 green gate: passed at the frozen run-state commit. `npm run check`
  passes 24 tests plus syntax, evidence, outcome, release and diff checks.
- Phase 6 audits: pending against the frozen commit; final receipts will be
  written only under `.lenny/evidence/`.
- Phase 7 merge-ready stop: pending public-branch evidence, push and interlock.

## Phase 2 Rumsfeld pass

1. The managed core boundary also creates the missing public/private extension
   seam. **Implemented:** project skills and councils now live outside the
   replaceable core and survive update/uninstall.
2. A semantic version alone cannot detect same-version corruption.
   **Implemented:** the installed manifest hashes every managed file and Doctor
   verifies it; reinstall repairs drift.
3. Filename-based risk detection cannot observe every semantic authority change.
   **Documented:** explicit user, profile or agent knowledge can only escalate,
   never mechanically downgrade, the risk class.
4. GitHub CI cannot prove a conversational Codex workflow. **Verified:** a real
   clean-context Codex session installed into a temporary non-empty repository,
   created and refined `.lenny/profile.md`, preserved the existing instruction,
   ran detected test/build commands and produced a healthy Doctor result.
5. A native collaboration dispatch can be unavailable inside an ephemeral Codex
   CLI session even though ordinary Codex execution works. **Implemented:** the
   council isolation ladder now forbids waiting on a failed dispatch and moves
   immediately to separate ephemeral Codex processes.

## Phase 2 Kissinger pass

- Pass 1 materially improved integrity: same-version tampering is detected and
  repaired rather than silently accepted.
- Pass 2 materially improved extensibility: strangers can create project-owned
  skills and three-seat councils without forking or editing public core.
- Verdict: best under the current Codex-first implementation boundary pending
  live Codex QA and independent review.
- Residual limitation: Windows and non-Codex hosts are intentionally unsupported
  in this release.

## Live Codex QA finding and repair

- PASS: conversational `Set up Lenny` journey completed in a non-empty fixture;
  only `.lenny/profile.md` changed, all existing source and instructions remained
  byte-identical, and Doctor exited 0.
- PASS: the same installed Lenny created `feature/counter-contract`, made the
  bounded two-file implementation, committed it and passed three tests, syntax
  build, direct library QA and Doctor.
- BLOCKER FOUND: `doctor --help` was parsed as an option requiring a value.
  **Repaired and covered:** all six public commands now have non-destructive help.
- BLOCKER FOUND: native council dispatch returned no valid parent thread and the
  conductor waited indefinitely. **Repaired in the orchestration contract:** one
  failed probe now triggers clean-context CLI isolation immediately; waiting and
  retrying the invalid task are prohibited.

## Phase 3 Rumsfeld and Kissinger pass

1. A preserved project profile is user-owned input, so even a diagnostic can be
   a code-execution boundary. **Implemented:** ordinary Doctor is non-executing;
   explicit deep Doctor runs commands only after profile review.
2. A release job that checks one runtime after CI passed elsewhere can publish a
   compatibility regression. **Implemented:** publication now depends directly
   on the complete macOS/Linux and Node 20/22/24 release matrix.
3. A typed JSON receipt can still be authored rather than observed.
   **Implemented within the local threat model:** deterministic gates use a real
   process recorder with argv, exit, timing and output digest. **Documented
   limit:** local evidence cannot cryptographically attest reviewer identity.
4. A shared risk classifier prevents the producer and verifier from drifting,
   but a shared implementation can share a bug. **Mitigated:** independent
   high-stakes and downgrade tests exercise the installer trigger through the
   strict evidence interlock.

Kissinger verdict: material review findings were fixed rather than deferred.
The remaining material test is an exact-tip stranger workflow and independent
final audit; no additional feature belongs in this release.

## Exact stranger proof

- A disposable non-empty Git repository installed and configured Lenny while
  preserving its original `AGENTS.md` instruction.
- A clean-context Codex session created a feature branch, locked a five-criterion
  Counter outcome, implemented the two-file plan and used the default independent
  three-seat Software Implementation Council.
- Tests, build, direct library live QA, leak scan, risk classification,
  independent P0/P1 audit and done council passed.
- The feature branch was pushed to its local bare remote at
  `163e154a9f25f069d965432e57ade7dd7c5c85eb`.
- Independent replay printed `MERGE-READY INTERLOCK: PASS`; local HEAD equaled
  upstream and the worktree was clean. Full receipt:
  `.lenny/runs/2026-08-31-codex-public-readiness/STRANGER-PROOF.md`.
- The run exposed one process defect: run-state files were added after the first
  reviewed commit. Public Lenny now requires Phase 0-5 run state to be committed
  and frozen first, then replays final gates against that exact commit. The
  evidence self-test covers this ordering.

## Phase 5 freeze

All run-state changes end with this section. Phase 6 and Phase 7 results belong
only in `.lenny/evidence/`; this ledger must not change after the reviewed commit.
