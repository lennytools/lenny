# Lenny Codex Public Readiness Plan

## Frozen outcome

A stranger can install Lenny into a non-empty Codex repository, say “set up
Lenny,” receive a safe project profile and three-seat implementation council,
run diagnostics, then conduct one small plan to a verified merge-ready branch.

## Product boundary

Lenny is an orchestration layer for software implementation. It turns an intent
or plan into a tested, reviewed, evidence-bound, merge-ready branch. It does not
deploy, operate production, monitor services, open pull requests, merge branches
or replace the coding-agent host.

## Required release slices

1. **Canonical distribution**
   - `lennytools/lenny` is the public source of truth.
   - Semantic-version tags are immutable install sources.
   - Personal and company-specific skills stay outside the public core.
2. **Safe Codex installation**
   - One documented install command.
   - Existing `AGENTS.md`, `.lenny/` and unrelated skills are preserved.
   - Install is idempotent, version-pinned, auditable and reversible.
3. **Conversational setup**
   - A `setup-lenny` skill detects repository facts and writes
     `.lenny/profile.md`.
   - It installs a three-seat software implementation council.
   - It asks only questions that cannot be answered from the repository.
4. **Doctor**
   - A deterministic diagnostic reports installation, profile, repository,
     commands, Codex routing and evidence-validator health.
5. **Risk-adaptive conduct**
   - Standard work uses the smallest defensible council and audit process.
   - High-stakes work automatically retains the full evidence and review gates.
6. **Automated proof**
   - Unit tests cover merge, detection, idempotency, rollback and diagnostics.
   - An integration fixture starts non-empty, installs Lenny, configures it and
     proves the complete Codex-facing setup contract.
   - GitHub Actions runs the supported matrix.
7. **Release discipline**
   - `VERSION`, changelog, compatibility policy, release checklist and update
     path are present and tested.

## Acceptance checks

- Existing project files are byte-identical outside explicit managed blocks.
- Reinstalling the same version produces no diff.
- A failed install leaves the target byte-identical.
- `lenny doctor` exits nonzero with actionable findings and zero when healthy.
- The installed `AGENTS.md` routes “set up Lenny” and “conduct this plan.”
- The generated profile records observed commands without inventing them.
- The default council contains contract/correctness, failure/security and
  simplicity/maintainability seats.
- Standard and high-stakes policy selection is deterministic and tested.
- CI, clean install and existing-project integration checks pass.
- A real temporary repository survives install, setup, refresh and uninstall.

## Fast follow

- Claude Code support.
- Zcode support.
- Private personal council/profile packages.
- Third-party domain packs.
- Deployment, DevOps, monitoring and auto-merge.
