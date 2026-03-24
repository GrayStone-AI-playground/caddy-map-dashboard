import http from "node:http";
import https from "node:https";
import net from "node:net";

import { normalizeCaddyConfig } from "@/lib/caddy/normalize";
import { loadConfiguredSource } from "@/lib/caddy/source";
import type {
  DashboardService,
  DashboardServiceBase,
  DashboardSnapshot,
  OverallState,
  ProbeResult,
  ProbeState,
} from "@/lib/types";

const REFRESH_TTL_MS = 5_000;

declare global {
  var __caddyDashboardCache:
    | {
        expiresAt: number;
        snapshotPromise: Promise<DashboardSnapshot>;
      }
    | undefined;
}

function now() {
  return new Date().toISOString();
}

function parseTimeout(envName: string, fallback: number) {
  const raw = process.env[envName];
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function allowSelfSigned() {
  const raw = process.env.CADDY_DASHBOARD_ALLOW_SELF_SIGNED;
  return raw === "1" || raw === "true";
}

function createProbe(state: ProbeState, label: string, detail?: string): ProbeResult {
  return {
    state,
    label,
    detail,
    checkedAt: now(),
  };
}

function aggregateOverall(frontend: ProbeResult, backend: ProbeResult): OverallState {
  if (frontend.state === "down") {
    return "down";
  }

  if (frontend.state === "warn") {
    return "warn";
  }

  if (backend.state === "down") {
    return frontend.state === "up" ? "warn" : "down";
  }

  if (backend.state === "warn") {
    return "warn";
  }

  if (frontend.state === "unknown") {
    return "unknown";
  }

  if (backend.state === "unknown") {
    return frontend.state === "up" ? "warn" : "unknown";
  }

  return "up";
}

async function probeHttpUrl(target: string, timeoutMs: number): Promise<ProbeResult> {
  const checkedAt = now();
  const startedAt = Date.now();
  const url = new URL(target);
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const request = client.request(
      url,
      {
        method: "GET",
        rejectUnauthorized:
          url.protocol === "https:" ? !allowSelfSigned() : undefined,
        headers: {
          "user-agent": "caddy-map-dashboard/0.1",
        },
      },
      (response) => {
        const latencyMs = Date.now() - startedAt;
        response.resume();
        response.once("end", () => {
          const code = response.statusCode ?? 0;
          const state: ProbeState =
            code >= 500 ? "warn" : code >= 200 && code < 500 ? "up" : "unknown";

          resolve({
            state,
            label: code > 0 ? `HTTP ${code}` : "HTTP response",
            code,
            latencyMs,
            checkedAt,
          });
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("timeout"));
    });

    request.once("error", (error) => {
      const knownError = error as NodeJS.ErrnoException;
      resolve({
        state: "down",
        label:
          knownError.code === "DEPTH_ZERO_SELF_SIGNED_CERT"
            ? "TLS rejected"
            : "Unavailable",
        detail: error.message,
        checkedAt,
      });
    });

    request.end();
  });
}

async function probeTcpDial(dial: string, timeoutMs: number): Promise<ProbeResult> {
  const checkedAt = now();
  const startedAt = Date.now();
  const [host, portText] = dial.split(":");
  const port = Number.parseInt(portText ?? "", 10);

  if (!host || !Number.isFinite(port)) {
    return createProbe("unknown", "Unknown upstream", dial);
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      const latencyMs = Date.now() - startedAt;
      socket.destroy();
      resolve({
        state: "up",
        label: "TCP open",
        latencyMs,
        checkedAt,
      });
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(createProbe("down", "TCP timeout", `${host}:${port}`));
    });

    socket.once("error", (error) => {
      resolve(createProbe("down", "Connection refused", error.message));
    });
  });
}

function buildUpstreamUrl(service: DashboardServiceBase, upstream: string) {
  if (upstream.startsWith("http://") || upstream.startsWith("https://")) {
    return upstream;
  }

  if (upstream.includes("{") || upstream.startsWith("unix/")) {
    return undefined;
  }

  return `${service.transportHint === "https" ? "https" : "http"}://${upstream}`;
}

