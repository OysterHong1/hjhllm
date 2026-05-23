#!/usr/bin/env bash
set -euo pipefail

REMOTE="${DEPLOY_REMOTE:-s1}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/workspace/hjhllm}"
REF="HEAD"
RUN_REBUILD=1

usage() {
  cat <<'EOF'
Usage: scripts/deploy-release.sh [options]

Export a clean git ref, sync it to the production server, then run the
server-side Docker rebuild/health-check script.

Options:
  --ref <git-ref>          Git ref to deploy. Default: HEAD
  --remote <ssh-alias>     SSH host alias. Default: s1
  --dir <remote-dir>       Remote app directory. Default: /root/workspace/hjhllm
  --sync-only              Sync code but do not run rebuild
  -h, --help               Show this help

Environment overrides:
  DEPLOY_REMOTE            Same as --remote
  DEPLOY_REMOTE_DIR        Same as --dir
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      REF="${2:?--ref requires a value}"
      shift 2
      ;;
    --remote)
      REMOTE="${2:?--remote requires a value}"
      shift 2
      ;;
    --dir)
      REMOTE_DIR="${2:?--dir requires a value}"
      shift 2
      ;;
    --sync-only)
      RUN_REBUILD=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

COMMIT="$(git rev-parse --verify "$REF^{commit}")"
SHORT_COMMIT="$(git rev-parse --short "$COMMIT")"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "==> Exporting $SHORT_COMMIT from $REPO_ROOT"
git archive --format=tar "$COMMIT" | tar -x -C "$TMP_DIR"

echo "==> Syncing clean export to $REMOTE:$REMOTE_DIR"
rsync -az --delete \
  --exclude .git \
  --exclude .env \
  --exclude .data \
  --exclude node_modules \
  --exclude .next \
  "$TMP_DIR"/ "$REMOTE:$REMOTE_DIR/"

if [[ "$RUN_REBUILD" -eq 0 ]]; then
  echo "==> Sync complete; rebuild skipped"
  exit 0
fi

echo "==> Running server rebuild"
ssh "$REMOTE" "APP_DIR='$REMOTE_DIR' '$REMOTE_DIR/scripts/server-rebuild.sh'"
