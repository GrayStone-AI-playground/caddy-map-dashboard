import { compactValue, firstValue, titleCaseRouteType } from "@/lib/dashboard/format";
import type { DashboardService } from "@/lib/types";

import { StatusBadge } from "@/components/status-badge";

interface ServiceCardProps {
  service: DashboardService;
  onOpenDetails: (serviceId: string) => void;
}

export function ServiceCard({ service, onOpenDetails }: ServiceCardProps) {
  const summaryLine =
    service.routeType === "reverse_proxy"
      ? `Proxy to ${firstValue(service.mappedTo, "unknown upstream")}`
      : service.routeType === "redirect"
        ? `Redirect to ${firstValue(service.mappedTo, "redirect")}`
        : compactValue(
            service.mappedTo,
            titleCaseRouteType(service.routeType),
          );

  return (
    <article className="group rounded-[24px] border border-[var(--border-strong)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[1.1rem] font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-[1.2rem]">
            {service.displayName}
          </h3>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
            {titleCaseRouteType(service.routeType)}
          </p>
        </div>
        <StatusBadge
          label={service.overallStatus}
          tone={service.overallStatus}
        />
      </div>

      <div className="mt-4 space-y-2.5">
        <p className="break-all rounded-xl border border-[var(--border)] bg-white/60 px-3 py-2 font-mono text-[12px] text-[var(--accent-strong)]">
          {service.url ?? service.record}
        </p>
        <p className="text-sm text-[var(--muted)]">{summaryLine}</p>
      </div>

      <div className="mt-5 flex items-center gap-2.5">
        <a
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-medium text-amber-50 hover:-translate-y-px hover:bg-[var(--accent)]"
          href={service.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open
        </a>
        <button
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-[var(--border-strong)] bg-white/55 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:-translate-y-px hover:border-[var(--accent)]/40 hover:bg-white"
          type="button"
          onClick={() => onOpenDetails(service.id)}
        >
          Details
        </button>
      </div>
    </article>
  );
}
