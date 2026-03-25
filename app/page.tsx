import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardSnapshot } from "@/lib/dashboard/service";

export const dynamic = "force-dynamic";

function getRefreshIntervalMs() {
  const raw = process.env.CADDY_DASHBOARD_REFRESH_INTERVAL_MS ?? "10000";
  const value = Number.parseInt(raw, 10);

  return Number.isFinite(value) && value > 0 ? value : 10000;
}

export default async function Home() {
  const snapshot = await getDashboardSnapshot();
  const refreshIntervalMs = getRefreshIntervalMs();

  return (
    <DashboardShell
      initialSnapshot={snapshot}
      refreshIntervalMs={refreshIntervalMs}
    />
  );
}
