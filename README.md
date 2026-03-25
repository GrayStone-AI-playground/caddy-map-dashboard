# Caddy Map Dashboard

A Caddy-driven service portal for quick links, route inspection, and lightweight status.

The app uses **Caddy as the source of truth**. It reads live Caddy config, turns that into service records, and renders two views:

- `Portal`: compact launch cards for daily use
- `Routes`: a denser inspection table when you need the mapping details

## Production shape

This repo is set up to run as a long-term Linux service:

- `pnpm` is the package manager
- Next.js builds with `output: "standalone"`
- production runs with plain `node`, not `npm start` as a process manager
- host deployment is handled by `systemd`
- health endpoint: `/api/health`

The intended runtime chain is:

```text
External Caddy -> reverse_proxy -> caddy-map-dashboard systemd service
```

## New machine deploy

Two workable install paths are supported on Debian 13 / Ubuntu-style hosts.

Clone + install:

```bash
git clone https://github.com/GrayStone-AI-playground/caddy-map-dashboard.git && \
cd caddy-map-dashboard && \
sudo CADDY_ADMIN_URL=http://127.0.0.1:2019/config/ ./ops/install-host.sh
```

Bootstrap directly from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/GrayStone-AI-playground/caddy-map-dashboard/main/ops/bootstrap-host.sh | \
sudo CADDY_ADMIN_URL=http://127.0.0.1:2019/config/ bash
```

What the installer does:

- installs Node.js 22 if needed
- enables `pnpm` through `corepack`
- creates a dedicated system user
- syncs the app into `/opt/caddy-map-dashboard/app`
- writes `/etc/caddy-map-dashboard.env` if it does not exist
- builds the standalone server
- installs and starts `caddy-map-dashboard.service`
- verifies `/api/health`

External Caddy examples are included here:

- `ops/caddy/caddy-map-dashboard.http.caddy`
- `ops/caddy/caddy-map-dashboard.https.caddy`

## Updating an installed host

From a checked-out repo:

```bash
git pull
sudo ./ops/update-host.sh
```

Useful service commands:

```bash
systemctl status caddy-map-dashboard
journalctl -u caddy-map-dashboard -f
curl http://127.0.0.1:3211/api/health
```

## External Caddy examples

If your public or edge Caddy should proxy to this app, point it at the app service on `127.0.0.1:3211` by default.

Same-host HTTP example:

```caddy
http://portal.example.internal {
	reverse_proxy 127.0.0.1:3211
}
```

Same-host HTTPS example:

```caddy
portal.example.com {
	reverse_proxy 127.0.0.1:3211
}
```

If Caddy runs on a different machine, replace `127.0.0.1:3211` with the app host IP and port, for example:

```caddy
portal.example.com {
	reverse_proxy 10.0.0.25:3211
}
```

Tracked snippet files:

- `ops/caddy/caddy-map-dashboard.http.caddy`
- `ops/caddy/caddy-map-dashboard.https.caddy`

## Local development

```bash
corepack pnpm install
corepack pnpm dev
```

Open `http://localhost:3000`.

If you do not configure a live Caddy source, the UI falls back to bundled demo data.

## Runtime config

Primary config lives in `/etc/caddy-map-dashboard.env` in production.

Tracked examples:

- `.env.example`
- `ops/caddy-map-dashboard.env.example`

Supported source options:

```bash
# Option 1: running Caddy admin API
CADDY_ADMIN_URL=http://127.0.0.1:2019/config/

# Option 2: saved JSON config
CADDY_CONFIG_JSON_PATH=/absolute/path/to/caddy-config.json

# Option 3: local Caddyfile
CADDYFILE_PATH=/absolute/path/to/Caddyfile
CADDY_BIN=caddy
CADDY_ADAPTER=caddyfile
```

Common runtime settings:

```bash
PORT=3211
HOSTNAME=127.0.0.1
CADDY_DASHBOARD_ALLOW_SELF_SIGNED=false
CADDY_DASHBOARD_DEMO_MODE=false
CADDY_DASHBOARD_FRONTEND_TIMEOUT_MS=1500
CADDY_DASHBOARD_BACKEND_TIMEOUT_MS=1200
CADDY_DASHBOARD_REFRESH_INTERVAL_MS=10000
```

## Scripts

```bash
corepack pnpm dev
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm start
```

`corepack pnpm start` runs the generated standalone server:

```bash
node .next/standalone/server.js
```

## Repo safety

- `.env` files are ignored; only examples are tracked
- local runtime/log/tmp state is ignored
- no machine-specific paths are committed
- the bundled example Caddyfile is generic: `examples/Caddyfile.example`

## Notes

- The current normalizer intentionally focuses on common Caddy patterns first.
- Ambiguous routes are surfaced rather than hidden. If multiple leaf routes collapse into one hostname, the record is marked as `mixed` and notes include `multiple routes`.
- Automatic HTTP-to-HTTPS redirects generated for an already-served host are filtered out so they do not duplicate normal service cards.
