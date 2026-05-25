import { NextResponse } from "next/server";
import { getSupabaseFailoverPool } from "@/lib/db/supabase-failover";

export async function GET() {
  try {
    const pool = getSupabaseFailoverPool();
    await pool.runHealthChecks();
    const nodes = pool.status();
    const active = nodes.find((n) => n.active);
    const healthyCount = nodes.filter((n) => n.healthy).length;

    return NextResponse.json({
      ok: healthyCount > 0,
      activeNode: active?.id ?? null,
      activeUrl: active?.url ?? null,
      failoverEnabled: nodes.length > 1,
      nodes,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "DB health check failed",
      },
      { status: 503 },
    );
  }
}
