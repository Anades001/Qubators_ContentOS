import { randomUUID } from "node:crypto";

/** Bucket prefixes agreed in PRD.md §1. */
export const STORAGE_PREFIXES = ["originals", "generated", "backups"] as const;
export type StoragePrefix = (typeof STORAGE_PREFIXES)[number];

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Throws unless the key is `<prefix>/<safe segments...>` with no traversal. */
export function assertValidKey(key: string): void {
  const segments = key.split("/");
  const [prefix, ...rest] = segments;
  if (!prefix || !(STORAGE_PREFIXES as readonly string[]).includes(prefix) || rest.length === 0) {
    throw new Error(`Invalid storage key "${key}": must start with one of ${STORAGE_PREFIXES.join(", ")}`);
  }
  for (const seg of rest) {
    if (!SAFE_SEGMENT.test(seg) || seg === "." || seg === "..") {
      throw new Error(`Invalid storage key "${key}": unsafe segment "${seg}"`);
    }
  }
}

/** Builds a collision-free key, e.g. `originals/<brandId>/<uuid>-pouch.jpg`. */
export function buildKey(prefix: StoragePrefix, scope: string, filename: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[-.]+|-+$/g, "")
      .slice(0, 80) || "file";
  const key = `${prefix}/${clean(scope)}/${randomUUID()}-${clean(filename)}`;
  assertValidKey(key);
  return key;
}
