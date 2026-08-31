# Installation Design Benchmark

Lenny’s installer follows the strongest parts of established, widely adopted
developer tools while adding repository-preservation guarantees required by an
agent orchestration system.

| Reference | Adopted behavior | Lenny application |
|---|---|---|
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Initialize an existing project, inspect first, keep configuration local | Install into a non-empty repository and generate a repository-grounded profile |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | Versioned standalone installer, explicit update path, many verification options | Pin every stable install to a Git tag and rerun the same installer to update |
| [nvm](https://github.com/nvm-sh/nvm) | One-command bootstrap with environment overrides and verification guidance | One command, `LENNY_SOURCE_DIR` for local/CI use and a clear Doctor command |
| [Oh My Zsh](https://github.com/ohmyzsh/ohmyzsh) | Unattended mode, customizable source and deliberate handling of existing config | Noninteractive install, source override and managed-block preservation |

## Lenny-specific bar

- Own only `.lenny/core` and one visibly marked `AGENTS.md` block.
- Preserve unrelated files byte-for-byte.
- Refuse ambiguous markers and symlink targets.
- Stage before mutation and restore previous bytes after failure.
- Make reinstall idempotent.
- Keep user profile, evidence and run history through update and uninstall.
- End installation with one memorable instruction: **“Set up Lenny.”**
