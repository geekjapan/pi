#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKIP_CHECK=false
SKIP_E2E=false
FORCE=false

while [[ $# -gt 0 ]]; do
	case "$1" in
		--skip-check)
			SKIP_CHECK=true
			shift
			;;
		--skip-e2e)
			SKIP_E2E=true
			shift
			;;
		--force)
			FORCE=true
			shift
			;;
		*)
			echo "ERROR: unknown option: $1" >&2
			exit 1
			;;
	esac
done

if ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --cached --quiet; then
	echo "ERROR: working tree has uncommitted changes" >&2
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "ERROR: Node.js >= 22 is required" >&2
	exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
	echo "ERROR: Node.js >= 22 is required (found $(node --version))" >&2
	exit 1
fi

PACKAGE_NAME="$(node -p "require('$REPO_ROOT/package.json').name")"
if [[ "$PACKAGE_NAME" != "pi-monorepo" ]]; then
	echo "ERROR: run this script from the pi-monorepo repository" >&2
	exit 1
fi

COMMIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short=12 HEAD)"
COMMIT_FULL="$(git -C "$REPO_ROOT" rev-parse HEAD)"
BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
DOGFOOD_ROOT="${DOGFOOD_ROOT:-$HOME/opt/pi-dogfood}"
RELEASE_DIR="$DOGFOOD_ROOT/releases/$COMMIT_SHA"
CURRENT_LINK="$DOGFOOD_ROOT/current"

if [[ -e "$RELEASE_DIR" ]]; then
	if [[ "$FORCE" != "true" ]]; then
		echo "Already deployed: $COMMIT_SHA"
		exit 0
	fi
	rm -rf "$RELEASE_DIR"
fi

# local-release refuses an existing --out directory.
STAGING_PARENT="$(mktemp -d)"
STAGING="$STAGING_PARENT/release"
trap 'rm -rf "$STAGING_PARENT"' EXIT

LOCAL_RELEASE_ARGS=(scripts/local-release.mjs --out "$STAGING" --skip-bun-install)
if [[ "$SKIP_CHECK" == "true" ]]; then
	LOCAL_RELEASE_ARGS+=(--skip-check)
fi

cd "$REPO_ROOT"
node "${LOCAL_RELEASE_ARGS[@]}"

if [[ ! -x "$STAGING/node/pi" ]]; then
	echo "ERROR: local release did not create $STAGING/node/pi" >&2
	exit 1
fi

if [[ "$SKIP_E2E" != "true" ]]; then
	if ! node "$REPO_ROOT/scripts/e2e/run-e2e.mjs" --binary "$STAGING/node/pi" --critical; then
		echo "E2E gate FAILED. Deploy aborted." >&2
		exit 1
	fi
fi

mkdir -p "$DOGFOOD_ROOT/releases"
mv "$STAGING/node" "$RELEASE_DIR"

cat > "$RELEASE_DIR/.deploy-info" <<INFO
COMMIT=$COMMIT_FULL
DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BRANCH=$BRANCH
INFO

ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

echo "Deployed Pi dogfood:"
echo "  Commit:  $COMMIT_FULL"
echo "  Branch:  $BRANCH"
echo "  Release: $RELEASE_DIR/"
echo "  Current: $CURRENT_LINK -> $RELEASE_DIR/"
echo "  Binary:  $CURRENT_LINK/pi"
