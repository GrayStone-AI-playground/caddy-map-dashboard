import { getDashboardSnapshot } from "@/lib/dashboard/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getDashboardSnapshot();

  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
