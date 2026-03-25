#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
APP_NAME="${APP_NAME:-caddy-map-dashboard}"
APP_USER="${APP_USER:-$APP_NAME}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
APP_HOME="${APP_HOME:-/var/lib/$APP_NAME}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/$APP_NAME}"
APP_DIR="${APP_DIR:-$INSTALL_ROOT/app}"
ENV_FILE="${ENV_FILE:-/etc/$APP_NAME.env}"
SERVICE_FILE="${SERVICE_FILE:-/etc/systemd/system/$APP_NAME.service}"
SERVICE_TEMPLATE="${SERVICE_TEMPLATE:-$REPO_ROOT/ops/systemd/$APP_NAME.service.template}"
PNPM_VERSION="${PNPM_VERSION:-10.33.0}"
NODE_MAJOR="${NODE_MAJOR:-22}"
APP_PORT="${APP_PORT:-3211}"
APP_HOSTNAME="${APP_HOSTNAME:-127.0.0.1}"

log() {
  printf '[%s] %s\n' "$APP_NAME" "$*"
}

die() {
  printf '[%s] ERROR: %s\n' "$APP_NAME" "$*" >&2
  exit 1
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "run this script as root or with sudo"
  fi
}

require_supported_os() {
  if [[ ! -r /etc/os-release ]]; then
    die "cannot detect operating system"
  fi

  # shellcheck disable=SC1091
  source /etc/os-release
  case "${ID:-}" in
    debian|ubuntu)
      ;;
    *)
      die "unsupported OS '${ID:-unknown}'; this installer currently targets Debian/Ubuntu"
      ;;
  esac
}

install_base_packages() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl git rsync
}

current_node_major() {
  if ! command -v node >/dev/null 2>&1; then
    echo 0
    return
  fi

  node -p 'Number.parseInt(process.versions.node.split(".")[0], 10)' 2>/dev/null || echo 0
}

ensure_node() {
  local current_major
  current_major="$(current_node_major)"

  if (( current_major >= NODE_MAJOR )); then
    log "node $(node -v) already satisfies requirement"
    return
  fi

  log "installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y nodejs
}

ensure_corepack() {
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
}

ensure_service_user() {
  if ! getent group "$APP_GROUP" >/dev/null 2>&1; then
    groupadd --system "$APP_GROUP"
  fi

  if ! id -u "$APP_USER" >/dev/null 2>&1; then
    useradd \
      --system \
      --gid "$APP_GROUP" \
      --home-dir "$APP_HOME" \
      --create-home \
      --shell /usr/sbin/nologin \
      "$APP_USER"
  fi

  install -d -m 0755 -o "$APP_USER" -g "$APP_GROUP" "$APP_HOME"
  install -d -m 0755 -o "$APP_USER" -g "$APP_GROUP" "$INSTALL_ROOT"
  install -d -m 0755 -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR"
}

sync_repo() {
  log "syncing repository into ${APP_DIR}"
  rsync -a --delete \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude '.next/' \
    --exclude 'coverage/' \
    --exclude 'runtime/' \
    --exclude 'tmp/' \
    --exclude '.env.local' \
    --exclude '.env.development' \
    --exclude '.env.production' \
    --exclude '.env.test' \
    --exclude '.env*.local' \
    "$REPO_ROOT"/ "$APP_DIR"/

  chown -R "$APP_USER:$APP_GROUP" "$INSTALL_ROOT"
}

write_env_file_if_needed() {
  if [[ -f "$ENV_FILE" && "${OVERWRITE_ENV:-0}" != "1" ]]; then
    log "keeping existing env file at ${ENV_FILE}"
    return
  fi

  log "writing env file to ${ENV_FILE}"
  cat >"$ENV_FILE" <<EOF
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=${APP_PORT}
HOSTNAME=${APP_HOSTNAME}
CADDY_ADMIN_URL=${CADDY_ADMIN_URL:-http://127.0.0.1:2019/config/}
CADDY_CONFIG_JSON_PATH=${CADDY_CONFIG_JSON_PATH:-}
CADDYFILE_PATH=${CADDYFILE_PATH:-}
CADDY_BIN=${CADDY_BIN:-caddy}
CADDY_ADAPTER=${CADDY_ADAPTER:-caddyfile}
CADDY_DASHBOARD_ALLOW_SELF_SIGNED=${CADDY_DASHBOARD_ALLOW_SELF_SIGNED:-false}
CADDY_DASHBOARD_DEMO_MODE=${CADDY_DASHBOARD_DEMO_MODE:-false}
CADDY_DASHBOARD_FRONTEND_TIMEOUT_MS=${CADDY_DASHBOARD_FRONTEND_TIMEOUT_MS:-1500}
CADDY_DASHBOARD_BACKEND_TIMEOUT_MS=${CADDY_DASHBOARD_BACKEND_TIMEOUT_MS:-1200}
CADDY_DASHBOARD_REFRESH_INTERVAL_MS=${CADDY_DASHBOARD_REFRESH_INTERVAL_MS:-10000}
EOF
  chmod 0640 "$ENV_FILE"
}

load_env_file_overrides() {
  local env_port
  local env_host

  if [[ ! -f "$ENV_FILE" ]]; then
    return
  fi

  env_port="$(sed -n 's/^PORT=//p' "$ENV_FILE" | tail -n 1)"
  env_host="$(sed -n 's/^HOSTNAME=//p' "$ENV_FILE" | tail -n 1)"

  if [[ -n "$env_port" ]]; then
    APP_PORT="$env_port"
  fi

  if [[ -n "$env_host" ]]; then
    APP_HOSTNAME="$env_host"
  fi
}

install_service_file() {
  local node_bin
  node_bin="$(command -v node)"
  [[ -n "$node_bin" ]] || die "node binary not found after install"
  [[ -f "$SERVICE_TEMPLATE" ]] || die "service template is missing: $SERVICE_TEMPLATE"

  log "installing systemd unit ${SERVICE_FILE}"
  sed \
    -e "s|__APP_NAME__|$APP_NAME|g" \
    -e "s|__APP_USER__|$APP_USER|g" \
    -e "s|__APP_GROUP__|$APP_GROUP|g" \
    -e "s|__APP_HOME__|$APP_HOME|g" \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__ENV_FILE__|$ENV_FILE|g" \
    -e "s|__NODE_BIN__|$node_bin|g" \
    "$SERVICE_TEMPLATE" >"$SERVICE_FILE"
  chmod 0644 "$SERVICE_FILE"
}

build_app() {
  log "installing dependencies and building standalone output"
  runuser -u "$APP_USER" -- env \
    HOME="$APP_HOME" \
    XDG_CACHE_HOME="$APP_HOME/.cache" \
    APP_DIR="$APP_DIR" \
    bash -lc '
      set -euo pipefail
      cd "$APP_DIR"
      corepack pnpm install --frozen-lockfile
      corepack pnpm build
    '
}

restart_service() {
  log "reloading systemd and restarting ${APP_NAME}"
  systemctl daemon-reload
  systemctl enable "$APP_NAME"
  systemctl restart "$APP_NAME"
}

healthcheck_url() {
  local host="$APP_HOSTNAME"
  if [[ "$host" == "0.0.0.0" || "$host" == "::" ]]; then
    host="127.0.0.1"
  fi

  printf 'http://%s:%s/api/health\n' "$host" "$APP_PORT"
}

wait_for_health() {
  local url
  local attempt

  url="$(healthcheck_url)"
  for attempt in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "health check passed at ${url}"
      return
    fi
    sleep 1
  done

  systemctl status "$APP_NAME" --no-pager || true
  die "health check failed at ${url}"
}
