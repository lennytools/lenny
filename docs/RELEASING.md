# Releasing Lenny

GitHub `main` is the canonical public source. A protected `v*` tag created from
a reviewed `main` commit is the stable installation source. The release job
fails when the tagged commit is not reachable from canonical `main`. Enable
GitHub immutable releases and a tag ruleset that forbids updating or deleting
`v*` before publishing v0.1.0. Never advertise a mutable branch as stable.

## Compatibility contract

- Semantic versioning governs the installed core.
- Patch releases repair behavior without changing the profile schema.
- Minor releases may add backward-compatible skills, checks or profile fields.
- Major releases may change managed paths, profile schema or required host
  behavior and must include a migration guide.
- `.lenny/profile.md`, `.lenny/evidence/` and `.lenny/runs/` are user-owned and
  preserved across updates and uninstall.
- `.lenny/core/` and the marked `AGENTS.md` block are Lenny-managed.

## Release checklist

1. Update `VERSION`, `package.json` and `CHANGELOG.md` together.
2. Run `npm run check` on macOS or Linux.
3. Exercise the version-pinned installer in a fresh non-empty repository.
4. Confirm reinstall is byte-idempotent and injected failure rolls back.
5. Confirm no personal council, private path, credential or company-specific
   artifact appears in the release diff.
6. Merge through human review.
7. Confirm immutable releases and the `v*` tag ruleset are enabled, then create
   and push `v<version>` from the reviewed `main` commit.
8. GitHub Actions reruns the complete matrix and creates the GitHub release.
9. Install once from the published tag and run Lenny Doctor.

## Updating a project

Rerun the version-pinned installer with the desired tag. It atomically replaces
only `.lenny/core` and the marked `AGENTS.md` routing block:

```bash
curl -fsSL https://raw.githubusercontent.com/lennytools/lenny/v0.1.0/scripts/install.sh | sh
```

Preview first with `--dry-run`:

```bash
curl -fsSL https://raw.githubusercontent.com/lennytools/lenny/v0.1.0/scripts/install.sh \
  | sh -s -- --dry-run
```

Core updates never overwrite `.lenny/profile.md`, evidence or run history.
