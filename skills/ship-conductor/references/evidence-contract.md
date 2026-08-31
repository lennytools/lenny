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
`kind`, `reviewedCommit`, `exitCode: 0` and a parsed `verdict`. Run tests,
builds, leak scans and live QA through `scripts/run-gate.mjs`; those receipts
contain the exact argv, real process exit, timing and output digest.
Councils use `verdict: GO`; audits use `verdict: PASS`, `openP0: 0`,
`openP1: 0` and matching reviewer/vendor identity. A manifest may not relabel a
failed or narrative-only artifact as passing. Track the manifest and every
required artifact in Git.

This is a local evidence-consistency and process-reenactment interlock, not a
cryptographic attestation service. A repository owner can forge local files or
misstate reviewer identity. Preserve independent reviewer transcripts and
provider/session identifiers for human audit; do not claim the validator proves
who performed a review.

Example deterministic gate:

```bash
node .lenny/core/skills/ship-conductor/scripts/run-gate.mjs \
  --gate-id tests --kind test --reviewed-commit "$REVIEWED_COMMIT" \
  --output .lenny/evidence/<run-id>/tests.json -- npm test
```

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

The final closeout commit contains `.lenny/evidence/<run-id>` only. Phase 0-5
run state under `.lenny/runs/<run-id>` must already be frozen in
`reviewedCommit`. Adding or changing run state after review correctly makes the
evidence stale; do not rebind a review merely to repair commit ordering.
Every required gate, council and audit receipt must be produced or replayed
against that frozen commit. A receipt from before the run-state freeze is stale
even when the product files did not change.

Run the validator first without a claim to diagnose the bundle, then run the
strict interlock:

```bash
node .lenny/core/skills/ship-conductor/scripts/validate-evidence.mjs \
  .lenny/evidence/<run-id>

node .lenny/core/skills/ship-conductor/scripts/validate-evidence.mjs \
  .lenny/evidence/<run-id> --claim-merge-ready
```

In the Lenny source repository, omit `.lenny/core/` from the script path.
