# Lenny

**The open orchestration layer that turns your AI coding agent into a software factory for implementation.**

You hand Lenny a plan. It drives the whole thing to a merge-ready branch:
ground-truth → branch → build in slices → adversarial council gates → ship cutoff
→ green gate → two independent audits → a done-council → **STOP at merge-ready.**
You review and merge. Lenny never opens the PR and never merges; the irreversible
calls stay yours.

It is not an editor and not a runtime. It is **config your agent reads**: a set
of markdown skills that run inside the harness you already use, with the model and
subscription you already pay for.

- Site: [lenny.tools](https://lenny.tools)
- Demo: [a council gate that catches a real defect](DEMO.md)
- Verified first on Codex. Claude Code and GLM ports follow.
- License: MIT

## Why

One model's single pass has one set of blind spots, no memory of what broke last
time, and no gate between "it wrote code" and "the code is right." Lenny adds the
missing process: reality is verified before code is written, reviews actually gate
instead of decorate, "done" is a green fact not a vibe, and a human makes the
irreversible calls. Same idea a software factory has always chased; now it runs on
top of your agent instead of a closed platform.

## Install

Requires Git and Node.js 18 or newer. Node only runs the evidence checker;
Lenny itself is still instructions, not a service or agent runtime.

Copy the skill contents into your project, then add the Lenny instructions:

```bash
# get Lenny, then run the remaining commands from your project root
(
  LENNY_SOURCE_DIR="$(mktemp -d)" || exit 1
  git clone https://github.com/lennytools/lenny.git "$LENNY_SOURCE_DIR" || exit 1
  if [ -L skills ] || { [ -e skills ] && [ ! -d skills ]; }; then
    echo "skills exists but is not a project directory; stop and inspect it." >&2
    exit 1
  fi
  if [ -e AGENTS.md ] || [ -L AGENTS.md ]; then
    echo "AGENTS.md exists; stop and merge Lenny's sections manually." >&2
    exit 1
  fi
  mkdir -p skills || exit 1
  for source_skill in "$LENNY_SOURCE_DIR"/skills/*; do
    skill_name="$(basename "$source_skill")"
    if [ -e "skills/$skill_name" ] || [ -L "skills/$skill_name" ]; then
      echo "skills/$skill_name exists; stop and merge it manually." >&2
      exit 1
    fi
  done
  cp -R "$LENNY_SOURCE_DIR/skills/." ./skills/ || exit 1
  cp "$LENNY_SOURCE_DIR/AGENTS.md" ./AGENTS.md || exit 1
)
```

Codex reads `AGENTS.md` natively. Edit its `## Conductor` section for your
project. If your project already has an `AGENTS.md`, the quickstart stops before
changing the project. Copy only non-colliding skills, then merge Lenny's Skills,
Conductor, and agent-convention sections into the existing file.

## Use

1. Draft a plan, or let the agent draft one from your intent.
2. `grill-me`: the agent interrogates the plan until you share an understanding.
3. Say **"conduct this plan."** `ship-conductor` drives it to a merge-ready branch
   and stops.
4. Progress lives in `CONDUCTOR-RUN.md` on disk. Peek any time; it also makes
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

## The non-negotiables baked in

- **STOP at merge-ready.** Push the branch, never open the PR, never merge, never
  force-push shared history. The human decides.
- **Councils gate, they do not decorate.** A blocker halts the run.
- **"Done" is a green check, not a claim.** Verification before completion.
- **Findings are hypotheses** validated against the code before they gate.
- **Config, not a runtime.** Lenny is instructions your agent reads. That is what
  lets it run in any harness.

## Model-agnostic, and better multi-model

Plug in your own model and subscription. Lenny runs across harnesses today, and it
is multi-model on purpose: it can build with one vendor and have a *different*
vendor audit the work, so cross-vendor independence is a built-in quality feature,
not a constraint. No lock-in; it improves as your models do.

## Roadmap

This repo is the open layer: a plan to merge-ready. The north star is the
**self-driving software factory**: you give it a destination (the app you want),
it drives the full lifecycle, ships, and stays on to monitor and auto-fix. That is
the commercial product built on this open layer. See `lenny.tools`.

## Contributing

Bring a skill, a conductor, a council pattern, or a harness port. Skills are
markdown with frontmatter; keep them portable (config the agent reads, never a
runtime it executes).
