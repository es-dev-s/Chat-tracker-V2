import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";

export class SupabaseFailoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseFailoverError";
  }
}

type NodeId = "primary" | "secondary";

type DbNode = {
  id: NodeId;
  url: string;
  client: SupabaseClient;
  healthy: boolean;
  lastCheckedAt: number;
};

const FAILOVER_HTTP_STATUSES = new Set([0, 502, 503, 504, 520, 521, 522, 523, 524]);

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function isRetryablePostgrestError(error: PostgrestError | null, status?: number): boolean {
  if (!error) return false;
  if (status != null && FAILOVER_HTTP_STATUSES.has(status)) return true;
  const msg = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("dns") ||
    msg.includes("balancer") ||
    msg.includes("gateway") ||
    msg.includes("timeout") ||
    msg.includes("socket")
  );
}

function isRetryableThrownError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err instanceof SupabaseFailoverError) return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("dns") ||
    msg.includes("timeout") ||
    msg.includes("socket")
  );
}

function makeClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url.replace(/\/+$/, ""), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function probeNode(node: DbNode): Promise<boolean> {
  try {
    const res = await node.client
      .from("chat_records")
      .select("id", { head: true, count: "exact" });
    if (res.error && isRetryablePostgrestError(res.error, res.status)) return false;
    // Table missing / auth broken on this node — treat as unhealthy for failover.
    if (res.error) return false;
    return true;
  } catch {
    return false;
  }
}

export class SupabaseFailoverPool {
  private nodes: DbNode[] = [];
  private activeIndex = 0;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private healthRunning = false;

  constructor() {
    const primaryUrl = process.env.SUPABASE_URL?.trim();
    const primaryKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!primaryUrl || !primaryKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    this.nodes.push({
      id: "primary",
      url: primaryUrl,
      client: makeClient(primaryUrl, primaryKey),
      healthy: true,
      lastCheckedAt: 0,
    });

    const secondaryUrl = process.env.SUPABASE_URL_SECONDARY?.trim();
    const secondaryKey = process.env.SUPABASE_SERVICE_ROLE_KEY_SECONDARY?.trim();
    const failoverEnabled =
      envFlag("SUPABASE_FAILOVER_ENABLED", true) && Boolean(secondaryUrl && secondaryKey);

    if (failoverEnabled && secondaryUrl && secondaryKey) {
      this.nodes.push({
        id: "secondary",
        url: secondaryUrl,
        client: makeClient(secondaryUrl, secondaryKey),
        healthy: true,
        lastCheckedAt: 0,
      });
    }

    this.startHealthChecks();
  }

  get activeNodeId(): NodeId {
    return this.nodes[this.activeIndex]?.id ?? "primary";
  }

  get hasSecondary(): boolean {
    return this.nodes.length > 1;
  }

  status() {
    return this.nodes.map((n, index) => ({
      id: n.id,
      url: n.url,
      healthy: n.healthy,
      active: index === this.activeIndex,
      lastCheckedAt: n.lastCheckedAt,
    }));
  }

  getActiveClient(): SupabaseClient {
    return this.nodes[this.activeIndex].client;
  }

  private startHealthChecks(): void {
    if (this.nodes.length < 2 || this.healthTimer) return;
    const intervalMs = Math.max(
      5_000,
      Number(process.env.SUPABASE_FAILOVER_HEALTH_MS ?? 15_000) || 15_000,
    );

    const tick = () => {
      void this.runHealthChecks();
    };

    if (typeof setImmediate !== "undefined") {
      setImmediate(tick);
    } else {
      void this.runHealthChecks();
    }

    this.healthTimer = setInterval(tick, intervalMs);
    if (typeof this.healthTimer.unref === "function") {
      this.healthTimer.unref();
    }
  }

  async runHealthChecks(): Promise<void> {
    if (this.healthRunning || this.nodes.length < 1) return;
    this.healthRunning = true;
    try {
      const preferPrimary = envFlag("SUPABASE_FAILOVER_PREFER_PRIMARY", true);
      const results = await Promise.all(
        this.nodes.map(async (node) => {
          const healthy = await probeNode(node);
          node.healthy = healthy;
          node.lastCheckedAt = Date.now();
          return healthy;
        }),
      );

      const prev = this.activeIndex;
      if (this.nodes.length === 1) {
        this.activeIndex = 0;
      } else if (results[0] && preferPrimary) {
        this.activeIndex = 0;
      } else if (results[1]) {
        this.activeIndex = 1;
      } else if (results[0]) {
        this.activeIndex = 0;
      }

      if (prev !== this.activeIndex) {
        this.onFailover(this.nodes[this.activeIndex].id);
      }
    } finally {
      this.healthRunning = false;
    }
  }

  private onFailover(nodeId: NodeId): void {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[supabase-failover] active node → ${nodeId}`);
    }
  }

  private switchAwayFrom(index: number): void {
    if (this.nodes.length < 2) return;
    this.nodes[index].healthy = false;
    this.activeIndex = index === 0 ? 1 : 0;
    this.onFailover(this.nodes[this.activeIndex].id);
  }

  async run<T>(operation: (client: SupabaseClient) => Promise<T>): Promise<T> {
    const order =
      this.nodes.length < 2
        ? [this.activeIndex]
        : [this.activeIndex, this.activeIndex === 0 ? 1 : 0];

    let lastError: unknown;
    for (let attempt = 0; attempt < order.length; attempt += 1) {
      const nodeIndex = order[attempt];
      const node = this.nodes[nodeIndex];
      if (!node) continue;
      try {
        const result = await operation(node.client);
        if (attempt > 0) {
          this.activeIndex = nodeIndex;
          node.healthy = true;
          this.onFailover(node.id);
        }
        return result;
      } catch (err) {
        lastError = err;
        if (attempt === 0 && this.nodes.length > 1 && isRetryableThrownError(err)) {
          this.switchAwayFrom(nodeIndex);
          continue;
        }
        break;
      }
    }
    throw lastError instanceof Error ? lastError : new SupabaseFailoverError(String(lastError));
  }
}

let pool: SupabaseFailoverPool | null = null;

export function getSupabaseFailoverPool(): SupabaseFailoverPool {
  if (!pool) pool = new SupabaseFailoverPool();
  return pool;
}

/** Run a Supabase query/mutation with automatic retry on the standby node. */
export async function runSupabase<T>(
  operation: (client: SupabaseClient) => Promise<T>,
): Promise<T> {
  return getSupabaseFailoverPool().run(operation);
}

export function throwIfRetryableSupabaseError(
  error: PostgrestError | null,
  status?: number,
  context = "supabase query",
): void {
  if (!error) return;
  if (isRetryablePostgrestError(error, status)) {
    throw new SupabaseFailoverError(`${context}: ${error.message}`);
  }
}
