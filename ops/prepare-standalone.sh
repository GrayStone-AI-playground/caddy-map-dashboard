#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STANDALONE_ROOT="${REPO_ROOT}/.next/standalone"
STATIC_SRC="${REPO_ROOT}/.next/static"
STATIC_DEST="${STANDALONE_ROOT}/.next/static"
PUBLIC_SRC="${REPO_ROOT}/public"
PUBLIC_DEST="${STANDALONE_ROOT}/public"

if [[ ! -d "$STANDALONE_ROOT" ]]; then
  printf '[prepare-standalone] missing standalone output at %s\n' "$STANDALONE_ROOT" >&2
  exit 1
fi

copy_tree() {
  local src="$1"
  local dest="$2"

  rm -rf "$dest"
  mkdir -p "$dest"
  cp -a "$src"/. "$dest"/
}

copy_tree "$STATIC_SRC" "$STATIC_DEST"

if [[ -d "$PUBLIC_SRC" ]]; then
  copy_tree "$PUBLIC_SRC" "$PUBLIC_DEST"
fi
