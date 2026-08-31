# Lenny

**The open orchestration layer that turns your AI coding agent into a software factory for implementation.**

You hand Lenny a plan. It drives the whole thing to a merge-ready branch:
ground-truth → branch → build in slices → adversarial council gates → ship cutoff
→ green gate → risk-matched independent audit → a done-council → **STOP at merge-ready.**
You review and merge. Lenny never opens the PR and never merges; the irreversible
calls stay yours.

It is not an editor and not a runtime. It is **config your agent reads**: a set
of markdown skills that run inside the harness you already use, with the model and
subscription you already pay for.

- Site: [lenny.tools](https://lenny.tools)
- Demo: [a council gate that catches a real defect](DEMO.md)
- Supported host in this release: Codex on macOS and Linux. Other hosts follow.
- License: MIT

## Why

One model's single pass has one set of blind spots, no memory of what broke last
time, and no gate between "it wrote code" and "the code is right." Lenny adds the
missing process: reality is verified before code is written, reviews actually gate
instead of decorate, "done" is a green fact not a vibe, and a human makes the
irreversible calls. Same idea a software factory has always chased; now it runs on
top of your agent instead of a closed platform.

## Install

Requires Git, Node.js 20 or newer and Codex on macOS or Linux. Run this from the
root of an existing or new Git repository:

```bash
curl -fsSL https://raw.githubusercontent.com/lennytools/lenny/v0.1.0/scripts/install.sh | sh
```

The release tag is pinned. If you prefer to inspect downloaded code before
execution:

```bash
curl -fsSLo /tmp/lenny-install.sh \
  https://raw.githubusercontent.com/lennytools/lenny/v0.1.0/scripts/install.sh
less /tmp/lenny-install.sh
sh /tmp/lenny-install.sh --dry-run
sh /tmp/lenny-install.sh
```

The installer owns only `.lenny/core` and one visibly marked block in
`AGENTS.md`. Existing instructions, project skills, `.lenny/profile.md`, evidence
and run history are preserved. Installation is staged, rollback-safe,
idempotent and refuses ambiguous markers or symlink targets.

Now open the repository in Codex and say:

> Set up Lenny.

Lenny detects the stack and verification commands, writes
`.lenny/profile.md`, configures the default three-seat Software Implementation
Council and runs Doctor. Verify at any time:

```bash
node .lenny/core/bin/lenny.mjs doctor
```

Preview an update by rerunning the desired pinned installer with `--dry-run`.
Uninstall only the managed core and routing block with:

```bash
node .lenny/core/bin/lenny.mjs uninstall --dry-run
node .lenny/core/bin/lenny.mjs uninstall
```

## Use

1. Say **“Set up Lenny”** once per repository and review `.lenny/profile.md`.
2. Draft a plan, or let the agent draft one from your intent.
3. `grill-me`: the agent interrogates the plan until you share an understanding.
4. Say **"conduct this plan."** `ship-conductor` drives it to a merge-ready branch
   and stops.
5. Progress lives in `CONDUCTOR-RUN.md` on disk. Peek any time; it also makes
   runs resumable after a lost session.

## What's inside

**Conductors** (the score that drives a run):
- `ship-conductor`: one plan to merge-ready. The core.
- `meta-conductor`: an ordered chain of dependent conductors.
- `fleet-conductor`: many worktrees in parallel.

**Discipline lenses** (invoked at the right phase):
`first-principles`, `elon-first-principles`, `karpathy`, `grill-me`,
`claudes-gamble`, `codebase-design`, `kissinger`, `rumsfeld`, `garcia`,
`release-manager`, `pre-k`.

**Self-improvement + discovery:** `bayesian` (distill run traps into gated,
self-promoting guards), `find-skills` (surface open skills, never auto-install),
`gbrain-capture` (optional durable-memory integration; requires its own CLI).

**The council framework:** `council`, the generic debate/model-council pattern.
You define the seats (for code: correctness / security / simplicity; for your
domain: your lenses). Seats reason blind, then debate to a consensus with a
dissent register. Runs cross-vendor when you have a second model, so one builds
and another audits.

**Setup and outcome integrity:** `setup-lenny` creates the persistent project
profile and runs Doctor. `outcome-lock` prevents an agent or council from
quietly redefining what “done” means.

## Default implementation council

Every new installation starts with three narrow seats:

1. **Contract / correctness:** did the diff deliver the frozen outcome?
2. **Failure / security:** how can it fail, lose data or violate authority?
3. **Simplicity / maintainability:** is it the smallest coherent change?

Standard reversible work uses this council and one independent audit. Work that
touches authentication, secrets, money, custody, destructive persistence,
migrations, production infrastructure or security boundaries automatically
uses the full high-stakes debate and audit path. Tests, build, leak scan, live QA
and the done review remain mandatory in both modes.

## The non-negotiables baked in

- **STOP at merge-ready.** Push the branch, never open the PR, never merge, never
  force-push shared history. The human decides.
- **Councils gate, they do not decorate.** A blocker halts the run.
- **"Done" is a green check, not a claim.** Verification before completion.
- **Findings are hypotheses** validated against the code before they gate.
- **Config, not a runtime.** Lenny is instructions your agent reads. That is what
  lets it run in any harness.

## Codex first, model-flexible by design

This release supports Codex as the driving host. Lenny remains plain instructions
and deterministic support scripts, so it does not depend on one model API. For
high-stakes work it can ask a different authorized vendor to audit the diff, but
cross-vendor availability is never misrepresented.

## Roadmap

This repository has one boundary: intent or plan to a verified merge-ready
software implementation. Codex is first. Claude Code and other host adapters,
personal council packs and domain packs follow after the Codex path is proven.
Deployment, DevOps, production monitoring and auto-merge are not part of this
product boundary.

## Development and releases

Run the complete local gate with `npm run check`. CI runs it on macOS and Linux
across supported Node versions. `VERSION`, `package.json` and `CHANGELOG.md`
must agree before a `v<version>` tag can create a GitHub release. See
[the release contract](docs/RELEASING.md) and
[the install-design benchmark](docs/INSTALL-DESIGN.md). To create your own
skills or councils, read [Personalizing Lenny](docs/CUSTOMIZATION.md) or say
**“Set up my skills”** in Codex.

## Contributing

Bring a skill, a conductor, a council pattern, or a harness port. Skills are
markdown with frontmatter; keep them portable (config the agent reads, never a
runtime it executes).
