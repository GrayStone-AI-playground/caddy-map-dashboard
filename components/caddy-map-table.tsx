import {
  compactValue,
  firstValue,
  formatTimestamp,
  overallSeverity,
  probeSeverity,
  titleCaseRouteType,
} from "@/lib/dashboard/format";
import type { DashboardService } from "@/lib/types";

import { StatusBadge } from "@/components/status-badge";

export type SortKey =
  | "overallStatus"
  | "frontend"
  | "backend"
  | "displayName"
  | "record"
  | "listeners"
  | "routeType"
  | "mappedTo"
  | "lastUpdated";

interface CaddyMapTableProps {
  services: DashboardService[];
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  onSortChange: (key: SortKey) => void;
  onOpenDetails: (serviceId: string) => void;
}

const columnLabels: Record<SortKey, string> = {
  overallStatus: "Overall",
  frontend: "Front",
  backend: "Back",
  displayName: "Name",
  record: "Record",
  listeners: "Served on",
  routeType: "Type",
  mappedTo: "Mapped to",
  lastUpdated: "Updated",
};

function sortSymbol(isActive: boolean, direction: "asc" | "desc") {
  if (!isActive) {
    return "↕";
  }

  return direction === "asc" ? "↑" : "↓";
}

function sortValue(service: DashboardService, key: SortKey) {
  switch (key) {
    case "overallStatus":
      return overallSeverity[service.overallStatus];
    case "frontend":
      return probeSeverity[service.frontend.state];
    case "backend":
      return probeSeverity[service.backend.state];
    case "displayName":
      return service.displayName.toLowerCase();
    case "record":
      return service.record.toLowerCase();
    case "listeners":
      return firstValue(service.listeners);
    case "routeType":
      return service.routeType;
    case "mappedTo":
      return firstValue(service.mappedTo);
    case "lastUpdated":
      return service.lastUpdated;
  }
}

export function sortServicesForTable(
  services: DashboardService[],
  sortKey: SortKey,
  sortDirection: "asc" | "desc",
) {
  return [...services].sort((left, right) => {
    const leftValue = sortValue(left, sortKey);
    const rightValue = sortValue(right, sortKey);

    const comparison =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));

    if (comparison !== 0) {
      return sortDirection === "asc" ? comparison : -comparison;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

export function CaddyMapTable({
  services,
  sortKey,
  sortDirection,
  onSortChange,
  onOpenDetails,
}: CaddyMapTableProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-strong)] shadow-[var(--shadow)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-stone-950/[0.04]">
            <tr>
              {(Object.keys(columnLabels) as SortKey[]).map((columnKey) => (
                <th
                  key={columnKey}
                  className="border-b border-[var(--border)] px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]"
                >
                  <button
                    className="inline-flex items-center gap-2"
                    type="button"
                    onClick={() => onSortChange(columnKey)}
                  >
                    {columnLabels[columnKey]}
                    <span className="font-mono text-[10px]">
                      {sortSymbol(sortKey === columnKey, sortDirection)}
                    </span>
                  </button>
                </th>
              ))}
              <th className="border-b border-[var(--border)] px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Inspect
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr
                key={service.id}
                className="group hover:bg-white/50"
              >
                <td className="border-b border-[var(--border)] px-4 py-4">
                  <StatusBadge
                    label={service.overallStatus}
                    tone={service.overallStatus}
                    compact
                  />
                </td>
                <td className="border-b border-[var(--border)] px-4 py-4">
                  <StatusBadge
                    label={service.frontend.state}
                    tone={service.frontend.state}
                    compact
                  />
                </td>
                <td className="border-b border-[var(--border)] px-4 py-4">
                  <StatusBadge
                    label={service.backend.state}
                    tone={service.backend.state}
                    compact
                  />
                </td>
                <td className="border-b border-[var(--border)] px-4 py-4 text-sm font-medium text-[var(--foreground)]">
                  {service.displayName}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-4 font-mono text-[12px] text-[var(--foreground)]">
                  {service.record}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-4 font-mono text-[12px] text-[var(--foreground)]">
                  {compactValue(service.listeners)}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-4 text-sm text-[var(--foreground)]">
                  {titleCaseRouteType(service.routeType)}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-4 font-mono text-[12px] text-[var(--foreground)]">
                  {compactValue(service.mappedTo)}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">
                  {formatTimestamp(service.lastUpdated)}
                </td>
                <td className="border-b border-[var(--border)] px-4 py-4">
                  <button
                    className="rounded-full border border-[var(--border-strong)] bg-white/60 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)]/40 hover:bg-white"
                    type="button"
                    onClick={() => onOpenDetails(service.id)}
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
