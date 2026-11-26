import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FeatureFlags } from "@contentos/config";
import { LocalStorage } from "@contentos/storage";
import { createApp, type AppDeps } from "../src/app";

const secret = "s".repeat(32);
const offFlags: FeatureFlags = { publisher: false, analytics: false, imageGen: false, billing: false };
let dir: string;
let storage: LocalStorage;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "contentos-api-"));
  storage = new LocalStorage({
    rootDir: dir,
    bucket: "b",
    publicBaseUrl: "http://api.test",
    signingSecret: secret,
  });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

function makeApp(overrides: Partial<AppDeps> = {}) {
  return createApp({
    flags: offFlags,
    storage,
    signingSecret: secret,
    appUrl: "http://localhost:3000",
    authHandler: (_req, res) => res.status(200).json({ auth: true }),
    getSessionUser: async (req) =>
      req.headers.authorization === "Bearer demo" ? { id: "u1", email: "d@x.io", name: "Demo" } : null,
    userOwnsBrand: async (userId, brandId) => userId === "u1" && brandId === "brand1",
    pingDb: async () => {},
    ...overrides,
  });
}

describe("health & flags", () => {
  it("reports ok when the DB responds", async () => {
    const res = await request(makeApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", checks: { db: "ok", storage: "local" } });
  });

  it("reports degraded when the DB is down", async () => {
    const res = await request(makeApp({ pingDb: async () => Promise.reject(new Error("down")) })).get(
      "/api/health",
    );
    expect(res.status).toBe(503);
    expect(res.body.checks.db).toBe("error");
  });

  it("exposes feature flags", async () => {
    const res = await request(makeApp()).get("/api/flags");
    expect(res.body).toEqual(offFlags);
  });

  it("gates disabled modules with 404 and enabled stubs with 501", async () => {
    expect((await request(makeApp()).post("/api/publisher/schedule")).status).toBe(404);
    const on = makeApp({ flags: { ...offFlags, publisher: true } });
    expect((await request(on).post("/api/publisher/schedule")).status).toBe(501);
  });

  it("routes /api/auth/* to BetterAuth", async () => {
    const res = await request(makeApp()).post("/api/auth/sign-in/email").send({});
    expect(res.body).toEqual({ auth: true });
  });

  it("allows CORS only from the app origin", async () => {
    const ok = await request(makeApp()).get("/api/flags").set("Origin", "http://localhost:3000");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const bad = await request(makeApp()).get("/api/flags").set("Origin", "http://evil.test");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("uploads", () => {
  it("requires a session", async () => {
    const res = await request(makeApp()).post("/api/uploads/presign").send({});
    expect(res.status).toBe(401);
  });

  it("rejects brands the user doesn't own", async () => {
    const res = await request(makeApp())
      .post("/api/uploads/presign")
      .set("Authorization", "Bearer demo")
      .send({ brandId: "other", filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(404);
  });

  it("presigns, accepts the upload and serves it back", async () => {
    const app = makeApp();
    const presign = await request(app)
      .post("/api/uploads/presign")
      .set("Authorization", "Bearer demo")
      .send({ brandId: "brand1", filename: "Pouch.png", contentType: "image/png" });
    expect(presign.status).toBe(201);
    expect(presign.body.key).toMatch(/^originals\/brand1\//);

    const putUrl = new URL(presign.body.upload.url);
    const put = await request(app)
      .put(putUrl.pathname + putUrl.search)
      .set("Content-Type", "image/png")
      .send(Buffer.from("png-bytes"));
    expect(put.status).toBe(200);

    // Wrong content type invalidates the signature.
    const tampered = await request(app)
      .put(putUrl.pathname + putUrl.search)
      .set("Content-Type", "text/html")
      .send("<script>");
    expect(tampered.status).toBe(403);

    const get = await storage.presignGet(presign.body.key, 60);
    const getUrl = new URL(get.url);
    const res = await request(app)
      .get(getUrl.pathname + getUrl.search)
      .buffer(true);
    expect(res.status).toBe(200);
    expect(Buffer.from(res.body).toString()).toBe("png-bytes");
  });

  it("rejects unsigned storage access", async () => {
    const res = await request(makeApp()).get("/api/storage/local/originals/brand1/x.png");
    expect(res.status).toBe(403);
  });
});
