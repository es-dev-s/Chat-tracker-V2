import { NextResponse } from "next/server";
import { resolveApiViewer } from "@/lib/api/resolve-viewer";
import { getSupabaseFailoverPool } from "@/lib/db/supabase-failover";

export async function GET(request: Request) {
  try {
    const pool = getSupabaseFailoverPool();
    await pool.runHealthChecks();
    const nodes = pool.status();
    const active = nodes.find((n) => n.active);
    const healthyCount = nodes.filter((n) => n.healthy).length;

    // Uptime checks stay public, but DB URLs and node details need a signed-in user.
    const viewer = await resolveApiViewer(request).catch(() => null);
    if (!viewer) {
      return NextResponse.json({ ok: healthyCount > 0 });
    }

    return NextResponse.json({
      ok: healthyCount > 0,
      activeNode: active?.id ?? null,
      activeUrl: active?.url ?? null,
      failoverEnabled: nodes.length > 1,
      nodes,
    });
  } catch (err) {
    console.error("[health/db]", err);
    return NextResponse.json(
      { ok: false, error: "DB health check failed" },
      { status: 503 },
    );
  }
}
