# Exact stranger workflow proof

Date: 2026-08-31

Disposable repository: `/private/tmp/lenny-final-pAnNuD`

This was a real non-empty Git repository with a pre-existing `AGENTS.md`, README,
package files and `plan.md`. Lenny was installed from the public source worktree,
then configured through a clean-context Codex session. The original instruction,
“Preserve this sentence and use Node.js without third-party dependencies,”
remained intact.

The installed conductor created `lenny/counter-20260831`, implemented the tiny
Counter plan, ran the default three-seat Software Implementation Council and
completed deterministic tests, build, leak scan, direct library live QA,
independent P0/P1 audit and done review. No PR, merge or deployment occurred.

The first closeout attempt correctly rejected evidence made stale by run-state
files committed after the reviewed code. The session re-reviewed that exact tip
and produced a second evidence-only closeout. Public Lenny's instructions were
then corrected so future runs freeze Phase 0-5 state before final gates.

Independent replay from the repository root exited 0:

```text
MERGE-READY INTERLOCK: PASS
{"status":"merge-ready","scope":"ship","runId":"counter-20260831-23056940-closeout-r2","reviewedCommit":"9b5061a4f03db48422c38e34843c18fe64dde703","head":"163e154a9f25f069d965432e57ade7dd7c5c85eb","upstream":"163e154a9f25f069d965432e57ade7dd7c5c85eb","evidenceManifestSha256":"6f795ee71ed468ec5b2956af17af820929f9c23b24bf6452667a59875c21f8f3","validatorExitCode":0}
evidence valid: counter-20260831-23056940-closeout-r2
```
