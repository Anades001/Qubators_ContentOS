import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LocalStorage,
  S3Storage,
  assertValidKey,
  buildKey,
  createStorage,
  verifyLocalSignature,
} from "../src";

const secret = "s".repeat(32);
let dir: string;
let storage: LocalStorage;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "contentos-storage-"));
  storage = new LocalStorage({
    rootDir: dir,
    bucket: "contentos-assets",
    publicBaseUrl: "http://api.test",
    signingSecret: secret,
  });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("keys", () => {
  it("builds prefixed, sanitised keys", () => {
    const key = buildKey("originals", "Brand 1", "Pouch Photo!.JPG");
    expect(key).toMatch(/^originals\/brand-1\/[0-9a-f-]{36}-pouch-photo-.jpg$/);
  });

  it.each(["../etc/passwd", "originals/../x", "other/a.png", "originals", "originals/a b.png"])(
    "rejects %s",
    (key) => expect(() => assertValidKey(key)).toThrow(),
  );
});

describe("LocalStorage", () => {
  it("round-trips objects", async () => {
    const key = "generated/brand/hello.txt";
    await storage.put(key, "hello", "text/plain");
    expect(Buffer.from((await storage.get(key))!).toString()).toBe("hello");
    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it("issues verifiable presigned URLs that expire", async () => {
    const key = "originals/brand/a.png";
    const req = await storage.presignPut(key, "image/png", 60);
    const url = new URL(req.url);
    expect(url.pathname).toBe(`/api/storage/local/${key}`);
    expect(req.headers["Content-Type"]).toBe("image/png");

    const params = {
      method: "PUT",
      key,
      expires: url.searchParams.get("expires") ?? undefined,
      sig: url.searchParams.get("sig") ?? undefined,
      contentType: "image/png",
    };
    expect(verifyLocalSignature(secret, params)).toBe(true);
    expect(verifyLocalSignature(secret, { ...params, contentType: "text/html" })).toBe(false);
    expect(verifyLocalSignature(secret, { ...params, method: "GET" })).toBe(false);
    expect(verifyLocalSignature("t".repeat(32), params)).toBe(false);
    expect(verifyLocalSignature(secret, params, new Date(Date.now() + 120_000))).toBe(false);
  });
});

describe("createStorage", () => {
  const base = {
    STORAGE_LOCAL_DIR: tmpdir(),
    S3_BUCKET: "contentos-assets",
    S3_REGION: "auto",
    API_URL: "http://api.test",
    BETTER_AUTH_SECRET: secret,
  };

  it("selects the driver from config", () => {
    expect(createStorage({ ...base, STORAGE_DRIVER: "local" })).toBeInstanceOf(LocalStorage);
    const r2 = createStorage({
      ...base,
      STORAGE_DRIVER: "r2",
      R2_ACCOUNT_ID: "acct",
      S3_ACCESS_KEY_ID: "k",
      S3_SECRET_ACCESS_KEY: "s",
    });
    expect(r2).toBeInstanceOf(S3Storage);
    expect(r2.driver).toBe("r2");
  });

  it("presigns S3 URLs offline", async () => {
    const minio = createStorage({
      ...base,
      STORAGE_DRIVER: "minio",
      S3_ENDPOINT: "http://localhost:9000",
      S3_ACCESS_KEY_ID: "k",
      S3_SECRET_ACCESS_KEY: "s",
    });
    const req = await minio.presignPut("originals/b/x.png", "image/png", 60);
    expect(req.url).toContain("http://localhost:9000/contentos-assets/originals/b/x.png");
    expect(req.url).toContain("X-Amz-Signature=");
  });
});
