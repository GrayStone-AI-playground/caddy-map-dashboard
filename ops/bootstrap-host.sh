#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-caddy-map-dashboard}"
BOOTSTRAP_REPO_URL="${BOOTSTRAP_REPO_URL:-https://github.com/GrayStone-AI-playground/caddy-map-dashboard.git}"
BOOTSTRAP_REF="${BOOTSTRAP_REF:-main}"
BOOTSTRAP_ROOT="${BOOTSTRAP_ROOT:-/usr/local/src/${APP_NAME}-src}"

if [[ "${EUID}" -ne 0 ]]; then
  printf '[%s] ERROR: run this script as root or with sudo\n' "$APP_NAME" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git rsync

if [[ -d "${BOOTSTRAP_ROOT}/.git" ]]; then
  git -C "$BOOTSTRAP_ROOT" fetch --depth 1 origin "$BOOTSTRAP_REF"
  git -C "$BOOTSTRAP_ROOT" checkout -B "$BOOTSTRAP_REF" FETCH_HEAD
else
  rm -rf "$BOOTSTRAP_ROOT"
  git clone --depth 1 --branch "$BOOTSTRAP_REF" "$BOOTSTRAP_REPO_URL" "$BOOTSTRAP_ROOT"
fi

cd "$BOOTSTRAP_ROOT"
./ops/install-host.sh
