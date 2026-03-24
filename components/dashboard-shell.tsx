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
        <header className="overflow-hidden rounded-[32px] border border-[var(--border-strong)] bg-[var(--surface-strong)] px-6 py-6 shadow-[var(--shadow)]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                Caddy-driven routing homepage
              </p>
              <h1 className="mt-4 text-balance text-[clamp(2.2rem,4vw,4.3rem)] font-semibold leading-none tracking-[-0.06em] text-[var(--foreground)]">
                Home cards for daily jumping.
                <br />
                A dense map when you need the truth.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
                The UI follows the chosen iteration directly: a readable homepage
                grid, a separate Caddy Map table, and one shared detail modal for
                dense per-service inspection.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "Entries", value: snapshot.summary.total },
                { label: "Healthy", value: snapshot.summary.up },
                { label: "Issues", value: snapshot.summary.unhealthy },
                { label: "Source", value: snapshot.source.kind.replace("-", " ") },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[22px] border border-[var(--border)] bg-white/65 px-4 py-4"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_180px_180px] xl:min-w-[62%]">
              <input
                className="min-h-12 rounded-2xl border border-[var(--border)] bg-white/70 px-4 text-sm text-[var(--foreground)] outline-none ring-0 placeholder:text-[var(--muted)] focus:border-[var(--accent)]/40"
                placeholder="Search name, record, URL, or target"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                className="min-h-12 rounded-2xl border border-[var(--border)] bg-white/70 px-4 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]/40"
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
                className="min-h-12 rounded-2xl border border-[var(--border)] bg-white/70 px-4 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]/40"
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

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full border border-[var(--border-strong)] bg-white/70 p-1">
                {([
                  ["home", "Home"],
                  ["map", "Caddy Map"],
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
              <div className="rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                {snapshot.source.kind.replace("-", " ")} • {snapshot.source.label}
              </div>
              <div className="rounded-full border border-[var(--border)] bg-white/70 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                Auto refresh {Math.max(1, Math.round(refreshIntervalMs / 1000))}s
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

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--border)] bg-white/55 px-5 py-4 text-sm text-[var(--muted)]">
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