function summarizeProbeResults(results: ProbeResult[], defaultLabel: string): ProbeResult {
  const checkedAt = now();
  if (results.length === 0) {
    return createProbe("unknown", defaultLabel);
  }

  const upCount = results.filter((result) => result.state === "up").length;
  const warnCount = results.filter((result) => result.state === "warn").length;
  const downCount = results.filter((result) => result.state === "down").length;
  const latencySamples = results
    .map((result) => result.latencyMs)
    .filter((value): value is number => typeof value === "number");
  const latencyMs =
    latencySamples.length > 0
      ? Math.round(
          latencySamples.reduce((total, sample) => total + sample, 0) /
            latencySamples.length,
        )
      : undefined;

  if (downCount === results.length) {
    return {
      state: "down",
      label: `${downCount}/${results.length} upstreams down`,
      latencyMs,
      checkedAt,
      detail: results[0]?.detail,
    };
  }

  if (upCount === results.length) {
    return {
      state: "up",
      label: `${upCount}/${results.length} upstreams reachable`,
      latencyMs,
      checkedAt,
    };
  }

  if (warnCount > 0 || downCount > 0) {
    return {
      state: "warn",
      label: `${upCount}/${results.length} upstreams reachable`,
      latencyMs,
      checkedAt,
    };
  }

  return createProbe("unknown", defaultLabel);
}

async function probeFrontend(service: DashboardServiceBase) {
  if (!service.url) {
    return createProbe("unknown", "No primary URL");
  }

  return probeHttpUrl(
    service.url,
    parseTimeout("CADDY_DASHBOARD_FRONTEND_TIMEOUT_MS", 1_500),
  );
}

async function probeBackend(service: DashboardServiceBase) {
  if (service.routeType !== "reverse_proxy") {
    return createProbe("na", "n/a");
  }

  const timeoutMs = parseTimeout("CADDY_DASHBOARD_BACKEND_TIMEOUT_MS", 1_200);
  const results = await Promise.all(
    service.upstreams.map(async (upstream) => {
      const httpUrl = buildUpstreamUrl(service, upstream);
      if (httpUrl) {
        const httpProbe = await probeHttpUrl(httpUrl, timeoutMs);
        if (httpProbe.state === "up" || httpProbe.state === "warn") {
          return httpProbe;
        }
      }

      return probeTcpDial(upstream, timeoutMs);
    }),
  );

  return summarizeProbeResults(results, "No upstream probe");
}

async function enrichService(service: DashboardServiceBase): Promise<DashboardService> {
  const [frontend, backend] = await Promise.all([
    probeFrontend(service),
    probeBackend(service),
  ]);

  return {
    ...service,
    frontend,
    backend,
    overallStatus: aggregateOverall(frontend, backend),
  };
}

function summarize(services: DashboardService[]) {
  const summary = {
    total: services.length,
    up: 0,
    warn: 0,
    down: 0,
    unknown: 0,
    unhealthy: 0,
    generatedAt: now(),
  };

  services.forEach((service) => {
    summary[service.overallStatus] += 1;
    if (service.overallStatus !== "up") {
      summary.unhealthy += 1;
    }
  });

  return summary;
}

function sortServices(services: DashboardService[]) {
  const severity: Record<OverallState, number> = {
    down: 0,
    warn: 1,
    unknown: 2,
    up: 3,
  };

  return services.sort((left, right) => {
    const severityDelta = severity[left.overallStatus] - severity[right.overallStatus];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

async function buildSnapshot(): Promise<DashboardSnapshot> {
  const sourceResult = await loadConfiguredSource();
  if (sourceResult.snapshot) {
    return sourceResult.snapshot;
  }

  const baseServices = normalizeCaddyConfig(sourceResult.config);
  const services = await Promise.all(baseServices.map(enrichService));

  return {
    summary: summarize(services),
    source: sourceResult.source,
    services: sortServices(services),
  };
}

export async function getDashboardSnapshot() {
  const cached = globalThis.__caddyDashboardCache;
  const currentTime = Date.now();

  if (cached && cached.expiresAt > currentTime) {
    return cached.snapshotPromise;
  }

  const snapshotPromise = buildSnapshot();
  globalThis.__caddyDashboardCache = {
    expiresAt: currentTime + REFRESH_TTL_MS,
    snapshotPromise,
  };

  return snapshotPromise;
}
