"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import {
  CaddyMapTable,
  sortServicesForTable,
  type SortKey,
} from "@/components/caddy-map-table";
import { ServiceCard } from "@/components/service-card";
import { ServiceDetailModal } from "@/components/service-detail-modal";
import { compactValue, formatTimestamp } from "@/lib/dashboard/format";
import type { DashboardSnapshot, DashboardService, OverallState } from "@/lib/types";

type TabKey = "home" | "map";

function sortRouteTypes(services: DashboardSnapshot["services"]) {
  return [...new Set(services.map((service) => service.routeType))].sort();
}

function sourceLabel(kind: DashboardSnapshot["source"]["kind"]) {
  switch (kind) {
    case "admin":
      return "Live Caddy";
    case "json-file":
      return "JSON file";
    case "adapted-file":
      return "Adapted Caddyfile";
    case "demo":
      return "Demo data";
    default:
      return kind;
  }
}

export function DashboardShell({
  initialSnapshot,
}: {
  initialSnapshot: DashboardSnapshot;
}) {
  const refreshIntervalMs = Number.parseInt(
    process.env.NEXT_PUBLIC_REFRESH_INTERVAL_MS ?? "10000",
    10,
  );
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<OverallState | "all">("all");
  const [typeFilter, setTypeFilter] = useState<
    DashboardService["routeType"] | "all"
  >("all");
  const [sortKey, setSortKey] = useState<SortKey>("overallStatus");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refreshSnapshot = useEffectEvent(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const nextSnapshot = (await response.json()) as DashboardSnapshot;
      startTransition(() => {
        setSnapshot(nextSnapshot);
        setFetchError(null);
      });
    } catch (error) {
      setFetchError(
        error instanceof Error ? error.message : "Could not refresh dashboard data.",
      );
    }
  });

  useEffect(() => {
    refreshSnapshot();
    const timer = window.setInterval(refreshSnapshot, refreshIntervalMs);

    return () => window.clearInterval(timer);
  }, [refreshIntervalMs]);

  const filteredServices = snapshot.services.filter((service) => {
    const query = deferredSearch.trim().toLowerCase();
    const matchesQuery =
      query.length === 0 ||
      [
        service.displayName,
        service.record,
        service.url ?? "",
        compactValue(service.mappedTo),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

    const matchesStatus =
      statusFilter === "all" || service.overallStatus === statusFilter;
    const matchesType = typeFilter === "all" || service.routeType === typeFilter;

    return matchesQuery && matchesStatus && matchesType;
  });

  const sortedForTable = sortServicesForTable(
    filteredServices,
    sortKey,
    sortDirection,
  );
  const selectedService =
    snapshot.services.find((service) => service.id === selectedServiceId) ?? null;
  const routeTypes = sortRouteTypes(snapshot.services);

  return (
    <div className="relative flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-strong)] px-5 py-5 shadow-[var(--shadow)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-[1.85rem] font-semibold tracking-[-0.04em] text-[var(--foreground)] sm:text-[2.1rem]">
                Service Portal
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Quick links from the current Caddy config.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[320px]">
              {[
                { label: "Total", value: snapshot.summary.total },
                { label: "Ready", value: snapshot.summary.up },
                { label: "Attention", value: snapshot.summary.unhealthy },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[18px] border border-[var(--border)] bg-white/65 px-4 py-3"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-1.5 text-xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
          <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="space-y-3">
                <input
                  className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-white/70 px-4 text-sm text-[var(--foreground)] outline-none ring-0 placeholder:text-[var(--muted)] focus:border-[var(--accent)]/40"
                  placeholder="Search name, record, URL, or target"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <div className="flex flex-wrap gap-2.5">
                  <select
                    className="min-h-10 w-[156px] max-w-full rounded-xl border border-[var(--border)] bg-white/70 px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]/40"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as OverallState | "all")
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="up">Up</option>
                    <option value="warn">Warn</option>
                    <option value="down">Down</option>
                    <option value="unknown">Unknown</option>
                  </select>
                  <select
                    className="min-h-10 w-[170px] max-w-full rounded-xl border border-[var(--border)] bg-white/70 px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]/40"
                    value={typeFilter}
                    onChange={(event) =>
                      setTypeFilter(
                        event.target.value as DashboardService["routeType"] | "all",
                      )
                    }
                  >
                    <option value="all">All route types</option>
                    {routeTypes.map((routeType) => (
                      <option key={routeType} value={routeType}>
                        {routeType}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-start xl:justify-end">
                <div className="inline-flex rounded-full border border-[var(--border-strong)] bg-white/70 p-1">
                  {([
                    ["home", "Portal"],
                    ["map", "Routes"],
                  ] as const).map(([tabKey, label]) => (
                    <button
                      key={tabKey}
                      className={[
                        "rounded-full px-4 py-2 text-sm font-medium",
                        activeTab === tabKey
                          ? "bg-[var(--accent-strong)] text-amber-50"
                          : "text-[var(--foreground)] hover:bg-white",
                      ].join(" ")}
                      type="button"
                      onClick={() => setActiveTab(tabKey)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </section>

        {(snapshot.source.issues.length > 0 || fetchError) && (
          <section className="rounded-[24px] border border-amber-700/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-950">
            <p className="font-semibold uppercase tracking-[0.18em]">Source notes</p>
            <ul className="mt-3 space-y-2">
              {snapshot.source.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
              {fetchError ? <li>Refresh failed: {fetchError}</li> : null}
            </ul>
          </section>
        )}

        <section className="rounded-[24px] border border-[var(--border)] bg-white/55 px-5 py-4 text-sm text-[var(--muted)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <p>
                Showing <span className="font-semibold text-[var(--foreground)]">{filteredServices.length}</span>{" "}
                of <span className="font-semibold text-[var(--foreground)]">{snapshot.summary.total}</span>{" "}
                services
              </p>
              <p className="font-mono text-[12px] text-[var(--foreground)]">
                Last sync {formatTimestamp(snapshot.summary.generatedAt)}
                {snapshot.source.fileMTime
                  ? ` • file ${formatTimestamp(snapshot.source.fileMTime)}`
                  : ""}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="self-start rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                Auto refresh {Math.max(1, Math.round(refreshIntervalMs / 1000))}s
              </div>
              <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5 text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--muted)] sm:max-w-xl xl:max-w-2xl">
                <span className="block break-all sm:text-right">
                  {sourceLabel(snapshot.source.kind)} • {snapshot.source.label}
                </span>
              </div>
            </div>
          </div>
        </section>

        {activeTab === "home" ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onOpenDetails={(serviceId) => setSelectedServiceId(serviceId)}
              />
            ))}
          </section>
        ) : (
          <CaddyMapTable
            services={sortedForTable}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={(key) => {
              if (key === sortKey) {
                setSortDirection((current) =>
                  current === "asc" ? "desc" : "asc",
                );
                return;
              }

              setSortKey(key);
              setSortDirection("asc");
            }}
            onOpenDetails={(serviceId) => setSelectedServiceId(serviceId)}
          />
        )}
      </div>

      <ServiceDetailModal
        service={selectedService}
        onClose={() => setSelectedServiceId(null)}
      />
    </div>
  );
}
