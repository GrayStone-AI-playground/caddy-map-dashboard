#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$REPO_ROOT/ops/lib/common.sh"

chmod +x "$REPO_ROOT/ops/prepare-standalone.sh"

require_root
require_supported_os
install_base_packages
ensure_node
ensure_corepack
ensure_service_user
sync_repo
load_env_file_overrides
install_service_file
build_app
restart_service
wait_for_health

log "updated ${APP_NAME}"
