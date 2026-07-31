# Write-up template

The write-up is the final human handoff for a conducted change. It has two
parts: a plain-language result and a concise technical record.

Fill every section from verified facts. Cut any section that does not apply;
do not pad.

## Result

**<One-line headline describing what is ready for review>**

In two to four plain sentences, explain what changed, who benefits, and the
observable result. Do not claim deployment, publication, or merge unless those
actions were explicitly authorized and verified.

## How it works

- Describe the smallest useful mental model for the change.
- Name the important boundary, invariant, or failure behavior.
- State any honest limitation that affects how a user should rely on it.

## Verification

| Gate | Command or artifact | Result |
|---|---|---|
| Tests | `<exact command>` | `<exit and summary>` |
| Build | `<exact command>` | `<exit and summary>` |
| Live QA | `<target and journey>` | `<observed result>` |
| Reviews | `<councils and audits>` | `<verdict>` |

## Demo

Link or embed the shortest artifact that shows the change working. When a
quality gate rejected an earlier version, show the rejection, the fix, and the
passing rerun.

## Follow-ups and debt

- Parked scope from the `release-manager` cut list, each with its add-back trigger.
- Deferred P2/P3 audit findings, each with a concrete revisit trigger.
- Any environment or infrastructure reconciliation still required.
- Anything verified only on a non-production target that still needs production parity.

## Decision log

Attach one line per autonomous call in this format:

`decision · why · how to reverse it`

## Merge-ready interlock receipt

Paste the literal `MERGE-READY INTERLOCK: PASS` line and JSON receipt emitted by
`validate-evidence.mjs --claim-merge-ready`. Without it, label the result
`implementation complete; conductor closeout pending`, not merge-ready.
