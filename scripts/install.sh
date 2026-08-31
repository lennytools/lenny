#!/bin/sh
set -eu

LENNY_REPOSITORY_URL="${LENNY_REPOSITORY_URL:-https://github.com/lennytools/lenny.git}"
LENNY_VERSION="${LENNY_VERSION:-v0.1.0}"
LENNY_TARGET="${LENNY_TARGET:-$PWD}"
LENNY_SOURCE="${LENNY_SOURCE_DIR:-}"
LENNY_TEMP=""

cleanup() {
  if [ -n "$LENNY_TEMP" ] && [ -d "$LENNY_TEMP" ]; then
    rm -rf -- "$LENNY_TEMP"
  fi
}
trap cleanup EXIT HUP INT TERM

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target)
      [ "$#" -ge 2 ] || { echo "--target requires a path" >&2; exit 2; }
      LENNY_TARGET=$2
      shift 2
      ;;
    --version)
      [ "$#" -ge 2 ] || { echo "--version requires a tag" >&2; exit 2; }
      LENNY_VERSION=$2
      shift 2
      ;;
    --dry-run)
      LENNY_DRY_RUN=1
      shift
      ;;
    --help|-h)
      cat <<'EOF'
Install Lenny into an existing Codex project.

Usage: install.sh [--target PATH] [--version TAG] [--dry-run]

Environment:
  LENNY_SOURCE_DIR      Use a local Lenny checkout instead of cloning.
  LENNY_REPOSITORY_URL  Override the canonical repository URL.
  LENNY_VERSION         Override the release tag (default: v0.1.0).
  LENNY_TARGET          Override the target project (default: current directory).
EOF
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      exit 2
      ;;
  esac
done

command -v node >/dev/null 2>&1 || {
  echo "Lenny requires Node.js 20 or newer. Install Node, then rerun this command." >&2
  exit 1
}
NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])')
[ "$NODE_MAJOR" -ge 20 ] || {
  echo "Lenny requires Node.js 20 or newer; found $(node --version)." >&2
  exit 1
}

if [ -z "$LENNY_SOURCE" ]; then
  command -v git >/dev/null 2>&1 || {
    echo "Lenny requires Git to download the pinned release." >&2
    exit 1
  }
  LENNY_TEMP=$(mktemp -d "${TMPDIR:-/tmp}/lenny-install.XXXXXX")
  git clone --quiet --depth 1 --branch "$LENNY_VERSION" "$LENNY_REPOSITORY_URL" "$LENNY_TEMP/source" || {
    echo "Could not download Lenny $LENNY_VERSION from $LENNY_REPOSITORY_URL." >&2
    exit 1
  }
  LENNY_SOURCE="$LENNY_TEMP/source"
fi

set -- install --source "$LENNY_SOURCE" --target "$LENNY_TARGET"
if [ "${LENNY_DRY_RUN:-0}" = "1" ]; then
  set -- "$@" --dry-run
fi
node "$LENNY_SOURCE/scripts/lenny.mjs" "$@"
