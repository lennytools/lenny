# Personalizing Lenny

Lenny separates the public orchestration system from the methods that belong to
one person, company or domain.

```text
.lenny/core/       versioned public Lenny; replaced on update
.lenny/profile.md  verified facts and policy for this repository
.lenny/skills/     project-owned skills; preserved on update
.lenny/councils/   project-owned model councils; preserved on update
.lenny/evidence/   completed-run evidence; preserved on update
.lenny/runs/       active run state; preserved on update
```

Do not edit `.lenny/core`. Say **“Set up my skills”** in Codex. Lenny will use
the setup skill to inventory the repository, ask what recurring decision you
want to improve and create the smallest project-owned skill or council.

## Council design rule

Begin with the decision, not famous names. Three non-overlapping seats are the
default because they usually capture independent failure modes without wasting
model calls. Each seat must have:

- one question it alone owns;
- evidence it must inspect;
- a narrow blocking trigger;
- a replacement condition if it stops adding information.

Seats reason blind before cross-critique. Consensus never erases surviving
dissent.

## Publishing personal packs

Project overlays are private by default. Publish one only after removing private
paths, company facts, credentials, personal defaults and vendor-specific claims.
The public Lenny core never silently adopts a project overlay.
