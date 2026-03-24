# Caddy Map Dashboard

A Caddy-driven dashboard with three views:

- `Home`: mini-cards for quick jumping
- `Caddy Map`: a dense routing table
- `Details`: a shared modal for one service at a time

The app is built to use **Caddy as the source of truth**, not a second hand-maintained service list.

## Current scope

- Reads Caddy config from one of three live sources:
  - admin API JSON
  - saved JSON config file
  - `caddy adapt` against a local Caddyfile
- Falls back to bundled demo data when no live source is configured
- Normalizes common route types:
  - `reverse_proxy`
  - `file_server`
  - redirects via `static_response`
- Runs separate frontend and backend probes
- Renders the chosen design iteration:
  - homepage cards with `Open` and `Details`
  - separate `Caddy Map` table
  - shared detail modal

## Why this repo is public-safe

- No machine-specific paths are committed by default
- `.env` files are ignored; only `.env.example` is tracked
- Local runtime state is ignored:
  - `runtime/`
  - `tmp/`
  - logs
  - coverage output
- The bundled example Caddyfile is generic: `examples/Caddyfile.example`

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

If you do not configure a live Caddy source, the UI renders the bundled demo snapshot.

## Live source options

Set one of these in a local `.env.local`:

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

Other useful options:

```bash
CADDY_DASHBOARD_ALLOW_SELF_SIGNED=true
NEXT_PUBLIC_REFRESH_INTERVAL_MS=10000
CADDY_DASHBOARD_FRONTEND_TIMEOUT_MS=1500
CADDY_DASHBOARD_BACKEND_TIMEOUT_MS=1200
```

See `.env.example`.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
npm start
```

## Project layout

```text
app/
  api/dashboard/route.ts   # dashboard snapshot API
  page.tsx                 # initial server-rendered shell
components/
  dashboard-shell.tsx      # tabs, filters, polling, modal state
  service-card.tsx         # Home mini-cards
  caddy-map-table.tsx      # dense table view
  service-detail-modal.tsx # shared detail view
lib/
  caddy/                   # source loading + normalization
  dashboard/               # formatting + probe/cache service
tests/
  caddy/                   # normalization tests
```

## Notes

- The current normalizer intentionally focuses on common Caddy patterns first.
- Ambiguous routes are surfaced rather than hidden. If multiple leaf routes collapse into one hostname, the record is marked as `mixed` and notes include `multiple routes`.
- Automatic HTTP-to-HTTPS redirects generated for an already-served host are filtered out so they do not duplicate normal service cards.

## Open follow-ups

- richer route normalization for more exotic handler trees
- better file-server root extraction beyond simple `vars.root`
- stronger handling for non-HTTP upstream transports
- optional screenshots or visual regression coverage
