#!/bin/sh
set -eu

LENNY_REPOSITORY_URL="${LENNY_REPOSITORY_URL:-https://github.com/lennytools/lenny.git}"
LENNY_VERSION="${LENNY_VERSION:-v0.1.0}"
LENNY_COMMIT="${LENNY_COMMIT:-__LENNY_RELEASE_COMMIT__}"
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
    --commit)
      [ "$#" -ge 2 ] || { echo "--commit requires a full commit SHA" >&2; exit 2; }
      LENNY_COMMIT=$2
      shift 2
      ;;
    --dry-run)
      LENNY_DRY_RUN=1
      shift
      ;;
    --help|-h)
      cat <<'EOF'
Install Lenny into an existing Codex project.

Usage: install.sh [--target PATH] [--version TAG] [--commit SHA] [--dry-run]

Environment:
  LENNY_SOURCE_DIR      Use a local Lenny checkout instead of cloning.
  LENNY_REPOSITORY_URL  Override the canonical repository URL.
  LENNY_VERSION         Release tag (default: v0.1.0).
  LENNY_COMMIT          Immutable 40-character release commit.
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
  case "$LENNY_COMMIT" in
    *[!0-9a-f]*|'') echo "Remote installation requires --commit with the immutable 40-character release SHA." >&2; exit 1 ;;
  esac
  [ "${#LENNY_COMMIT}" -eq 40 ] || {
    echo "Remote installation requires --commit with the immutable 40-character release SHA." >&2
    exit 1
  }
  LENNY_TEMP=$(mktemp -d "${TMPDIR:-/tmp}/lenny-install.XXXXXX")
  mkdir -p "$LENNY_TEMP/source"
  git -C "$LENNY_TEMP/source" init --quiet
  git -C "$LENNY_TEMP/source" remote add origin "$LENNY_REPOSITORY_URL"
  git -C "$LENNY_TEMP/source" fetch --quiet --depth 1 origin "$LENNY_COMMIT" || {
    echo "Could not download immutable Lenny commit $LENNY_COMMIT." >&2
    exit 1
  }
  FETCHED_COMMIT=$(git -C "$LENNY_TEMP/source" rev-parse FETCH_HEAD)
  [ "$FETCHED_COMMIT" = "$LENNY_COMMIT" ] || { echo "Downloaded commit does not match --commit." >&2; exit 1; }
  git -C "$LENNY_TEMP/source" checkout --quiet --detach "$LENNY_COMMIT"
  CHECKED_OUT_COMMIT=$(git -C "$LENNY_TEMP/source" rev-parse HEAD)
  [ "$CHECKED_OUT_COMMIT" = "$LENNY_COMMIT" ] || { echo "Checked-out commit does not match --commit." >&2; exit 1; }
  git -C "$LENNY_TEMP/source" fetch --quiet --depth 1 origin "refs/tags/$LENNY_VERSION:refs/tags/$LENNY_VERSION" || {
    echo "Could not verify release tag $LENNY_VERSION." >&2
    exit 1
  }
  TAG_COMMIT=$(git -C "$LENNY_TEMP/source" rev-parse "$LENNY_VERSION^{commit}")
  [ "$TAG_COMMIT" = "$LENNY_COMMIT" ] || { echo "Release tag does not resolve to --commit." >&2; exit 1; }
  EXPECTED_VERSION=${LENNY_VERSION#v}
  ACTUAL_VERSION=$(sed -n '1p' "$LENNY_TEMP/source/VERSION")
  [ "$ACTUAL_VERSION" = "$EXPECTED_VERSION" ] || { echo "VERSION does not match release tag." >&2; exit 1; }
  LENNY_SOURCE="$LENNY_TEMP/source"
  LENNY_SOURCE_KIND=release
  LENNY_PROVENANCE_COMMIT=$LENNY_COMMIT
else
  LENNY_SOURCE_KIND=local-unverified
  LENNY_PROVENANCE_COMMIT=''
fi

set -- install --source "$LENNY_SOURCE" --target "$LENNY_TARGET" \
  --source-kind "$LENNY_SOURCE_KIND" --repository "$LENNY_REPOSITORY_URL" \
  --version "$LENNY_VERSION" --commit "$LENNY_PROVENANCE_COMMIT"
if [ "${LENNY_DRY_RUN:-0}" = "1" ]; then
  set -- "$@" --dry-run
fi
node "$LENNY_SOURCE/scripts/lenny.mjs" "$@"
