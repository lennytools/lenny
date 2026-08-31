---
name: setup-lenny
description: Configure Lenny safely inside an existing Codex repository. Use when the user says “set up Lenny,” “initialize Lenny,” “configure Lenny for this repo,” or immediately after installation. Detect facts before asking questions, preserve existing instructions and finish with Lenny Doctor.
---

# Set Up Lenny

Set up the project Lenny will actually conduct. The interface is a conversation,
but every claim in the resulting profile must come from inspected repository
state or an explicit user answer.

## Hard rails

- Read the repository’s `AGENTS.md` and any nested instruction files first.
- Never overwrite user-authored instructions. Lenny owns only its marked block
  in `AGENTS.md`, its versioned `.lenny/core` directory and a newly created
  `.lenny/profile.md`.
- Never infer that a command works because its name is conventional. Run it or
  mark it unverified.
- Never inspect, print or copy secret values. Presence may be reported without
  value disclosure.
- Ask no more than three short questions, and ask only when repository evidence
  cannot answer them.

## Setup workflow

1. From the repository root, run:

   ```bash
   node .lenny/core/bin/lenny.mjs setup
   ```

   This detects only high-confidence project facts and creates
   `.lenny/profile.md`. It preserves an existing profile unless the user
   explicitly requests regeneration.

2. Read the generated profile and verify:

   - stack and package manager;
   - exact test, build, lint and typecheck commands;
   - the real live-QA workflow;
   - merge policy and protected branch;
   - project-specific security, data and outward-action rails.

3. Resolve unknowns from the repository first. Inspect package manifests,
   workflow files and existing developer documentation. Ask the user only for
   facts that remain unknowable, normally the live-QA journey, unusual merge
   policy or a material domain rail.

4. Update `.lenny/profile.md` with verified facts. Do not invent commands or
   describe an unrun command as passing.

5. Confirm the default council is present:

   - contract / correctness;
   - failure / security;
   - simplicity / maintainability.

   The canonical definition is
   `.lenny/core/skills/council/references/software-implementation-council.md`.

6. Run the deterministic diagnostic:

   ```bash
   node .lenny/core/bin/lenny.mjs doctor
   ```

   Deep Doctor runs the profile's configured test/build commands and any
   configured lint/typecheck command. Unresolved test, build or live-QA fields
   fail closed; use an explicit `Not applicable — <reason>` only when that gate
   truly does not exist for this repository. Fix failed checks. Warnings must be
   disclosed but do not block when the host capability genuinely cannot be
   observed from the CLI.

## When the user says “set up my skills” or requests a council

Personalization is a project overlay, never an edit to `.lenny/core`.

1. Inventory `.lenny/skills/`, `.lenny/councils/` and the project profile.
2. Ask what recurring decision the user wants help making. Do not begin with
   famous people or personas.
3. Use the generic `council` skill to select the smallest set of non-overlapping
   lenses. Default to three seats. Every seat needs a question, evidence,
   blocker trigger and replacement condition.
4. Write a custom council from
   `.lenny/core/skills/setup-lenny/references/custom-council-template.md` to
   `.lenny/councils/<name>.md` and register its invocation in the profile.
5. Write a custom skill from
   `.lenny/core/skills/setup-lenny/references/custom-skill-template.md` to
   `.lenny/skills/<name>/SKILL.md`. Keep instructions portable and do not add a
   runtime unless the requested capability logically requires one.
6. Add a short routing line to the Lenny-managed `AGENTS.md` block only when the
   user explicitly wants automatic triggering. Otherwise invocation remains
   explicit.
7. Run Doctor and report which files are public core versus project-owned.

Updates and uninstall preserve `.lenny/skills/` and `.lenny/councils/`.

## Finish

Report:

- detected stack and verified commands;
- council and risk policy;
- unresolved facts, if any;
- the exact doctor result;
- the next instruction: **“Conduct this plan.”**

Setup is complete only when Doctor exits 0. A profile with invented or
unverified commands is not complete.
