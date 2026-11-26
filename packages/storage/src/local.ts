import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertValidKey } from "./keys";
import { DEFAULT_PRESIGN_SECONDS, type PresignedRequest, type StorageAdapter } from "./types";

export interface LocalStorageOptions {
  rootDir: string;
  bucket: string;
  /** Public base URL of the API that serves `/api/storage/local/*` (see apps/api). */
  publicBaseUrl: string;
  signingSecret: string;
  now?: () => Date;
}

function sign(secret: string, method: string, key: string, expires: number, contentType = ""): string {
  return createHmac("sha256", secret).update(`${method}\n${key}\n${expires}\n${contentType}`).digest("hex");
}

/**
 * Verifies a URL produced by LocalStorage.presign*. Mirrors S3 presigned semantics so the
 * web client uses the same upload flow in dev as against R2.
 */
export function verifyLocalSignature(
  secret: string,
  params: {
    method: string;
    key: string;
    expires: string | undefined;
    sig: string | undefined;
    contentType?: string;
  },
  now: Date = new Date(),
): boolean {
  const expires = Number(params.expires);
  if (!params.sig || !Number.isFinite(expires) || expires * 1000 < now.getTime()) return false;
  const expected = Buffer.from(
    sign(secret, params.method, params.key, expires, params.contentType ?? ""),
    "hex",
  );
  const given = Buffer.from(params.sig, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export class LocalStorage implements StorageAdapter {
  readonly driver = "local" as const;
  readonly bucket: string;
  private readonly root: string;
  private readonly now: () => Date;

  constructor(private readonly opts: LocalStorageOptions) {
    this.bucket = opts.bucket;
    this.root = path.resolve(opts.rootDir, opts.bucket);
    this.now = opts.now ?? (() => new Date());
  }

  private filePath(key: string): string {
    assertValidKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Invalid storage key "${key}"`);
    return full;
  }

  async put(key: string, body: Uint8Array | string, _contentType: string): Promise<void> {
    const file = this.filePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.filePath(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.filePath(key), { force: true });
  }

  private presign(
    method: "PUT" | "GET",
    key: string,
    seconds: number,
    contentType?: string,
  ): PresignedRequest {
    assertValidKey(key);
    const expiresAt = new Date(this.now().getTime() + seconds * 1000);
    const expires = Math.floor(expiresAt.getTime() / 1000);
    const sig = sign(this.opts.signingSecret, method, key, expires, contentType ?? "");
    const url = new URL(`/api/storage/local/${key}`, this.opts.publicBaseUrl);
    url.searchParams.set("expires", String(expires));
    url.searchParams.set("sig", sig);
    return {
      url: url.toString(),
      method,
      headers: contentType ? { "Content-Type": contentType } : {},
      expiresAt,
    };
  }

  async presignPut(key: string, contentType: string, seconds = DEFAULT_PRESIGN_SECONDS) {
    return this.presign("PUT", key, seconds, contentType);
  }

  async presignGet(key: string, seconds = DEFAULT_PRESIGN_SECONDS) {
    return this.presign("GET", key, seconds);
  }
}
