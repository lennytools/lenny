---
name: gbrain-capture
description: Capture durable knowledge into GBrain (a portable memory layer at ~/.gbrain, independent of any coding harness) via the `gbrain` CLI. Use when the user says "G-Brain Capture", "GBrain capture", "remember this in GBrain", "save this to my brain", "capture this lesson/decision/failure mode", or asks to preserve project memory in a substrate that plugs in anywhere.
---

# GBrain Capture

GBrain is a **portable memory layer** at `~/.gbrain`, independent of any coding harness and pluggable into any agent or tool. Capture durable knowledge here; it is a memory layer, **not proof**. Always verify live files and tests before acting on a recalled memory later.

## Step 0: PATH
`gbrain` is a `bun` script and may not be on a coding harness's default PATH. **Prefix every gbrain command with:**
```bash
export PATH="$HOME/.bun/bin:$PATH"
```
Verify: `export PATH="$HOME/.bun/bin:$PATH"; which bun gbrain` → both should resolve under `~/.bun/bin`. If not, stop and tell the user GBrain/bun isn't on PATH.

## Capture workflow
1. **Pick the source** (a namespace):
   - `--source example-project` for a named project.
   - the source the user names; omit `--source` for global/non-project memory.
   - If the source does not exist, the CLI reports the available sources. Create it once with `gbrain sources add <name>`; it is then searched only when named via `--source`.
2. **Capture a concise packet** (`--json`, `--type note`):
```bash
export PATH="$HOME/.bun/bin:$PATH"
gbrain capture --json --type note --source <source> --stdin <<'PKT'
Title: <short durable title>
Project: <repo/project if known>
Date: <YYYY-MM-DD>

Context:
<what happened>

Decision / Lesson:
<what should be remembered>

Failure Modes:
<what went wrong / what to watch for>

Verification:
<commands, files, tests, commits, evidence from this session>
PKT
echo "exit=$?"
```
3. **Don't claim success until exit 0.** Report the returned `slug` / JSON id.

## What to capture (durable, not noise)
- Decisions + the reason they were made.
- Failure modes + how to detect/prevent them.
- Verification criteria and known data-quality risks.
- Shipping summaries with verification commands.
- Non-obvious project conventions; skill combinations that worked.
- **A correction the user gives twice.** If the same preference or correction recurs across turns or runs, capture it when you notice the second occurrence. Recurrence is the durable signal. This mirrors the `bayesian` repetition trigger; capture it here and draft the guard there.
- **Do NOT capture** secrets/credentials, full private logs, or large raw dumps unless the user explicitly asks.

## Retrieval (before work, treat as leads and verify afterward)
```bash
export PATH="$HOME/.bun/bin:$PATH"
gbrain query "<question>" --source-id <source> --adaptive-return
```

## Notes
- `gbrain sources list` shows registered namespaces (`default` is federated; named sources are searched only when specified).
- Mirror major learnings here and in the relevant project skill so they persist both in-tool and in the portable layer.
