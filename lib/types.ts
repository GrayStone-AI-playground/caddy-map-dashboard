export type ProbeState = "up" | "warn" | "down" | "unknown" | "na";
export type OverallState = "up" | "warn" | "down" | "unknown";
export type RouteType =
  | "reverse_proxy"
  | "file_server"
  | "redirect"
  | "static_response"
  | "mixed"
  | "unknown";
export type TransportHint = "http" | "https" | "unknown";
export type SourceKind = "admin" | "json-file" | "adapted-file" | "demo";

export interface ProbeResult {
  state: ProbeState;
  label: string;
  checkedAt: string;
  code?: number;
  latencyMs?: number;
  detail?: string;
}

export interface DashboardServiceBase {
  id: string;
  displayName: string;
  record: string;
  url?: string;
  hostnames: string[];
  listeners: string[];
  routeType: RouteType;
  mappedTo: string[];
  upstreams: string[];
  notes: string[];
  sourcePaths: string[];
  transportHint: TransportHint;
  lastUpdated: string;
}

export interface DashboardService extends DashboardServiceBase {
  overallStatus: OverallState;
  backend: ProbeResult;
}

export interface DashboardSource {
  kind: SourceKind;
  label: string;
  checkedAt: string;
  issues: string[];
  fileMTime?: string;
}

export interface DashboardSummary {
  total: number;
  up: number;
  warn: number;
  down: number;
  unknown: number;
  unhealthy: number;
  generatedAt: string;
}

export interface DashboardSnapshot {
  summary: DashboardSummary;
  source: DashboardSource;
  services: DashboardService[];
}
