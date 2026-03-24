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
      ? `→ ${firstValue(service.mappedTo, "unknown upstream")}`
      : service.routeType === "redirect"
        ? `→ ${firstValue(service.mappedTo, "redirect")}`
        : compactValue(service.mappedTo, titleCaseRouteType(service.routeType));

  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow)]">
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/50 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
            Service
          </p>
          <h3 className="mt-2 text-[1.4rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            {service.displayName}
          </h3>
        </div>
        <StatusBadge
          label={service.overallStatus}
          tone={service.overallStatus}
        />
      </div>

      <div className="mt-6 space-y-3">
        <p className="break-all rounded-2xl border border-[var(--border)] bg-white/60 px-3 py-2 font-mono text-[12px] text-[var(--accent-strong)]">
          {service.url ?? service.record}
        </p>
        <div className="rounded-2xl border border-[var(--border)] bg-stone-950/[0.03] px-3 py-3">
          <p className="font-mono text-[12px] text-[var(--foreground)]">
            {summaryLine}
          </p>
          <p className="mt-2 text-[12px] text-[var(--muted)]">
            {compactValue(service.listeners)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <a
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[var(--accent-strong)] px-4 py-3 text-sm font-medium text-amber-50 hover:-translate-y-px hover:bg-[var(--accent)]"
          href={service.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open
        </a>
        <button
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-[var(--border-strong)] bg-white/55 px-4 py-3 text-sm font-medium text-[var(--foreground)] hover:-translate-y-px hover:border-[var(--accent)]/40 hover:bg-white"
          type="button"
          onClick={() => onOpenDetails(service.id)}
        >
          Details
        </button>
      </div>
    </article>
  );
}
