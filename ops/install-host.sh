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
write_env_file_if_needed
load_env_file_overrides
install_service_file
build_app
restart_service
wait_for_health

log "installed ${APP_NAME}"
log "env file: ${ENV_FILE}"
log "service: systemctl status ${APP_NAME}"
log "external Caddy snippets: ${APP_DIR}/ops/caddy/caddy-map-dashboard.http.caddy, ${APP_DIR}/ops/caddy/caddy-map-dashboard.https.caddy, and ${APP_DIR}/ops/caddy/caddy-map-dashboard.https-public.caddy"
