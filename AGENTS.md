# AGENTS.md - Lenny project wiring

This repo vendors a portable skill stack under `skills/`. Any coding agent
reading this file (Codex, zcode, Claude Code, etc.) should treat those skills as
executable process documents and invoke them at the moments named below.

## Skills

| Skill | File | Invoke when |
|---|---|---|
| setup-lenny | `skills/setup-lenny/SKILL.md` | user says “set up Lenny”; safely detects this repository and writes `.lenny/profile.md` |
| ship-conductor | `skills/ship-conductor/SKILL.md` | user says "conduct this plan"; drives plan to a merge-ready branch and STOPS before PR or merge |
| outcome-lock | `skills/outcome-lock/SKILL.md` | before a conducted run; freezes the user-visible outcome and completion criteria |
| grill-me | `skills/grill-me/SKILL.md` | before building: interrogate the plan one question at a time until shared understanding |
| first-principles | `skills/first-principles/SKILL.md` | always: no claim about reality without a verification path |
| elon-first-principles | `skills/elon-first-principles/SKILL.md` | scoping: delete relentlessly, park with concrete triggers |
| garcia | `skills/garcia/SKILL.md` | explicit "garcia" invocation: full-autonomy finish mode with hard rails |
| claudes-gamble | `skills/claudes-gamble/SKILL.md` | genuine design forks: adversarial multi-perspective panel |
| karpathy | `skills/karpathy/SKILL.md` | verification: run/measure it instead of reasoning about it |
| release-manager | `skills/release-manager/SKILL.md` | ship cutoff: freeze line, cut list with add-back triggers |

Read a skill file in full before applying it. Skills compose: ship-conductor is
the score and invokes the others at its phase gates.

## Conductor

The `ship-conductor` skill reads this section:

- **Councils:** for documentation, onboarding, or installation changes, convene
  stranger-installability / reference-integrity / safety-rails seats. For the
  evidence validator, convene correctness / failure-modes / portability seats.
  Otherwise use the default Software Implementation Council at
  `skills/council/references/software-implementation-council.md`.
- **Verification build:** `npm run check`.
- **Merge policy:** branches and PRs only; the human opens the PR and merges.
- **Domain rails:** never publish a repository or package, expose credentials,
  include private/internal material, or perform another outward-facing action
  without explicit human approval.

## Conventions for agents in this repo

- Commit surgically: stage only files you created/modified; verify staging
  before every commit.
- Never merge, force-push, or rewrite shared history; the human does that.
- Never print, commit, or echo credentials. Env references only.
- Long-running work keeps `CONDUCTOR-RUN.md` updated on disk (see the
  ship-conductor skill) so any session can resume after context loss.
- `lennytools/lenny` is the canonical public core. Person- and company-specific
  councils or skills are optional private overlays, never public defaults.
