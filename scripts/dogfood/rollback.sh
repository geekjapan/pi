#!/usr/bin/env bash
set -euo pipefail

DOGFOOD_ROOT="${DOGFOOD_ROOT:-$HOME/opt/pi-dogfood}"
CURRENT_LINK="$DOGFOOD_ROOT/current"
RELEASES_DIR="$DOGFOOD_ROOT/releases"
TARGET="${1:-previous}"

if [ "$#" -gt 1 ]; then
	echo "Usage: rollback.sh [previous|sha-prefix]" >&2
	exit 1
fi

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
		[ -f "$release/.deploy-info" ] || continue
		printf '%s\t%s\n' "$(info_value_raw "$release" DATE)" "$release"
	done | sort -r | cut -f2-
}

release_ref() {
	local dir="$1"
	local sha

	sha="$(basename "$dir")"
	printf 'releases/%s/\n' "$sha"
}

if [ ! -L "$CURRENT_LINK" ]; then
	echo "No active deployment" >&2
	exit 1
fi

CURRENT_RELEASE="$(resolve_link_target_dir "$CURRENT_LINK")" || {
	echo "No active deployment" >&2
	exit 1
}
CURRENT_SHA="$(basename "$CURRENT_RELEASE")"

TARGET_RELEASE=
if [ "$TARGET" = "previous" ]; then
	release_count=0
	found_current=0
	while IFS= read -r release; do
		[ -n "$release" ] || continue
		release_count=$((release_count + 1))
		release_abs="$(absolute_dir "$release")" || continue

		if [ "$found_current" -eq 1 ]; then
			TARGET_RELEASE="$release_abs"
			break
		fi

		if [ "$release_abs" = "$CURRENT_RELEASE" ]; then
			found_current=1
		fi
	done <<EOF
$(list_release_dirs_by_date)
EOF

	if [ "$release_count" -le 1 ] || [ -z "$TARGET_RELEASE" ]; then
		echo "No previous release available" >&2
		exit 1
	fi
else
	matches=()
	if [ -d "$RELEASES_DIR" ]; then
		for release in "$RELEASES_DIR"/"$TARGET"*; do
			[ -d "$release" ] || continue
			matches+=("$release")
		done
	fi

	if [ "${#matches[@]}" -eq 0 ]; then
		echo "No matching release found" >&2
		exit 1
	fi

	if [ "${#matches[@]}" -gt 1 ]; then
		echo "Ambiguous prefix, matches:" >&2
		for release in "${matches[@]}"; do
			echo "  $(basename "$release")" >&2
		done
		exit 1
	fi

	TARGET_RELEASE="$(absolute_dir "${matches[0]}")"
fi

TARGET_SHA="$(basename "$TARGET_RELEASE")"
if [ "$TARGET_RELEASE" = "$CURRENT_RELEASE" ]; then
	echo "Already on this release: $TARGET_SHA"
	exit 0
fi

if [ ! -e "$TARGET_RELEASE/pi" ]; then
	echo "Invalid release: pi binary not found" >&2
	exit 1
fi

ln -sfn "$TARGET_RELEASE" "$CURRENT_LINK"

echo "Rolled back:"
echo "  From: $CURRENT_SHA ($(info_value "$CURRENT_RELEASE" DATE))"
echo "  To:   $TARGET_SHA ($(info_value "$TARGET_RELEASE" DATE))"
echo "  Current: $(display_path "$CURRENT_LINK") -> $(release_ref "$TARGET_RELEASE")"
