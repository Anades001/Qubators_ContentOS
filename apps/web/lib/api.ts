const apiInternal = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

export interface Health {
  status: "ok" | "degraded";
  version: string;
  checks: { db: "ok" | "error"; storage: string };
}

export type Flags = Record<"publisher" | "analytics" | "imageGen" | "billing", boolean>;

/** Server-side fetch straight to the API container (skips the public proxy). */
export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiInternal}${path}`, { cache: "no-store" });
    if (!res.ok && res.status !== 503) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
