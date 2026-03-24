import type {
  DashboardService,
  OverallState,
  ProbeResult,
  ProbeState,
} from "@/lib/types";

export const overallSeverity: Record<OverallState, number> = {
  down: 0,
  warn: 1,
  unknown: 2,
  up: 3,
};

export const probeSeverity: Record<ProbeState, number> = {
  down: 0,
  warn: 1,
  unknown: 2,
  up: 3,
  na: 4,
};

export function titleCaseRouteType(routeType: DashboardService["routeType"]) {
  switch (routeType) {
    case "reverse_proxy":
      return "Reverse Proxy";
    case "file_server":
      return "File Server";
    case "static_response":
      return "Static Response";
    case "mixed":
      return "Mixed";
    case "redirect":
      return "Redirect";
    default:
      return "Unknown";
  }
}

export function formatTimestamp(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function compactValue(values: string[], fallback = "—") {
  return values.length > 0 ? values.join(", ") : fallback;
}

export function firstValue(values: string[], fallback = "—") {
  return values[0] ?? fallback;
}

export function overallLabel(status: OverallState) {
  return status.toUpperCase();
}

export function probeLabel(result: ProbeResult) {
  return result.state === "na" ? "N/A" : result.state.toUpperCase();
}
