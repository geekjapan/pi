#!/usr/bin/env bash
set -euo pipefail

DOGFOOD_ROOT="${DOGFOOD_ROOT:-$HOME/opt/pi-dogfood}"
CURRENT_LINK="$DOGFOOD_ROOT/current"
RELEASES_DIR="$DOGFOOD_ROOT/releases"

display_path() {
	local path="$1"
	local home_prefix="$HOME/"

	case "$path" in
		"$HOME")
			printf '~\n'
			;;
		"$HOME"/*)
			printf '~/%s\n' "${path#$home_prefix}"
			;;
		*)
			printf '%s\n' "$path"
			;;
	esac
}

absolute_dir() {
	local dir="$1"

	[ -d "$dir" ] || return 1
	(cd "$dir" && pwd -P)
}

resolve_link_target_dir() {
	local link="$1"
	local target

	target="$(readlink "$link")" || return 1
	case "$target" in
		/*) ;;
		*) target="$(dirname "$link")/$target" ;;
	esac

	absolute_dir "$target"
}

info_value_raw() {
	local dir="$1"
	local key="$2"
	local info="$dir/.deploy-info"

	[ -f "$info" ] || return 0

	(
		COMMIT=
		DATE=
		BRANCH=
		. "$info"
		case "$key" in
			COMMIT) printf '%s\n' "$COMMIT" ;;
			DATE) printf '%s\n' "$DATE" ;;
			BRANCH) printf '%s\n' "$BRANCH" ;;
		esac
	)
}

info_value() {
	local value

	value="$(info_value_raw "$1" "$2")"
	if [ -n "$value" ]; then
		printf '%s\n' "$value"
	else
		printf 'unknown\n'
	fi
}

list_release_dirs_by_date() {
	[ -d "$RELEASES_DIR" ] || return 0

	for release in "$RELEASES_DIR"/*; do
		[ -d "$release" ] || continue
		printf '%s\t%s\n' "$(info_value_raw "$release" DATE)" "$release"
	done | sort -r | cut -f2-
}

release_ref() {
	local dir="$1"
	local sha

	sha="$(basename "$dir")"
	printf 'releases/%s/\n' "$sha"
}

release_size() {
	local dir="$1"
	local size

	size="$(du -sh "$dir" 2>/dev/null | cut -f1)"
	if [ -n "$size" ]; then
		printf '%s\n' "$size"
	else
		printf 'unknown\n'
	fi
}

echo "Pi Dogfood Status"

if [ ! -L "$CURRENT_LINK" ]; then
	echo "  Not deployed"
	echo
	echo "  Run: bash scripts/dogfood/deploy.sh"
	exit 0
fi

CURRENT_RELEASE="$(resolve_link_target_dir "$CURRENT_LINK")" || {
	echo "  Not deployed"
	echo
	echo "  Run: bash scripts/dogfood/deploy.sh"
	exit 0
}

VERSION="$("$CURRENT_LINK/pi" --version 2>/dev/null || true)"
[ -n "$VERSION" ] || VERSION="unknown"

COMMIT="$(info_value "$CURRENT_RELEASE" COMMIT)"
DATE="$(info_value "$CURRENT_RELEASE" DATE)"
BRANCH="$(info_value "$CURRENT_RELEASE" BRANCH)"

echo "  Version: $VERSION"
echo "  Commit:  $COMMIT ($BRANCH)"
echo "  Date:    $DATE"
echo "  Path:    $(display_path "$CURRENT_LINK") -> $(release_ref "$CURRENT_RELEASE")"
echo
echo "Releases:"

while IFS= read -r release; do
	[ -n "$release" ] || continue
	release_abs="$(absolute_dir "$release")" || continue
	mark=" "
	if [ "$release_abs" = "$CURRENT_RELEASE" ]; then
		mark="*"
	fi

	printf '  %s %-12s  %-20s  %-8s  %s\n' \
		"$mark" \
		"$(basename "$release")" \
		"$(info_value "$release" DATE)" \
		"$(info_value "$release" BRANCH)" \
		"$(release_size "$release")"
done <<EOF
$(list_release_dirs_by_date)
EOF
