# Evidence Contract

Read this only during Ship Conductor Phase 7.

Create `.lenny/evidence/<run-id>/manifest.json` with:

- `runId`, `reviewedCommit`, `mergeBase` and SHA-256 of the binary Git diff;
- `claim.status: merge-ready`, `claim.scope: ship`, `claim.riskClass`,
  `claim.drivingVendor` and the complete `claim.requiredCouncils` list;
- a complete findings inventory;
- one gate record per required proof.

Every gate has:

- `id`, `kind`, `status`, `required`, `artifact`, `sha256` and
  `reviewedCommit`;
- `councilId` for a council;
- `reviewerId` and `vendor` for an audit.

All artifacts must be regular files inside the bundle and match their declared
SHA-256. Except for risk and child/lane dependency receipts, every artifact is a
machine-readable JSON receipt with `schemaVersion: 1`, matching `gateId`,
`kind`, `reviewedCommit`, `exitCode: 0` and a parsed `verdict`. Tests, builds,
leak scans and live QA include the exact `command` or named `workflow`.
Councils use `verdict: GO`; audits use `verdict: PASS`, `openP0: 0`,
`openP1: 0` and matching reviewer/vendor identity. A manifest may not relabel a
failed or narrative-only artifact as passing. Track the manifest and every
required artifact in Git.

## Required gates

All Ship claims require passing:

- exactly one `risk_classification` gate when `claim.riskClass` is declared;
- at least one `test`;
- at least one `build`;
- at least one `leak_scan`;
- at least one `live_qa`;
- every named `council` in `claim.requiredCouncils`;
- at least one `done_council`;
- risk-matched `p0_p1_audit` gates.

Standard risk requires one independent audit. High-stakes risk requires two
distinct reviewers, a `terminal_debate` and one audit from a vendor different
from `claim.drivingVendor`. The high-stakes reference defines the bounded waiver.

No validated P0/P1 finding may remain open. Code may not change after
`reviewedCommit`. At strict closeout, the worktree must be clean and local `HEAD`
must equal its upstream.

Run the validator first without a claim to diagnose the bundle, then run the
strict interlock:

```bash
node .lenny/core/skills/ship-conductor/scripts/validate-evidence.mjs \
  .lenny/evidence/<run-id>

node .lenny/core/skills/ship-conductor/scripts/validate-evidence.mjs \
  .lenny/evidence/<run-id> --claim-merge-ready
```

In the Lenny source repository, omit `.lenny/core/` from the script path.
