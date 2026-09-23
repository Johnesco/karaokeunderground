#!/usr/bin/env bash
#
# setup-labels.sh — Create the sdlc-baseline label set for a GitHub repository.
#
# Usage:
#   ./scripts/setup-labels.sh                  # uses current repo
#   ./scripts/setup-labels.sh owner/repo       # targets a specific repo
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated
#   - Repository owner or admin permissions
#
# Options:
#   --clean    Remove GitHub's default labels before creating new ones
#   --dry-run  Print commands without executing them
#

set -euo pipefail

REPO_FLAG=""
DRY_RUN=false
CLEAN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --clean)   CLEAN=true ;;
    -*)        echo "Unknown option: $arg"; exit 1 ;;
    *)         REPO_FLAG="--repo $arg" ;;
  esac
done

run() {
  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] $*"
  else
    echo "Running: $*"
    eval "$@"
  fi
}

# ── Remove GitHub default labels ──────────────────────────────────────

if [ "$CLEAN" = true ]; then
  echo ""
  echo "=== Removing default labels ==="
  echo ""

  DEFAULT_LABELS=(
    "enhancement"
    "good first issue"
    "help wanted"
    "invalid"
    "question"
    "wontfix"
    "duplicate"
    "documentation"
  )

  for label in "${DEFAULT_LABELS[@]}"; do
    run gh label delete "\"$label\"" --yes $REPO_FLAG 2>/dev/null || echo "  (not found: $label)"
  done
fi

# ── Type labels ───────────────────────────────────────────────────────

echo ""
echo "=== Creating type labels ==="
echo ""

run gh label create "feature"  --color "1d76db" --description "\"New functionality or enhancement\""     --force $REPO_FLAG
run gh label create "bug"      --color "d73a4a" --description "\"Something isn't working correctly\""     --force $REPO_FLAG
run gh label create "docs"     --color "0075ca" --description "\"Documentation-only changes\""            --force $REPO_FLAG
run gh label create "task"     --color "e4e669" --description "\"Refactors, dependencies, tooling, infrastructure\"" --force $REPO_FLAG
run gh label create "spike"    --color "c29cf0" --description "\"Research, investigation, or proof-of-concept\""     --force $REPO_FLAG

# ── Area labels ───────────────────────────────────────────────────────

echo ""
echo "=== Creating area labels ==="
echo ""

run gh label create "area:frontend" --color "c5def5" --description "\"UI components, views, styles\""     --force $REPO_FLAG
run gh label create "area:backend"  --color "bfdadc" --description "\"Server, API, database\""            --force $REPO_FLAG
run gh label create "area:data"     --color "d4c5f9" --description "\"Data model, schema, migrations\""   --force $REPO_FLAG
run gh label create "area:docs"     --color "fef2c0" --description "\"Documentation files\""              --force $REPO_FLAG
run gh label create "area:infra"    --color "f9d0c4" --description "\"CI/CD, deployment, tooling\""       --force $REPO_FLAG
run gh label create "area:testing"  --color "e6e6e6" --description "\"Tests, test infrastructure\""       --force $REPO_FLAG
run gh label create "area:design"   --color "fbca04" --description "\"UI/UX design, styling\""            --force $REPO_FLAG

# ── Priority labels ──────────────────────────────────────────────────

echo ""
echo "=== Creating priority labels ==="
echo ""

run gh label create "priority:high" --color "b60205" --description "\"Must be addressed soon\""           --force $REPO_FLAG
run gh label create "priority:low"  --color "c2e0c6" --description "\"Nice to have, no urgency\""         --force $REPO_FLAG

# ── Resolution labels ────────────────────────────────────────────────

echo ""
echo "=== Creating resolution labels ==="
echo ""

run gh label create "resolution:wontfix"           --color "d1d5db" --description "\"Deliberately declined by PO\""                        --force $REPO_FLAG
run gh label create "resolution:duplicate"         --color "d1d5db" --description "\"Already covered by another issue\""                   --force $REPO_FLAG
run gh label create "resolution:cannot-reproduce"  --color "d1d5db" --description "\"Bug can't be replicated\""                            --force $REPO_FLAG
run gh label create "resolution:by-design"         --color "d1d5db" --description "\"Reported behavior is intentional, not a bug\""        --force $REPO_FLAG
run gh label create "resolution:stale"             --color "d1d5db" --description "\"Issue went inactive, no longer relevant\""             --force $REPO_FLAG
run gh label create "resolution:superseded"        --color "d1d5db" --description "\"Replaced by a different ticket or approach\""          --force $REPO_FLAG

# ── Done ──────────────────────────────────────────────────────────────

echo ""
echo "=== Done ==="
echo ""
echo "Created 20 labels (5 type + 7 area + 2 priority + 6 resolution)."
echo ""
echo "Customize area labels for your project — see docs/labels.md for guidance."
