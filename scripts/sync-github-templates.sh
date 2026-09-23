#!/usr/bin/env bash
# sync-github-templates.sh
#
# Pull the latest GitHub-tooling-bound files from sdlc-baseline `main` into
# the consuming project. This is the only category of files that MUST be
# vendored (because GitHub's UI reads them from fixed paths in the repo).
#
# Run this script periodically — after sdlc-baseline ships a relevant change
# (see https://github.com/Johnesco/sdlc-baseline/blob/main/CHANGELOG.md).
#
# The script:
#   1. Fetches each tracked file from sdlc-baseline `main`.
#   2. Diffs against the local copy.
#   3. Reports changes.
#   4. Prompts for confirmation before overwriting.
#   5. Does NOT auto-commit. Review the result, then commit yourself.
#
# Usage:
#   bash scripts/sync-github-templates.sh
#
# Optional flags:
#   --dry-run     Report differences without prompting or writing.
#   --check       Exit non-zero if differences exist (useful for CI).

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
UPSTREAM_REPO="Johnesco/sdlc-baseline"
UPSTREAM_BRANCH="main"
UPSTREAM_RAW_BASE="https://raw.githubusercontent.com/${UPSTREAM_REPO}/${UPSTREAM_BRANCH}"

# Files that GitHub's tooling reads from fixed paths.
# Order: source path in upstream → destination path in this project.
# Both paths are relative to the project root.
TRACKED_FILES=(
  ".github/PULL_REQUEST_TEMPLATE.md"
  ".github/ISSUE_TEMPLATE/config.yml"
  ".github/ISSUE_TEMPLATE/feature.yml"
  ".github/ISSUE_TEMPLATE/bug.yml"
  ".github/ISSUE_TEMPLATE/task.yml"
  ".github/ISSUE_TEMPLATE/spike.yml"
  ".github/ISSUE_TEMPLATE/doc.yml"
  "scripts/setup-labels.sh"
)

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
DRY_RUN=0
CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --dry-run)   DRY_RUN=1 ;;
    --check)     CHECK_ONLY=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

fetch_upstream() {
  local path="$1"
  curl -fsSL "${UPSTREAM_RAW_BASE}/${path}"
}

cleanup() {
  rm -rf "$tmpdir"
}

tmpdir=$(mktemp -d)
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo -e "${BLUE}Syncing GitHub templates from ${UPSTREAM_REPO}@${UPSTREAM_BRANCH}${NC}"
echo

changed_files=()
missing_locally=()
fetch_failures=()

for path in "${TRACKED_FILES[@]}"; do
  upstream_tmp="${tmpdir}/$(echo "$path" | tr '/' '_')"

  if ! fetch_upstream "$path" >"$upstream_tmp" 2>/dev/null; then
    fetch_failures+=("$path")
    echo -e "  ${RED}✗${NC} $path  (fetch failed — does it exist upstream?)"
    continue
  fi

  if [[ ! -f "$path" ]]; then
    missing_locally+=("$path")
    echo -e "  ${YELLOW}+${NC} $path  (missing locally — would be added)"
    continue
  fi

  if cmp -s "$upstream_tmp" "$path"; then
    echo -e "  ${GREEN}=${NC} $path  (unchanged)"
  else
    changed_files+=("$path")
    echo -e "  ${YELLOW}≠${NC} $path  (differs — see diff below)"
    echo
    diff -u "$path" "$upstream_tmp" || true
    echo
  fi
done

echo
total_changes=$(( ${#changed_files[@]} + ${#missing_locally[@]} ))

if (( ${#fetch_failures[@]} > 0 )); then
  echo -e "${RED}Warning:${NC} ${#fetch_failures[@]} file(s) could not be fetched from upstream."
fi

if (( total_changes == 0 )); then
  echo -e "${GREEN}All tracked files are in sync with upstream.${NC}"
  exit 0
fi

echo -e "${YELLOW}${total_changes} file(s) differ from upstream.${NC}"

if (( CHECK_ONLY == 1 )); then
  echo "(--check) exiting non-zero to signal divergence."
  exit 1
fi

if (( DRY_RUN == 1 )); then
  echo "(--dry-run) no changes written."
  exit 0
fi

echo
read -r -p "Apply changes? [y/N] " confirm
case "$confirm" in
  y|Y|yes|YES)
    for path in "${changed_files[@]}" "${missing_locally[@]}"; do
      upstream_tmp="${tmpdir}/$(echo "$path" | tr '/' '_')"
      mkdir -p "$(dirname "$path")"
      cp "$upstream_tmp" "$path"
      echo -e "  ${GREEN}✓${NC} updated $path"
    done
    echo
    echo -e "${GREEN}Done.${NC} Review with 'git diff' and commit when satisfied."
    ;;
  *)
    echo "Aborted. No changes written."
    exit 0
    ;;
esac
