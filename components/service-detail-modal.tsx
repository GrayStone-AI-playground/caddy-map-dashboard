import { useEffect } from "react";

import {
  compactValue,
  formatTimestamp,
  titleCaseRouteType,
} from "@/lib/dashboard/format";
import type { DashboardService } from "@/lib/types";

import { StatusBadge } from "@/components/status-badge";

interface ServiceDetailModalProps {
  service: DashboardService | null;
  onClose: () => void;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-2 border-b border-[var(--border)] py-3 md:grid-cols-[140px_1fr]">
      <dt className="text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className="font-mono text-[13px] text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

export function ServiceDetailModal({
  service,
  onClose,
}: ServiceDetailModalProps) {
  useEffect(() => {
    if (!service) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, service]);

  if (!service) {
    return null;
  }

  const statusLabel = service.routeType === "reverse_proxy" ? "Upstream" : "Route";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl overflow-hidden rounded-[32px] border border-[var(--border-strong)] bg-[var(--surface-strong)] shadow-[0_30px_100px_rgba(31,26,22,0.3)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[1.7rem] font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {service.displayName}
              </h2>
              <StatusBadge
                label={service.overallStatus}
                tone={service.overallStatus}
              />
            </div>
            <p className="font-mono text-[13px] text-[var(--accent-strong)]">
              {service.url ?? service.record}
            </p>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-strong)] text-lg text-[var(--foreground)] hover:bg-white/70"
            type="button"
            onClick={onClose}
            aria-label="Close details"
          >
            ×
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-[24px] border border-[var(--border)] bg-white/55 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Summary
            </h3>
            <dl className="mt-4">
              <DetailRow label="Record" value={service.record} />
              <DetailRow label="Served on" value={compactValue(service.listeners)} />
              <DetailRow
                label="Route type"
                value={titleCaseRouteType(service.routeType)}
              />
              <DetailRow label="Mapped to" value={compactValue(service.mappedTo)} />
              <DetailRow
                label="Last sync"
                value={formatTimestamp(service.lastUpdated)}
              />
            </dl>
          </section>

          <section className="rounded-[24px] border border-[var(--border)] bg-stone-950/[0.03] p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Status
            </h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {statusLabel}
                  </p>
                  <StatusBadge
                    label={service.backend.state}
                    tone={service.backend.state}
                    compact
                  />
                </div>
                <p className="mt-3 font-mono text-[13px] text-[var(--foreground)]">
                  {service.backend.label}
                  {typeof service.backend.latencyMs === "number"
                    ? ` • ${service.backend.latencyMs} ms`
                    : ""}
                </p>
                {service.backend.detail ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {service.backend.detail}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-6 border-t border-[var(--border)] px-6 py-6 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-[24px] border border-[var(--border)] bg-white/55 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Advanced
            </h3>
            <dl className="mt-4">
              <DetailRow label="Hostnames" value={compactValue(service.hostnames)} />
              <DetailRow label="Listeners" value={compactValue(service.listeners)} />
              <DetailRow label="Upstreams" value={compactValue(service.upstreams, "n/a")} />
              <DetailRow label="Source paths" value={compactValue(service.sourcePaths)} />
              <DetailRow label="Notes" value={compactValue(service.notes, "No special notes")} />
            </dl>
          </section>

          <section className="flex flex-col justify-between rounded-[24px] border border-[var(--border)] bg-stone-950/[0.03] p-5">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                Actions
              </h3>
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                Use the service homepage for fast jumping. This modal is the dense
                truth view for the selected Caddy entry.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--accent-strong)] px-4 py-3 text-sm font-medium text-amber-50 hover:bg-[var(--accent)]"
                href={service.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Site
              </a>
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-white/60 px-4 py-3 text-sm font-medium text-[var(--foreground)] hover:bg-white"
                type="button"
                onClick={async () => {
                  if (service.url) {
                    await navigator.clipboard.writeText(service.url);
                  }
                }}
              >
                Copy URL
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
