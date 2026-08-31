# High-Stakes Audit

Read this only when the frozen risk class is `high-stakes`.

Run two independent P0/P1 audits from distinct reviewer contexts. At least one
must use a vendor different from the driving vendor when repository policy and
the user authorize sharing the reviewed material.

For a Codex-driven run, try an authenticated `claude -p` first, then an
authenticated `grok -p`. Bound cross-vendor preflight/dispatch to two attempts
total. A missing CLI, failed authentication, quota error, provider error,
timeout or unusable response consumes one attempt.

After two failed attempts:

1. save redacted receipts for both failures;
2. add a passing `cross_vendor_unavailable` gate with `attempts: 2`;
3. set `claim.crossVendorAuditWaiver: true`;
4. run a third independent same-vendor clean-context audit so the frozen tip has
   three distinct reviewers total;
5. disclose that cross-vendor review was unavailable.

This waives transport availability only. It never waives returned findings,
reviewer independence or an open P0/P1.
